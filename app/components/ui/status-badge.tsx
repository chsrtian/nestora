import { Badge } from "./badge";

type StatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

const statusVariants: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  approved: "success",
  verified: "success",
  pending: "warning",
  rejected: "danger",
  unverified: "neutral",
  rented: "neutral",
  unavailable: "neutral",
};

function formatStatus(status: string | null | undefined) {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase() ?? "";
  return (
    <Badge variant={statusVariants[normalizedStatus] ?? "neutral"} className={className}>
      {formatStatus(status)}
    </Badge>
  );
}
