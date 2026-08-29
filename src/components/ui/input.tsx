import type * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-disabled focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-disabled aria-invalid:border-loss aria-invalid:ring-loss/15",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
