import {
  ANALYSIS_METADATA_SQL,
  ANALYSIS_RESULTS_RELATION,
  createPriceForTargetMarginExpression,
  createProductStatusExpression,
} from "@/features/analysis/margin-analysis-sql"

const ROW_EXISTS_SQL = `SELECT count(*)::UBIGINT AS total_rows
FROM ${ANALYSIS_RESULTS_RELATION}
WHERE catalog_source_row_id = CAST(? AS UBIGINT);`

const manualTarget = "CAST(? AS DECIMAL(7,4))"

const APPLY_MANUAL_OVERRIDE_SQL = `UPDATE ${ANALYSIS_RESULTS_RELATION}
SET
  manual_override_margin_pct = ${manualTarget},
  effective_target_margin_pct = ${manualTarget},
  target_source = 'MANUAL_OVERRIDE',
  price_for_target_margin = ${createPriceForTargetMarginExpression(
    "supplier_cost",
    manualTarget,
  )},
  status = ${createProductStatusExpression(
    "supplier_cost",
    "selling_price",
    manualTarget,
  )}
WHERE catalog_source_row_id = CAST(? AS UBIGINT);`

const fallbackTarget = "COALESCE(catalog_override_margin_pct, store_default_margin_pct)"
const fallbackSource = `CASE
    WHEN catalog_override_margin_pct IS NOT NULL THEN 'CATALOG_OVERRIDE'
    ELSE 'STORE_DEFAULT'
  END`

const RESTORE_FALLBACK_ASSIGNMENTS = `manual_override_margin_pct = NULL,
  effective_target_margin_pct = ${fallbackTarget},
  target_source = ${fallbackSource},
  price_for_target_margin = ${createPriceForTargetMarginExpression(
    "supplier_cost",
    fallbackTarget,
  )},
  status = ${createProductStatusExpression(
    "supplier_cost",
    "selling_price",
    fallbackTarget,
  )}`

const REMOVE_MANUAL_OVERRIDE_SQL = `UPDATE ${ANALYSIS_RESULTS_RELATION}
SET ${RESTORE_FALLBACK_ASSIGNMENTS}
WHERE catalog_source_row_id = CAST(? AS UBIGINT);`

const CLEAR_ALL_MANUAL_OVERRIDES_SQL = `UPDATE ${ANALYSIS_RESULTS_RELATION}
SET ${RESTORE_FALLBACK_ASSIGNMENTS}
WHERE manual_override_margin_pct IS NOT NULL;`

export {
  ANALYSIS_METADATA_SQL,
  APPLY_MANUAL_OVERRIDE_SQL,
  CLEAR_ALL_MANUAL_OVERRIDES_SQL,
  REMOVE_MANUAL_OVERRIDE_SQL,
  ROW_EXISTS_SQL,
}
