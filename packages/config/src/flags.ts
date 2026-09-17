/**
 * Feature flags: typed defaults, overridable per environment with
 * FEATURE_<NAME>=true|false. Evaluated on the server; pass results to client
 * components as props.
 */
export const FLAG_DEFAULTS = {
  MAGIC_LINK: true,
  OAUTH_GOOGLE: false,
  OAUTH_MICROSOFT: false,
  MFA_TOTP: true,
  SIGN_UP: true,
} as const satisfies Record<string, boolean>;

export type FeatureFlag = keyof typeof FLAG_DEFAULTS;
export type FeatureFlags = Record<FeatureFlag, boolean>;

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  if (/^(1|true|on|yes)$/i.test(value)) return true;
  if (/^(0|false|off|no)$/i.test(value)) return false;
  throw new Error(`Invalid boolean for feature flag: "${value}"`);
}

export function resolveFlags(env: Record<string, string | undefined> = process.env): FeatureFlags {
  const out = {} as FeatureFlags;
  for (const key of Object.keys(FLAG_DEFAULTS) as FeatureFlag[]) {
    out[key] = parseBool(env[`FEATURE_${key}`]) ?? FLAG_DEFAULTS[key];
  }
  return out;
}

export function isEnabled(
  flag: FeatureFlag,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return resolveFlags(env)[flag];
}
