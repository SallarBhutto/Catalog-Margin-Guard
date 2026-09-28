import type * as React from "react"

import { navigateTo } from "@/app/app-router"
import { cn } from "@/lib/utils"

type AppLinkProps = React.ComponentProps<"a"> & { href: string }

/**
 * A real anchor for same-origin routes that navigates client-side. Keeps the in-memory
 * analysis alive, works with middle-click and keyboard, and falls back to a normal
 * navigation when JavaScript has not taken over.
 */
function AppLink({ href, onClick, className, ...props }: AppLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        navigateTo(href)
        if (!href.includes("#")) window.scrollTo({ top: 0, behavior: "auto" })
      }}
      className={cn(
        "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  )
}

export { AppLink }
