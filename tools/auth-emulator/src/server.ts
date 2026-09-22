import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign as cryptoSign,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { generateSecret, verifyTotp } from "./totp";

/**
 * A small, in-memory emulation of the Supabase Auth (GoTrue) HTTP API — just
 * enough for supabase-js to run the flows AI EMS uses. It exists so end-to-end
 * tests exercise the real client libraries, cookies and JWT verification
 * without network access. It is NOT secure and must never run in production.
 */

export interface EmulatorOptions {
  port?: number;
  host?: string;
  /** Minimum password length (GoTrue's own check; the app enforces a stricter policy). */
  minPasswordLength?: number;
  accessTokenTtlSeconds?: number;
  now?: () => number;
  /**
   * Persist users, sessions, pending links and the signing key to this JSON
   * file so local development survives restarts. Omit in tests.
   */
  stateFile?: string;
  /** Called for every "sent" email (e.g. to print links in a dev terminal). */
  onEmail?: (email: SentEmail) => void;
}

interface PersistedState {
  version: 1;
  kid: string;
  privateJwk: Record<string, unknown>;
  users: User[];
  sessions: Array<Omit<Session, "refreshTokens"> & { refreshTokens: string[] }>;
  tokenHashes: Array<[string, { userId: string; kind: EmailKind; expiresAt: number }]>;
  emails: SentEmail[];
}

interface Factor {
  id: string;
  friendly_name: string;
  factor_type: "totp";
  status: "unverified" | "verified";
  secret: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  password: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  user_metadata: Record<string, unknown>;
  providers: string[];
  factors: Factor[];
}

interface Session {
  id: string;
  userId: string;
  aal: "aal1" | "aal2";
  amr: Array<{ method: string; timestamp: number }>;
  refreshTokens: Set<string>;
}

export type EmailKind = "signup" | "magiclink" | "recovery";

export interface SentEmail {
  to: string;
  kind: EmailKind;
  tokenHash: string;
  /** EmailOtpType to pass to verifyOtp. */
  type: "signup" | "magiclink" | "recovery" | "email";
  redirectTo: string | null;
  sentAt: string;
}

interface Challenge {
  id: string;
  factorId: string;
  expiresAt: number;
}

interface AuthCode {
  userId: string;
  challenge: string;
  method: string;
  provider: string;
  expiresAt: number;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const API_VERSION = "2024-01-01";

export function createAuthEmulator(options: EmulatorOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const minPasswordLength = options.minPasswordLength ?? 6;
  const ttl = options.accessTokenTtlSeconds ?? 3600;
  const saved: PersistedState | null =
    options.stateFile && existsSync(options.stateFile)
      ? (JSON.parse(readFileSync(options.stateFile, "utf8")) as PersistedState)
      : null;
  const kid = saved?.kid ?? randomUUID();
  const { privateKey, publicKey } = saved
    ? (() => {
        const key = createPrivateKey({ key: saved.privateJwk, format: "jwk" });
        return { privateKey: key, publicKey: createPublicKey(key) };
      })()
    : generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid,
    alg: "ES256",
    use: "sig",
    key_ops: ["verify"],
  };

  const users = new Map<string, User>();
  const sessions = new Map<string, Session>();
  const refreshIndex = new Map<string, string>();
  const tokenHashes = new Map<string, { userId: string; kind: EmailKind; expiresAt: number }>();
  const challenges = new Map<string, Challenge>();
  const authCodes = new Map<string, AuthCode>();
  let emails: SentEmail[] = [];
  let issuer = "http://127.0.0.1/auth/v1";

  if (saved) {
    for (const u of saved.users) users.set(u.id, u);
    for (const s of saved.sessions) {
      sessions.set(s.id, { ...s, refreshTokens: new Set(s.refreshTokens) });
      for (const t of s.refreshTokens) refreshIndex.set(t, s.id);
    }
    for (const [hash, entry] of saved.tokenHashes) tokenHashes.set(hash, entry);
    emails = saved.emails;
  }

