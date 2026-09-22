import { z } from "zod";

/**
 * Environment validation. Import `env` (server) or `publicEnv` (anywhere).
 * The app fails fast at boot with a readable error if configuration is wrong.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("AI EMS"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres"),
  DIRECT_URL: z.string().startsWith("postgres").optional(),
  AI_PROVIDER: z.enum(["anthropic", "openai", "none"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENABLE_UI_PREVIEW: z.enum(["true", "false"]).optional(),
  /** Where auth rate-limit counters live. Defaults to postgres in production. */
  AUTH_RATE_LIMIT_STORE: z.enum(["postgres", "memory"]).optional(),
  AUTH_RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true"),
  /** HMAC key for hashing emails in audit/rate-limit rows. Falls back to SUPABASE_SECRET_KEY. */
  AUTH_IDENTITY_SECRET: z.string().min(16).optional(),
  /** Header set by the edge/proxy that carries the real client IP. */
  /**
   * Outgoing product email (invitations). `log` prints to the server console
   * (development default); `none` sends nothing and the UI offers a copyable
   * link instead (production default until an email provider is added).
   */
  MAIL_TRANSPORT: z.enum(["log", "none"]).optional(),
  TRUSTED_IP_HEADER: z
    .enum(["x-forwarded-for", "x-real-ip", "cf-connecting-ip"])
    .default("x-forwarded-for"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
}

/** Next.js inlines NEXT_PUBLIC_* only when referenced literally. */
const rawPublic = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export function parsePublicEnv(source: Record<string, string | undefined> = rawPublic): PublicEnv {
  const parsed = publicSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid public environment variables:\n${format(parsed.error)}`);
  }
  return parsed.data;
}

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${format(parsed.error)}`);
  }
  return parsed.data;
}

export interface AuthSettings {
  rateLimitEnabled: boolean;
  rateLimitStore: "postgres" | "memory";
  identitySecret: string;
}

export function mailTransport(e: ServerEnv): "log" | "none" {
  return e.MAIL_TRANSPORT ?? (e.NODE_ENV === "production" ? "none" : "log");
}

/** Derived auth settings with environment-aware defaults. */
export function authSettings(e: ServerEnv): AuthSettings {
  return {
    rateLimitEnabled: e.AUTH_RATE_LIMIT_ENABLED === "true",
    rateLimitStore:
      e.AUTH_RATE_LIMIT_STORE ?? (e.NODE_ENV === "production" ? "postgres" : "memory"),
    identitySecret: e.AUTH_IDENTITY_SECRET ?? e.SUPABASE_SECRET_KEY,
  };
}

let cachedPublic: PublicEnv | undefined;
export function publicEnv(): PublicEnv {
  cachedPublic ??= parsePublicEnv();
  return cachedPublic;
}
