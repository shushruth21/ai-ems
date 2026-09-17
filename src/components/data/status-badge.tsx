import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone } from "@/lib/status";

/** Consistent badge for any workflow status code (e.g. "PENDING_APPROVAL"). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} dot className={className} data-status={status}>
      {statusLabel(status)}
    </Badge>
  );
}
