import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
        secondary:
          "border border-border-strong bg-surface text-text-primary hover:bg-surface-hover active:bg-surface-subtle",
        ghost: "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
        destructive: "bg-loss text-white hover:bg-loss-strong",
      },
      size: {
        default: "h-10",
        large: "h-11 px-5 text-base",
        small: "h-10 px-3 text-[13px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button"

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
