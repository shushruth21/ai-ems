#!/usr/bin/env node
/**
 * One-command local stack — no Supabase account, no Prisma engine download.
 *
 *   pnpm dev:local            # database + auth emulator + migrations + seed + Next.js dev server
 *   pnpm dev:local --reset    # also wipes the local auth accounts
 *
 * What it does:
 *   1. PostgreSQL: uses DATABASE_URL if it answers; otherwise starts the `db`
 *      service from infrastructure/docker/docker-compose.yml.
 *   2. Applies Prisma migrations (WASM engine), the Supabase SQL and the seed.
 *   3. Starts the Supabase Auth emulator (tools/auth-emulator) with accounts
 *      persisted in .ai-ems/auth-emulator.json, and creates the demo owner.
 *   4. Starts the outbox worker (tools/worker), which turns events into
 *      in-app notifications and email.
 *   5. Starts `next dev` and restarts any process that crashes, until Ctrl-C.
 *
 * Emails (confirmation, reset, magic links) are printed in this terminal.
 * Development only: the emulator is not secure.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stateDir = path.join(root, ".ai-ems");
const args = new Set(process.argv.slice(2));

const APP_PORT = Number(process.env.PORT ?? 3000);
const AUTH_PORT = Number(process.env.AUTH_EMULATOR_PORT ?? 54321);
const PG_PASSWORD = process.env.POSTGRES_PASSWORD ?? "change-me-locally";
const DEMO_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@demo.local";
const DEMO_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "Demo-Owner-Local-2026";

const env = {
  ...process.env,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${APP_PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${AUTH_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-publishable-key",
  SUPABASE_SECRET_KEY: "local-secret-key-for-the-auth-emulator",
  DATABASE_URL:
    process.env.DATABASE_URL ?? `postgresql://aiems:${PG_PASSWORD}@localhost:5432/aiems`,
  AUTH_RATE_LIMIT_STORE: process.env.AUTH_RATE_LIMIT_STORE ?? "postgres",
  AUTH_EMULATOR_PORT: String(AUTH_PORT),
  AUTH_EMULATOR_STATE_FILE: path.join(stateDir, "auth-emulator.json"),
  AUTH_EMULATOR_LOG_EMAILS: "true",
  SEED_OWNER_EMAIL: DEMO_EMAIL,
  SEED_OWNER_PASSWORD: DEMO_PASSWORD,
  FEATURE_OAUTH_GOOGLE: process.env.FEATURE_OAUTH_GOOGLE ?? "true",
  ENABLE_UI_PREVIEW: process.env.ENABLE_UI_PREVIEW ?? "true",
  MAIL_TRANSPORT: process.env.MAIL_TRANSPORT ?? "log",
};
delete env.DIRECT_URL; // the local database has one URL

const c = {
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  off: "\x1b[0m",
};
const log = (msg) => console.log(`${c.cyan}[dev:local]${c.off} ${msg}`);
const fail = (msg) => {
  console.error(`${c.red}[dev:local] ${msg}${c.off}`);
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: root,
    env,
    stdio: opts.quiet ? "pipe" : "inherit",
    shell: false,
  });
  return r.status === 0;
}

function portOpen(port, host = "127.0.0.1", timeout = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

async function waitFor(check, label, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`${label} did not become ready in ${seconds}s`);
}

async function ensureDatabase() {
  const url = new URL(env.DATABASE_URL);
  const port = Number(url.port || 5432);
  if (await portOpen(port, url.hostname === "localhost" ? "127.0.0.1" : url.hostname)) {
    log(`PostgreSQL: using ${url.hostname}:${port}/${url.pathname.slice(1)}`);
    return;
  }
  const docker = spawnSync("docker", ["compose", "version"], { stdio: "pipe" });
  if (docker.status !== 0) {
    fail(
      `PostgreSQL isn't running on ${url.hostname}:${port} and Docker isn't available.\n` +
        "  Start Docker Desktop (recommended), or install PostgreSQL 16+ and set DATABASE_URL.",
    );
  }
  log("PostgreSQL: starting the `db` container (infrastructure/docker/docker-compose.yml)…");
  if (
    !run("docker", ["compose", "-f", "infrastructure/docker/docker-compose.yml", "up", "-d", "db"])
  ) {
    fail("docker compose up failed");
  }
  await waitFor(() => portOpen(port), "PostgreSQL");
  // The port opens slightly before Postgres accepts logins.
  await new Promise((r) => setTimeout(r, 1500));
}

function prepareDatabase() {
  log("Database: applying migrations, Supabase SQL and seed…");
  const steps = [
    // Normally done by `pnpm install`; needs Prisma's engine download, so skip when present.
    ...(existsSync(path.join(root, "packages/db/src/generated/prisma/client.ts"))
      ? []
      : [["pnpm", ["--silent", "--filter", "@ai-ems/db", "db:generate"]]]),
    ["pnpm", ["--silent", "--filter", "@ai-ems/db", "db:deploy:wasm"]],
    ["pnpm", ["--silent", "--filter", "@ai-ems/db", "db:sql"]],
    ["pnpm", ["--silent", "--filter", "@ai-ems/db", "db:seed"]],
  ];
  for (const [cmd, a] of steps) {
    if (!run(cmd, a)) fail(`step failed: ${cmd} ${a.join(" ")}`);
  }
}

// ─── Supervised long-running processes ────────────────────────────────────

const children = new Map();
let stopping = false;

function supervise(name, cmd, cmdArgs, { cwd = root } = {}) {
  let restarts = 0;
  const start = () => {
    // Own process group, so the whole tree (pnpm → tsx → node) can be killed
    // together and no orphan keeps a port busy after a crash.
    const child = spawn(cmd, cmdArgs, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    children.set(name, child);
    const prefix = `${c.dim}[${name}]${c.off} `;
    const pipe = (stream, out) =>
      stream.on("data", (buf) => {
        for (const line of buf.toString().split("\n"))
          if (line.trim()) out.write(`${prefix}${line}\n`);
      });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    const startedAt = Date.now();
    child.on("exit", (code, signal) => {
      children.delete(name);
      killGroup(child, "SIGKILL");
      if (stopping) return;
      // Reset the backoff after a process has stayed up for a minute.
      if (Date.now() - startedAt > 60_000) restarts = 0;
      restarts++;
      const delay = Math.min(30_000, 1000 * 2 ** (restarts - 1));
      console.error(
        `${c.red}[${name}] exited (${signal ?? code}); restarting in ${delay / 1000}s${c.off}`,
      );
      setTimeout(start, delay);
    });
  };
  start();
}

function killGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // group already gone
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  log("stopping…");
  for (const child of children.values()) killGroup(child, "SIGTERM");
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Main ─────────────────────────────────────────────────────────────────

mkdirSync(stateDir, { recursive: true });
if (args.has("--reset") && existsSync(env.AUTH_EMULATOR_STATE_FILE)) {
  rmSync(env.AUTH_EMULATOR_STATE_FILE);
  log("reset local auth accounts");
}
if (await portOpen(APP_PORT))
  fail(`port ${APP_PORT} is already in use (set PORT=… to use another)`);
if (await portOpen(AUTH_PORT))
  fail(`port ${AUTH_PORT} is already in use (set AUTH_EMULATOR_PORT=…)`);

await ensureDatabase();

supervise("auth", "pnpm", ["--silent", "--filter", "@ai-ems/auth-emulator", "start"]);
await waitFor(() => portOpen(AUTH_PORT), "auth emulator", 30);

prepareDatabase();

// Drains the outbox into notifications and email (printed here as [worker]).
supervise("worker", "pnpm", ["--silent", "--filter", "@ai-ems/worker", "start"]);

supervise("web", "pnpm", [
  "--silent",
  "--filter",
  "@ai-ems/web",
  "exec",
  "next",
  "dev",
  "-p",
  String(APP_PORT),
]);
await waitFor(() => portOpen(APP_PORT), "Next.js", 120);

console.log(`
${c.green}${c.bold}AI EMS is running${c.off}
  App          ${c.bold}${env.NEXT_PUBLIC_APP_URL}${c.off}
  Sign in      ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}
  Worker       outbox → notifications + email (MAIL_TRANSPORT=${env.MAIL_TRANSPORT ?? "log"})
  Auth (local) ${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1   ${c.dim}emails are printed below as [auth]${c.off}
  Database     ${env.DATABASE_URL.replace(/:[^:@/]+@/, ":•••@")}
  UI sandbox   ${env.NEXT_PUBLIC_APP_URL}/preview

  Ctrl-C to stop · crashed processes restart automatically
`);
