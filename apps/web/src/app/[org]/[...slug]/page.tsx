import { Construction } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { moduleForPath } from "@/features/preview/roadmap";
import { getOrgContext } from "@/server/org/context";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { Button } from "@ai-ems/ui/components/ui/button";

export const metadata: Metadata = { title: "Coming soon" };

/** Modules that are planned but not built yet keep their place in the navigation. */
export default async function ComingSoon({ params }: PageProps<"/[org]/[...slug]">) {
  const { org, slug } = await params;
  await getOrgContext(org);
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
              <Link href={`/${org}/dashboard` as Route}>Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
