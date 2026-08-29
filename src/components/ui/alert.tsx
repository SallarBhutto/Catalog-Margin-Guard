import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "grid w-full grid-cols-[auto_1fr] items-start gap-x-3 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-5",
  {
    variants: {
      variant: {
        default: "border-border bg-surface text-text-primary",
        info: "border-brand-soft-border bg-brand-soft text-text-primary [&>svg]:text-brand",
        warning:
          "border-review-border bg-review-soft text-text-primary [&>svg]:text-review",
        destructive:
          "border-loss-border bg-loss-soft text-text-primary [&>svg]:text-loss",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-semibold leading-[22px]", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 mt-0.5 text-text-secondary leading-[22px]", className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }
