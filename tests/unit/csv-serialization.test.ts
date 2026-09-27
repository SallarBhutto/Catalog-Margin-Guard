import {
  CSV_BYTE_ORDER_MARK,
  CSV_LINE_TERMINATOR,
  joinCsvRow,
  neutralizeSpreadsheetFormula,
  serializeCsvDecimal,
  serializeGeneratedCsvText,
  serializeUntrustedCsvText,
} from "@/features/exports/csv-serialization"

const UNICODE_IDENTIFIER = `${String.fromCodePoint(0xdc)}BER-${String.fromCodePoint(0xdf, 0x2d, 0x65e5, 0x672c, 0x2d, 0x1f9ea)}`
const FULL_WIDTH_TRIGGERS = [0xff1d, 0xff0b, 0xff0d, 0xff20].map((codePoint) =>
  String.fromCodePoint(codePoint),
)
/** Tab, CR, LF, NUL, no-break space, zero-width space, and the byte-order mark. */
const HIDDEN_PREFIXES = [0x20, 0x09, 0x0d, 0x0a, 0x00, 0xa0, 0x200b, 0xfeff].map(
  (codePoint) => String.fromCodePoint(codePoint),
)

describe("CSV serialization", () => {
  it("writes ordinary identifiers verbatim, preserving leading zeros and Unicode", () => {
    expect(serializeUntrustedCsvText("001234")).toBe("001234")
    expect(serializeUntrustedCsvText("SKU_1/2.A")).toBe("SKU_1/2.A")
    expect(serializeUntrustedCsvText(UNICODE_IDENTIFIER)).toBe(UNICODE_IDENTIFIER)
    expect(serializeUntrustedCsvText("MID-DASH=OK")).toBe("MID-DASH=OK")
  })

  it("quotes commas, quotes, embedded newlines, and surrounding whitespace", () => {
    expect(serializeUntrustedCsvText("A,B")).toBe('"A,B"')
    expect(serializeUntrustedCsvText('12" pipe')).toBe('"12"" pipe"')
    expect(serializeUntrustedCsvText("LINE1\nLINE2")).toBe('"LINE1\nLINE2"')
    expect(serializeUntrustedCsvText("LINE1\r\nLINE2")).toBe('"LINE1\r\nLINE2"')
    expect(serializeUntrustedCsvText(" padded ")).toBe('" padded "')
  })

  it("serializes empty and missing text as an empty field", () => {
    expect(serializeUntrustedCsvText("")).toBe("")
    expect(serializeUntrustedCsvText(null)).toBe("")
    expect(serializeUntrustedCsvText(undefined)).toBe("")
  })

  it("neutralizes every formula trigger with a quoted apostrophe prefix", () => {
    for (const trigger of ["=", "+", "-", "@", ...FULL_WIDTH_TRIGGERS]) {
      expect(neutralizeSpreadsheetFormula(`${trigger}SKU`)).toEqual({
        text: `'${trigger}SKU`,
        neutralized: true,
      })
    }
    expect(serializeUntrustedCsvText("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`)
    expect(serializeUntrustedCsvText('=1+"x"')).toBe(`"'=1+""x"""`)
    expect(serializeUntrustedCsvText("-5")).toBe(`"'-5"`)
    expect(serializeUntrustedCsvText("+44 20")).toBe(`"'+44 20"`)
    expect(serializeUntrustedCsvText("@SUM(A1)")).toBe(`"'@SUM(A1)"`)
  })

  it("detects triggers hidden behind whitespace, control, and invisible characters", () => {
    for (const prefix of [...HIDDEN_PREFIXES, HIDDEN_PREFIXES.join("")]) {
      const value = `${prefix}=cmd|'/c calc'!A0`
      expect(neutralizeSpreadsheetFormula(value).neutralized).toBe(true)
      // The original characters are kept; only the apostrophe and CSV quoting are added.
      expect(serializeUntrustedCsvText(value)).toBe(`"'${value}"`)
    }
  })

  it("neutralizes a leading tab, carriage return, or line feed as OWASP requires", () => {
    for (const control of ["\t", "\r", "\n"]) {
      expect(neutralizeSpreadsheetFormula(`${control}PLAIN-SKU`)).toEqual({
        text: `'${control}PLAIN-SKU`,
        neutralized: true,
      })
      expect(serializeUntrustedCsvText(`${control}PLAIN-SKU`)).toBe(
        `"'${control}PLAIN-SKU"`,
      )
    }
  })

  it("leaves text alone when the first significant character is not a trigger", () => {
    expect(neutralizeSpreadsheetFormula("A=1")).toEqual({
      text: "A=1",
      neutralized: false,
    })
    expect(neutralizeSpreadsheetFormula(" SPACE-LED")).toEqual({
      text: " SPACE-LED",
      neutralized: false,
    })
    expect(neutralizeSpreadsheetFormula("   ").neutralized).toBe(false)
    expect(neutralizeSpreadsheetFormula("'=already").neutralized).toBe(false)
  })

  it("keeps generated decimals numeric, including negative margins", () => {
    expect(serializeCsvDecimal("96.0000")).toBe("96.00")
    expect(serializeCsvDecimal("96.4300")).toBe("96.43")
    expect(serializeCsvDecimal("96.4375")).toBe("96.4375")
    expect(serializeCsvDecimal("96.4370")).toBe("96.437")
    expect(serializeCsvDecimal("120.00")).toBe("120.00")
    // Two-decimal prices for target margin are written exactly; they are never re-rounded.
    expect(serializeCsvDecimal("107.16")).toBe("107.16")
    expect(serializeCsvDecimal("100.10")).toBe("100.10")
    expect(serializeCsvDecimal("0.01")).toBe("0.01")
    expect(serializeCsvDecimal("-1.3423")).toBe("-1.3423")
    expect(serializeCsvDecimal("-0.5000")).toBe("-0.50")
    expect(serializeCsvDecimal("0.2000")).toBe("0.20")
    expect(serializeCsvDecimal("1000000000000.0000")).toBe("1000000000000.00")
    expect(serializeCsvDecimal("7")).toBe("7")
  })

  it("refuses to write non-decimal text into a numeric column", () => {
    for (const value of ["", "abc", "=1+1", "1e5", "1,5", "NaN", " 1", "--1"]) {
      expect(() => serializeCsvDecimal(value)).toThrow(/decimal/i)
    }
  })

  it("joins rows with CRLF and exposes the UTF-8 byte-order mark", () => {
    expect(CSV_LINE_TERMINATOR).toBe("\r\n")
    expect(CSV_BYTE_ORDER_MARK.codePointAt(0)).toBe(0xfeff)
    expect(CSV_BYTE_ORDER_MARK).toHaveLength(1)
    expect(joinCsvRow(["a", '"b,c"', "", "-1.50"])).toBe('a,"b,c",,-1.50\r\n')
    expect(serializeGeneratedCsvText("Store Default")).toBe("Store Default")
    expect(serializeGeneratedCsvText("LOSS")).toBe("LOSS")
  })
})