  function persist() {
    if (!options.stateFile) return;
    const state: PersistedState = {
      version: 1,
      kid,
      privateJwk: privateKey.export({ format: "jwk" }) as Record<string, unknown>,
      users: [...users.values()],
      sessions: [...sessions.values()].map((s) => ({ ...s, refreshTokens: [...s.refreshTokens] })),
      tokenHashes: [...tokenHashes.entries()].filter(([, e]) => e.expiresAt > now()),
      emails: emails.slice(-200),
    };
    const tmp = `${options.stateFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
    renameSync(tmp, options.stateFile);
  }

  const iso = () => new Date(now()).toISOString();
  const findByEmail = (email: string) =>
    [...users.values()].find((u) => u.email === email.trim().toLowerCase());

  function createUser(
    email: string,
    password: string | null,
    meta: Record<string, unknown>,
    provider: string,
  ) {
    const ts = iso();
    const user: User = {
      id: randomUUID(),
      email: email.trim().toLowerCase(),
      password: password === null ? null : hashPassword(password),
      email_confirmed_at: provider === "email" ? null : ts,
      created_at: ts,
      updated_at: ts,
      last_sign_in_at: null,
      user_metadata: meta,
      providers: [provider],
      factors: [],
    };
    users.set(user.id, user);
    return user;
  }

  function sendEmail(user: User, kind: EmailKind, redirectTo: string | null) {
    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha224").update(`${user.email}${token}`).digest("hex");
    tokenHashes.set(tokenHash, { userId: user.id, kind, expiresAt: now() + 3_600_000 });
    const email: SentEmail = {
      to: user.email,
      kind,
      tokenHash,
      type: kind,
      redirectTo,
      sentAt: iso(),
    };
    emails.push(email);
    options.onEmail?.(email);
  }

  function publicUser(user: User) {
    return {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      confirmed_at: user.email_confirmed_at,
      phone: "",
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: { provider: user.providers[0], providers: user.providers },
      user_metadata: user.user_metadata,
      identities: user.providers.map((provider) => ({
        identity_id: `${user.id}-${provider}`,
        id: user.id,
        user_id: user.id,
        provider,
        identity_data: { email: user.email, sub: user.id },
        created_at: user.created_at,
        updated_at: user.updated_at,
      })),
      factors: user.factors.map(({ secret: _secret, ...f }) => f),
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_anonymous: false,
    };
  }

  function signJwt(payload: Record<string, unknown>, key: KeyObject) {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const head = enc({ alg: "ES256", kid, typ: "JWT" });
    const body = enc(payload);
    const sig = cryptoSign("sha256", Buffer.from(`${head}.${body}`), {
      key,
      dsaEncoding: "ieee-p1363",
    });
    return `${head}.${body}.${sig.toString("base64url")}`;
  }

  function issueTokens(user: User, session: Session) {
    const iat = Math.floor(now() / 1000);
    const accessToken = signJwt(
      {
        iss: issuer,
        sub: user.id,
        aud: "authenticated",
        exp: iat + ttl,
        iat,
        email: user.email,
        phone: "",
        role: "authenticated",
        aal: session.aal,
        amr: session.amr,
        session_id: session.id,
        is_anonymous: false,
        app_metadata: { provider: user.providers[0], providers: user.providers },
        user_metadata: user.user_metadata,
      },
      privateKey,
    );
    const refreshToken = randomBytes(16).toString("hex");
    session.refreshTokens.add(refreshToken);
    refreshIndex.set(refreshToken, session.id);
    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ttl,
      expires_at: iat + ttl,
      refresh_token: refreshToken,
      user: publicUser(user),
    };
  }

  function startSession(user: User, method: string) {
    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      aal: "aal1",
      amr: [{ method, timestamp: Math.floor(now() / 1000) }],
      refreshTokens: new Set(),
    };
    sessions.set(session.id, session);
    user.last_sign_in_at = iso();
    return issueTokens(user, session);
  }

  function authenticate(req: IncomingMessage): { user: User; session: Session } {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const [, body] = token.split(".");
    if (!body)
      throw new HttpError(401, "no_authorization", "This endpoint requires a valid Bearer token");
    // Tokens are only ever minted by this process; a signature check would be redundant here.
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      sub?: string;
      session_id?: string;
      exp?: number;
    };
    if (!claims.exp || claims.exp * 1000 < now())
      throw new HttpError(403, "bad_jwt", "JWT expired");
    const session = claims.session_id ? sessions.get(claims.session_id) : undefined;
    if (!session) throw new HttpError(403, "session_not_found", "Session not found");
    const user = claims.sub ? users.get(claims.sub) : undefined;
    if (!user) throw new HttpError(403, "user_not_found", "User not found");
    return { user, session };
  }

  function endSession(session: Session) {
    for (const t of session.refreshTokens) refreshIndex.delete(t);
    sessions.delete(session.id);
  }

  function checkPassword(password: unknown): string {
    if (typeof password !== "string" || password.length < minPasswordLength) {
      throw Object.assign(
        new HttpError(
          422,
          "weak_password",
          `Password should be at least ${minPasswordLength} characters.`,
        ),
        {
          reasons: ["length"],
        },
      );
    }
    return password;
  }

  const routes: Record<string, (ctx: Ctx) => unknown> = {
    "GET /health": () => ({ name: "ai-ems-auth-emulator", version: API_VERSION }),
    "GET /settings": () => ({
      external: { email: true, google: true, azure: true },
      mailer_autoconfirm: false,
    }),
    "GET /.well-known/jwks.json": () => ({ keys: [jwk] }),

    "POST /signup": ({ body, query }) => {
      const email = requireEmail(body.email);
      const password = checkPassword(body.password);
      const existing = findByEmail(email);
      const redirectTo = query.get("redirect_to");
      if (existing) {
        // Like GoTrue with confirmations on: respond identically to avoid enumeration.
        if (!existing.email_confirmed_at) sendEmail(existing, "signup", redirectTo);
        return { ...publicUser(existing), id: randomUUID(), identities: [] };
      }
      const meta = isRecord(body.data) ? body.data : {};
      const user = createUser(email, password, meta, "email");
      sendEmail(user, "signup", redirectTo);
      return publicUser(user);
    },

    "POST /token": ({ body, query }) => {
      const grant = query.get("grant_type");
      if (grant === "password") {
        const user = findByEmail(String(body.email ?? ""));
        if (!user?.password || !passwordMatches(user.password, String(body.password ?? ""))) {
          throw new HttpError(400, "invalid_credentials", "Invalid login credentials");
        }
        if (!user.email_confirmed_at)
          throw new HttpError(400, "email_not_confirmed", "Email not confirmed");
        return startSession(user, "password");
      }
      if (grant === "refresh_token") {
        const token = String(body.refresh_token ?? "");
        const sessionId = refreshIndex.get(token);
        const session = sessionId ? sessions.get(sessionId) : undefined;
        const user = session ? users.get(session.userId) : undefined;
        if (!session || !user)
          throw new HttpError(400, "refresh_token_not_found", "Invalid Refresh Token");
        refreshIndex.delete(token);
        session.refreshTokens.delete(token);
        return issueTokens(user, session);
      }
      if (grant === "pkce") {
        const code = authCodes.get(String(body.auth_code ?? ""));
        authCodes.delete(String(body.auth_code ?? ""));
        if (!code || code.expiresAt < now())
          throw new HttpError(404, "flow_state_not_found", "invalid flow state");
        const verifier = String(body.code_verifier ?? "");
        const computed =
          code.method === "s256"
            ? createHash("sha256").update(verifier).digest("base64url")
            : verifier;
        if (!safeEqual(computed, code.challenge)) {
          throw new HttpError(
            400,
            "bad_code_verifier",
            "code challenge does not match previously saved code verifier",
          );
        }
        const user = users.get(code.userId);
        if (!user) throw new HttpError(404, "user_not_found", "User not found");
        return startSession(user, "oauth");
      }
      throw new HttpError(400, "unsupported_grant_type", `unsupported grant_type ${grant ?? ""}`);
    },

    "POST /otp": ({ body, query }) => {
      const email = requireEmail(body.email);
      let user = findByEmail(email);
      if (!user && body.create_user !== false) {
        user = createUser(email, null, isRecord(body.data) ? body.data : {}, "email");
      }
      if (user)
        sendEmail(user, user.email_confirmed_at ? "magiclink" : "signup", query.get("redirect_to"));
      return {};
    },

    "POST /recover": ({ body, query }) => {
      const user = findByEmail(requireEmail(body.email));
      if (user) sendEmail(user, "recovery", query.get("redirect_to"));
      return {};
    },

    "POST /verify": ({ body }) => {
      const hash = String(body.token_hash ?? "");
      const entry = tokenHashes.get(hash);
      const type = String(body.type ?? "");
      const compatible =
        entry &&
        (type === entry.kind ||
          type === "email" ||
          (type === "magiclink" && entry.kind === "signup") ||
          (type === "signup" && entry.kind === "magiclink"));
      if (!entry || !compatible || entry.expiresAt < now()) {
        throw new HttpError(403, "otp_expired", "Email link is invalid or has expired");
      }
      tokenHashes.delete(hash);
      const user = users.get(entry.userId);
      if (!user) throw new HttpError(403, "otp_expired", "Email link is invalid or has expired");
      user.email_confirmed_at ??= iso();
      return startSession(user, entry.kind === "recovery" ? "recovery" : "otp");
    },

    "GET /user": ({ req }) => publicUser(authenticate(req).user),

    "PUT /user": ({ req, body }) => {
      const { user } = authenticate(req);
      if (body.password !== undefined) {
        const password = checkPassword(body.password);
        if (user.password && passwordMatches(user.password, password)) {
          throw new HttpError(
            422,
            "same_password",
            "New password should be different from the old password.",
          );
        }
        user.password = hashPassword(password);
      }
      if (isRecord(body.data)) user.user_metadata = { ...user.user_metadata, ...body.data };
      user.updated_at = iso();
      return publicUser(user);
    },

    "POST /logout": ({ req, query }) => {
      const { user, session } = authenticate(req);
      const scope = query.get("scope") ?? "global";
      for (const s of [...sessions.values()]) {
        if (s.userId !== user.id) continue;
        const isCurrent = s.id === session.id;
        if (
          scope === "global" ||
          (scope === "local" && isCurrent) ||
          (scope === "others" && !isCurrent)
        ) {
          endSession(s);
        }
      }
      return null;
    },

    "GET /authorize": ({ query }) => {
      const provider = query.get("provider") ?? "";
      const redirectTo = query.get("redirect_to");
      const challenge = query.get("code_challenge");
      if (!["google", "azure"].includes(provider)) {
        throw new HttpError(400, "provider_disabled", "Unsupported provider");
      }
      if (!redirectTo || !challenge)
        throw new HttpError(400, "validation_failed", "PKCE is required");
      const email = `${provider}.user@example.test`;
      const user =
        findByEmail(email) ?? createUser(email, null, { full_name: "OAuth Test User" }, provider);
      const code = randomUUID();
      authCodes.set(code, {
        userId: user.id,
        challenge,
        method: query.get("code_challenge_method") ?? "plain",
        provider,
        expiresAt: now() + 300_000,
      });
      const target = new URL(redirectTo);
      target.searchParams.set("code", code);
      return new Redirect(target.toString());
    },

    "POST /factors": ({ req, body }) => {
      const { user } = authenticate(req);
      if (body.factor_type !== "totp")
        throw new HttpError(422, "mfa_factor_type_disabled", "Only TOTP is supported");
      const friendlyName =
        typeof body.friendly_name === "string" && body.friendly_name ? body.friendly_name : "";
      if (friendlyName && user.factors.some((f) => f.friendly_name === friendlyName)) {
        throw new HttpError(
          422,
          "mfa_factor_name_conflict",
          "A factor with this name already exists",
        );
      }
      // Drop abandoned enrollments like GoTrue does.
      user.factors = user.factors.filter((f) => f.status === "verified");
      const ts = iso();
      const factor: Factor = {
        id: randomUUID(),
        friendly_name: friendlyName,
        factor_type: "totp",
        status: "unverified",
        secret: generateSecret(),
        created_at: ts,
        updated_at: ts,
      };
      user.factors.push(factor);
      const issuerName = typeof body.issuer === "string" && body.issuer ? body.issuer : "AI EMS";
      const uri = `otpauth://totp/${encodeURIComponent(`${issuerName}:${user.email}`)}?secret=${factor.secret}&issuer=${encodeURIComponent(issuerName)}`;
      return {
        id: factor.id,
        type: "totp",
        friendly_name: friendlyName,
        totp: { qr_code: placeholderQr(), secret: factor.secret, uri },
      };
    },

