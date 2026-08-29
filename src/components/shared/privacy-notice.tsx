import { LockKeyhole } from "lucide-react"
import type * as React from "react"

import { cn } from "@/lib/utils"

type PrivacyNoticeProps = React.ComponentProps<"div"> & {
  compact?: boolean
}

function PrivacyNotice({ className, compact = false, ...props }: PrivacyNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 text-text-secondary",
        compact ? "text-[13px] leading-[18px]" : "text-sm leading-[22px]",
        className,
      )}
      {...props}
    >
      <LockKeyhole
        className={cn("mt-0.5 shrink-0 text-brand", compact ? "size-4" : "size-5")}
        aria-hidden="true"
      />
      <p>
        <strong className="font-semibold text-text-primary">
          Files stay on your computer.
        </strong>
        {!compact &&
          " Supplier pricing and catalog data are processed locally in your browser."}
      </p>
    </div>
  )
}

export { PrivacyNotice }
