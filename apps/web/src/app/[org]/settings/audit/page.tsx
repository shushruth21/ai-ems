import type { Metadata, Route } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { requireOrgContext } from "@/server/org/context";
import { Button } from "@ai-ems/ui/components/ui/button";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { Input } from "@ai-ems/ui/components/ui/input";
import { Label } from "@ai-ems/ui/components/ui/label";
import { NativeSelect } from "@ai-ems/ui/components/ui/native-select";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ai-ems/ui/components/ui/table";
import { auditFilterSchema } from "@ai-ems/contracts/platform";
import { prisma } from "@ai-ems/db/client";
import { listAuditActions, listAuditEvents } from "@ai-ems/db/platform/audit";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

/** `to` is exclusive in the query, so an end date covers the whole day. */
function endOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export default async function AuditPage({
  params,
  searchParams,
}: PageProps<"/[org]/settings/audit">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "platform.audit.read");
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  // Unparsable filters are simply ignored: the log still renders.
  const parsed = auditFilterSchema.safeParse({
    action: one("action"),
    entityType: one("entityType"),
    from: one("from"),
    to: one("to"),
    ...(one("cursor") ? { cursor: one("cursor") } : {}),
  });
  const filters = parsed.success ? parsed.data : {};

  const [actions, page] = await Promise.all([
    listAuditActions(prisma, ctx.organization.id),
    listAuditEvents(
      prisma,
      ctx.organization.id,
      {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from ? { from: new Date(`${filters.from}T00:00:00Z`) } : {}),
        ...(filters.to ? { to: endOfDay(filters.to) } : {}),
      },
      { limit: PAGE_SIZE, ...(filters.cursor ? { cursor: filters.cursor } : {}) },
    ),
  ]);

  const nextParams = new URLSearchParams(
    Object.entries({
      action: filters.action ?? "",
      entityType: filters.entityType ?? "",
      from: filters.from ?? "",
      to: filters.to ?? "",
    }).filter(([, v]) => v) as [string, string][],
  );
  if (page.nextCursor) nextParams.set("cursor", page.nextCursor);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Audit log"
        description="Every change to members, roles, settings and keys, newest first."
      />

      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end" role="search">
        <div className="grid gap-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <NativeSelect id="audit-action" name="action" defaultValue={filters.action ?? ""}>
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-entity">Entity type</Label>
          <Input
            id="audit-entity"
            name="entityType"
            placeholder="membership"
            defaultValue={filters.entityType ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </div>
        <Button type="submit">Filter</Button>
      </form>

      {page.rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Events show up here as people work in this workspace."
        />
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          tabIndex={0}
          aria-label="Audit events"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top text-sm whitespace-nowrap text-muted-foreground">
                    <time dateTime={row.createdAt.toISOString()}>
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                    </time>
                  </TableCell>
                  <TableCell className="align-top">
                    {row.actorName ?? (row.actorType === "SYSTEM" ? "System" : "Removed user")}
                    {row.ip ? (
                      <span className="block text-xs text-muted-foreground">{row.ip}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top font-mono text-sm">{row.action}</TableCell>
                  <TableCell className="align-top text-sm">
                    {row.entityType}
                    <span className="block text-xs break-all text-muted-foreground">
                      {row.entityId}
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    {row.changes ? (
                      <details>
                        <summary className="cursor-pointer text-sm">Show</summary>
                        <pre className="mt-1 max-w-80 overflow-x-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(row.changes, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {page.nextCursor ? (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/${org}/settings/audit?${nextParams.toString()}` as Route}>
              Older events
            </Link>
          </Button>
        </div>
      ) : null}
    </PageContainer>
  );
}
