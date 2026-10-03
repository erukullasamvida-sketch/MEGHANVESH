import type { AnomalySeverity, AWSStationStatus } from "@/lib/api/aws";
import { cn } from "@/lib/utils";

const stationClasses: Record<AWSStationStatus, string> = {
  HEALTHY: "border-emerald-800/20 bg-emerald-50 text-emerald-800",
  WARNING: "border-amber-800/20 bg-amber-50 text-amber-900",
  ANOMALOUS: "border-orange-800/20 bg-orange-50 text-orange-900",
  OFFLINE: "border-slate-700/20 bg-slate-100 text-slate-700",
};

const severityClasses: Record<AnomalySeverity, string> = {
  NORMAL: "border-emerald-800/20 bg-emerald-50 text-emerald-800",
  LOW: "border-slate-600/20 bg-slate-100 text-slate-700",
  MEDIUM: "border-amber-800/20 bg-amber-50 text-amber-900",
  HIGH: "border-orange-800/20 bg-orange-50 text-orange-900",
  CRITICAL: "border-red-800/20 bg-red-50 text-red-900",
};

export function StationStatusBadge({
  status,
  className,
}: {
  status: AWSStationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        stationClasses[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: AnomalySeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        severityClasses[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}