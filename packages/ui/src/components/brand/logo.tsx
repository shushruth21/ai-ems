import { useId } from "react";

import { cn } from "../../lib/utils";

/** AI EMS mark — a hexagon with a spark. Original artwork. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-7 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5dfc" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill={`url(#${gradientId})`} />
      <path d="M32 16l3.6 9.4L45 29l-9.4 3.6L32 42l-3.6-9.4L19 29l9.4-3.6z" fill="#fff" />
      <circle cx="44" cy="44" r="3" fill="#fff" opacity=".85" />
    </svg>
  );
}

export function Logo({
  className,
  collapsed = false,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark title="AI EMS" />
      {collapsed ? null : <span className="text-md font-semibold tracking-tight">AI EMS</span>}
    </span>
  );
}
