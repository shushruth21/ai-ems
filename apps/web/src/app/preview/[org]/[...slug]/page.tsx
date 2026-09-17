import { Construction } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@ai-ems/ui/components/ui/button";
import { moduleForPath } from "@/features/preview/roadmap";

export const metadata: Metadata = { title: "Coming soon" };

export default async function ComingSoon({ params }: PageProps<"/preview/[org]/[...slug]">) {
  const { org, slug } = await params;
  const entry = moduleForPath(slug);
  if (!entry) notFound();
  return (
    <PageContainer>
      <PageHeader title={entry.title} description="This module is planned but not built yet." />
      <div className="rounded-lg border bg-surface">
        <EmptyState
          icon={Construction}
          title={`Arrives in Phase ${entry.phase}`}
          description={entry.summary}
          action={
            <Button asChild variant="outline">
              <Link href={`/preview/${org}/dashboard` as Route}>Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
