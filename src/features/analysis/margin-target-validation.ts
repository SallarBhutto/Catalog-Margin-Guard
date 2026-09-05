import { z } from "zod"

const MARGIN_PERCENTAGE_ERROR = "Margin must be between 0% and 95%."

const marginPercentageTextSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,4})?$/, MARGIN_PERCENTAGE_ERROR)
  .refine((value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 95
  }, MARGIN_PERCENTAGE_ERROR)

function validateMarginPercentageText(value: string) {
  const result = marginPercentageTextSchema.safeParse(value)
  return result.success
    ? ({ valid: true, value: result.data } as const)
    : ({ valid: false, error: MARGIN_PERCENTAGE_ERROR } as const)
}

export {
  MARGIN_PERCENTAGE_ERROR,
  marginPercentageTextSchema,
  validateMarginPercentageText,
}
