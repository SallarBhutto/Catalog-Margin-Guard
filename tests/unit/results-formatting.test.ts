import {
  formatMoney,
  formatPercent,
  roundDecimalString,
} from "@/features/results/results-formatting"

describe("result display formatting", () => {
  it("rounds decimal strings for display without unsafe number conversion", () => {
    expect(roundDecimalString("9007199254740993.125", 2)).toEqual({
      sign: "",
      whole: "9007199254740993",
      fraction: "13",
    })
    expect(formatMoney("9007199254740993.125", "USD", "US")).toBe(
      "$9,007,199,254,740,993.13",
    )
  })

  it("uses the configured number convention and deliberate null percentage", () => {
    expect(formatMoney("-151.5", "EUR", "EU")).toBe("-€151,50")
    expect(formatPercent("8.571428571428", "US")).toBe("8.57%")
    expect(formatPercent(null, "US")).toBe("—")
  })
})
