/**
 * Builds the Content-Security-Policy header for a request.
 * Pure function so it can be unit-tested.
 */
export interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl?: string;
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabase ? supabase.replace(/^https/, "wss") : "";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Inline style *attributes* (Framer Motion, Radix positioning) cannot carry a nonce.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", supabase].filter(Boolean),
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, supabaseWs, ...(isDev ? ["ws:"] : [])].filter(Boolean),
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(" ")}` : key))
    .join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
