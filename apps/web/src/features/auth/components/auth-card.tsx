import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@ai-ems/ui/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <h1 data-slot="card-title" className="text-xl leading-snug font-semibold tracking-tight">
            {title}
          </h1>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
