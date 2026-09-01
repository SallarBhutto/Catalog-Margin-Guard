import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react"

import type { MarginResultRow } from "@/features/results/results-query-types"
import { cn } from "@/lib/utils"

type StatusBadgeProps = Readonly<{
  status: MarginResultRow["status"]
}>

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-semibold",
        status === "LOSS" && "border-loss-border bg-loss-soft text-loss-strong",
        status === "REVIEW" && "border-review-border bg-review-soft text-review-strong",
        status === "OK" && "border-ok-border bg-ok-soft text-ok-strong",
      )}
    >
      {status === "OK" ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : status === "LOSS" ? (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3.5" aria-hidden="true" />
      )}
      {status}
    </span>
  )
}

export { StatusBadge }
