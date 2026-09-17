import { FlaskConical } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export function PreviewBanner({ basePath }: { basePath: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-ai-border bg-ai-bg px-4 py-1.5 text-sm text-foreground">
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="size-3.5 text-ai" aria-hidden />
        UI preview with sample data — nothing here is saved.
      </span>
      <Link
        href={`${basePath}/design-system` as Route}
        className="font-medium text-ai underline-offset-4 hover:underline"
      >
        Open the design system
      </Link>
    </div>
  );
}