    "POST /factors/:id/challenge": ({ req, params }) => {
      const { user } = authenticate(req);
      const factor = user.factors.find((f) => f.id === params.id);
      if (!factor) throw new HttpError(404, "mfa_factor_not_found", "Factor not found");
      const challenge: Challenge = {
        id: randomUUID(),
        factorId: factor.id,
        expiresAt: now() + 300_000,
      };
      challenges.set(challenge.id, challenge);
      return { id: challenge.id, type: "totp", expires_at: Math.floor(challenge.expiresAt / 1000) };
    },

    "POST /factors/:id/verify": ({ req, params, body }) => {
      const { user, session } = authenticate(req);
      const factor = user.factors.find((f) => f.id === params.id);
      if (!factor) throw new HttpError(404, "mfa_factor_not_found", "Factor not found");
      const challenge = challenges.get(String(body.challenge_id ?? ""));
      if (!challenge || challenge.factorId !== factor.id || challenge.expiresAt < now()) {
        throw new HttpError(422, "mfa_challenge_expired", "Challenge expired or not found");
      }
      if (!verifyTotp(factor.secret, String(body.code ?? ""), now())) {
        throw new HttpError(422, "mfa_verification_failed", "Invalid TOTP code entered");
      }
      challenges.delete(challenge.id);
      factor.status = "verified";
      factor.updated_at = iso();
      session.aal = "aal2";
      session.amr = [...session.amr, { method: "totp", timestamp: Math.floor(now() / 1000) }];
      return issueTokens(user, session);
    },

