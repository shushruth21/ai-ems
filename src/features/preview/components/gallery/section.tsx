import type { ReactNode } from "react";

export function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 space-y-4">
      <div className="space-y-1 border-b pb-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
