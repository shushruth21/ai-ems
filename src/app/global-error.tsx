"use client";

import "@/styles/globals.css";

/** Last-resort boundary when the root layout itself fails. Keep it dependency-free. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-6 font-sans text-foreground">
        <div role="alert" className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold">AI EMS is temporarily unavailable</h1>
          <p className="text-base text-muted-foreground">Please reload the page in a moment.</p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-3 py-2 text-base font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