    "DELETE /factors/:id": ({ req, params }) => {
      const { user, session } = authenticate(req);
      const factor = user.factors.find((f) => f.id === params.id);
      if (!factor) throw new HttpError(404, "mfa_factor_not_found", "Factor not found");
      if (factor.status === "verified" && session.aal !== "aal2") {
        throw new HttpError(403, "insufficient_aal", "AAL2 required to unenroll verified factor");
      }
      user.factors = user.factors.filter((f) => f.id !== factor.id);
      return { id: factor.id };
    },

    // ─── Admin API (service-role; used by the seed script) ────────────────
    "GET /admin/users": () => ({
      users: [...users.values()].map(publicUser),
      aud: "authenticated",
    }),
    "POST /admin/users": ({ body }) => {
      const email = requireEmail(body.email);
      if (findByEmail(email)) throw new HttpError(422, "email_exists", "User already exists");
      const user = createUser(
        email,
        body.password === undefined ? null : checkPassword(body.password),
        isRecord(body.user_metadata) ? body.user_metadata : {},
        "email",
      );
      if (body.email_confirm === true) user.email_confirmed_at = iso();
      return publicUser(user);
    },

    // ─── Test hooks ─────────────────────────────────────────────────────
    "GET /__emails": ({ query }) => {
      const to = query.get("to")?.toLowerCase();
      return to ? emails.filter((e) => e.to === to) : emails;
    },
    "POST /__reset": () => {
      users.clear();
      sessions.clear();
      refreshIndex.clear();
      tokenHashes.clear();
      challenges.clear();
      authCodes.clear();
      emails = [];
      return { ok: true };
    },
    /** Creates a confirmed user directly (optionally with a verified TOTP factor). */
    "POST /__users": ({ body }) => {
      const email = requireEmail(body.email);
      if (findByEmail(email)) throw new HttpError(422, "email_exists", "User already exists");
      const user = createUser(
        email,
        checkPassword(body.password),
        isRecord(body.data) ? body.data : {},
        "email",
      );
      user.email_confirmed_at = iso();
      let totpSecret: string | undefined;
      if (body.totp === true) {
        totpSecret = generateSecret();
        user.factors.push({
          id: randomUUID(),
          friendly_name: "Authenticator",
          factor_type: "totp",
          status: "verified",
          secret: totpSecret,
          created_at: iso(),
          updated_at: iso(),
        });
      }
      return { id: user.id, email: user.email, totpSecret };
    },
    /** Test-only: exposes a factor's secret so tests can compute codes after UI enrollment. */
    "GET /__factors/:id/secret": ({ params }) => {
      for (const user of users.values()) {
        const factor = user.factors.find((f) => f.id === params.id);
        if (factor) return { secret: factor.secret };
      }
      throw new HttpError(404, "mfa_factor_not_found", "Factor not found");
    },
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("x-supabase-api-version", API_VERSION);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("access-control-expose-headers", "x-supabase-api-version");
    if (req.method === "OPTIONS") return send(res, 204, null);

    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname.replace(/^\/auth\/v1/, "") || "/";
    const match = matchRoute(routes, req.method ?? "GET", path);
    if (!match)
      return send(res, 404, { code: "not_found", message: `No route for ${req.method} ${path}` });

