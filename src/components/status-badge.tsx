import type { LeaveStatus } from "@/db/schema";

const STYLES: Record<LeaveStatus, string> = {
  pending: "bg-warning-container text-on-warning-container",
  approved: "bg-success-container text-on-success-container",
  rejected: "bg-error-container text-on-error-container",
  cancelled: "bg-surface-container-high text-on-surface-variant",
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-lg px-3 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
