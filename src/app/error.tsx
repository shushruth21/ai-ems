"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="grid min-h-[60dvh] place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="grid size-12 place-items-center rounded-xl border border-danger-border bg-danger-bg text-danger">
          <TriangleAlert className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-base text-muted-foreground">
            The page failed to load. Your data is safe — try again, and contact support if it keeps
            happening.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-subtle-foreground">Reference: {error.digest}</p>
          ) : null}
        </div>
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      </div>
    </div>
  );
}
