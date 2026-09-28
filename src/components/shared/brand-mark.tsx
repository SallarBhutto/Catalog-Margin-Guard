import { cn } from "@/lib/utils"

type BrandMarkProps = Readonly<{ className?: string }>

/**
 * The Catalog Margin Guard mark: a shield (protection) carrying a rising margin bar chart.
 * Drawn inline so it inherits `currentColor` and needs no image request; the same geometry
 * is exported as the static favicon and social image.
 */
function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 2.5 27 6.6v8.2c0 6.9-4.7 12.6-11 14.7C9.7 27.4 5 21.7 5 14.8V6.6L16 2.5Z"
        fill="currentColor"
      />
      <path
        d="M10.5 20.5v-4M15 20.5v-7M19.5 20.5v-9.5M23 11.5l-3.5-1.7"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export { BrandMark }