    try {
      const raw = req.method === "GET" || req.method === "DELETE" ? "" : await readBody(req);
      const body: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const result = match.handler({ req, body, query: url.searchParams, params: match.params });
      if (req.method !== "GET") persist();
      if (result instanceof Redirect) {
        res.writeHead(303, { location: result.location });
        return res.end();
      }
      return send(res, result === null ? 204 : 200, result);
    } catch (err) {
      if (err instanceof HttpError) {
        const extra = "reasons" in err ? { weak_password: { reasons: err.reasons } } : {};
        return send(res, err.status, {
          code: err.code,
          error_code: err.code,
          msg: err.message,
          message: err.message,
          ...extra,
        });
      }
      console.error("[auth-emulator]", err);
      return send(res, 500, { code: "unexpected_failure", message: "Internal error" });
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  return {
    async listen(): Promise<string> {
      await new Promise<void>((resolve) =>
        server.listen(options.port ?? 0, options.host ?? "127.0.0.1", resolve),
      );
      const { port } = server.address() as AddressInfo;
      const base = `http://${options.host ?? "127.0.0.1"}:${port}`;
      issuer = `${base}/auth/v1`;
      return base;
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
        server.closeAllConnections();
      });
    },
    /** Inspect state in unit tests. */
    get emails(): readonly SentEmail[] {
      return emails;
    },
  };
}

