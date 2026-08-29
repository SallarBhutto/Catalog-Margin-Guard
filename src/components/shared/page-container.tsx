import type * as React from "react"

import { cn } from "@/lib/utils"

type PageContainerProps = React.ComponentProps<"div"> & {
  width?: "landing" | "app" | "results"
}

const widthClasses = {
  landing: "max-w-landing",
  app: "max-w-app",
  results: "max-w-results",
} as const

function PageContainer({ className, width = "landing", ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        widthClasses[width],
        className,
      )}
      {...props}
    />
  )
}

export { PageContainer }
