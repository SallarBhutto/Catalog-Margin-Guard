import * as LabelPrimitive from "@radix-ui/react-label"
import type * as React from "react"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-[13px] leading-[18px] font-medium text-text-primary peer-disabled:cursor-not-allowed peer-disabled:text-text-disabled",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
