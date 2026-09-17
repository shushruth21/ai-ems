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

let cachedPublic: PublicEnv | undefined;
export function publicEnv(): PublicEnv {
  cachedPublic ??= parsePublicEnv();
  return cachedPublic;
}
