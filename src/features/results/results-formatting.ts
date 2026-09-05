import type { TargetSource } from "@/features/analysis/margin-analysis-types"
import type {
  DisplayCurrency,
  NumberFormat,
} from "@/features/setup/analysis-configuration"

const CURRENCY_SYMBOLS: Readonly<Record<Exclude<DisplayCurrency, "OTHER">, string>> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "CA$",
  AUD: "A$",
}

function roundDecimalString(value: string, scale: number) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return null

  const [, sign, whole = "0", fraction = ""] = match
  const kept = fraction.slice(0, scale).padEnd(scale, "0")
  const nextDigit = fraction[scale] ?? "0"
  const units = BigInt(`${whole}${kept}` || "0") + (nextDigit >= "5" ? 1n : 0n)
  const digits = units.toString().padStart(scale + 1, "0")
  const roundedWhole = scale === 0 ? digits : digits.slice(0, -scale)
  const roundedFraction = scale === 0 ? "" : digits.slice(-scale)
  const isZero = units === 0n

  return {
    sign: sign === "-" && !isZero ? "-" : "",
    whole: roundedWhole,
    fraction: roundedFraction,
  }
}

function groupWhole(value: string, separator: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

function formatDecimal(value: string, numberFormat: NumberFormat, scale = 2) {
  const rounded = roundDecimalString(value, scale)
  if (!rounded) return "—"

  const groupSeparator = numberFormat === "EU" ? "." : ","
  const decimalSeparator = numberFormat === "EU" ? "," : "."
  const fraction = scale > 0 ? `${decimalSeparator}${rounded.fraction}` : ""
  return `${rounded.sign}${groupWhole(rounded.whole, groupSeparator)}${fraction}`
}

function formatMoney(
  value: string,
  currency: DisplayCurrency,
  numberFormat: NumberFormat,
) {
  const formatted = formatDecimal(value, numberFormat, 2)
  if (formatted === "—" || currency === "OTHER") return formatted

  const isNegative = formatted.startsWith("-")
  const unsigned = isNegative ? formatted.slice(1) : formatted
  return `${isNegative ? "-" : ""}${CURRENCY_SYMBOLS[currency]}${unsigned}`
}

function formatPercent(value: string | null, numberFormat: NumberFormat) {
  return value == null ? "—" : `${formatDecimal(value, numberFormat, 2)}%`
}

function formatCount(value: number, numberFormat: NumberFormat) {
  return new Intl.NumberFormat(numberFormat === "EU" ? "de-DE" : "en-US").format(value)
}

function formatTargetSource(source: TargetSource) {
  if (source === "MANUAL_OVERRIDE") return "Manual Override"
  if (source === "CATALOG_OVERRIDE") return "Product Override"
  return "Store Default"
}

export {
  formatCount,
  formatDecimal,
  formatMoney,
  formatPercent,
  formatTargetSource,
  roundDecimalString,
}