export type AuthEmulator = ReturnType<typeof createAuthEmulator>;

// ─── helpers ────────────────────────────────────────────────────────────

interface Ctx {
  req: IncomingMessage;
  body: Record<string, unknown>;
  query: URLSearchParams;
  params: Record<string, string>;
}

class Redirect {
  constructor(readonly location: string) {}
}

function matchRoute(routes: Record<string, (ctx: Ctx) => unknown>, method: string, path: string) {
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(" ") as [string, string];
    if (m !== method) continue;
    const want = pattern.split("/");
    const got = path.split("/");
    if (want.length !== got.length) continue;
    const params: Record<string, string> = {};
    const ok = want.every((seg, i) => {
      const actual = got[i] ?? "";
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = decodeURIComponent(actual);
        return actual.length > 0;
      }
      return seg === actual;
    });
    if (ok) return { handler, params };
  }
  return null;
}

function send(res: ServerResponse, status: number, body: unknown) {
  if (status === 204) {
    res.writeHead(204);
    return res.end();
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      data += chunk;
      if (data.length > 1_000_000)
        reject(new HttpError(413, "request_too_large", "Body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireEmail(value: unknown): string {
  if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new HttpError(
      400,
      "validation_failed",
      "Unable to validate email address: invalid format",
    );
  }
  return value.trim().toLowerCase();
}

function hashPassword(password: string): string {
  return createHash("sha256").update(`emulator:${password}`).digest("hex");
}

function passwordMatches(hash: string, password: string): boolean {
  return safeEqual(hash, hashPassword(password));
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function placeholderQr(): string {
  // Not a scannable QR code — tests use the secret. Real Supabase returns a QR SVG.
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="160" height="160"><rect width="8" height="8" fill="#fff"/><path d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 5h1v2H6z" fill="#000"/></svg>';
}
