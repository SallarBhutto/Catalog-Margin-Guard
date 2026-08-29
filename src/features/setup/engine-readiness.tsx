import { AlertCircle, CheckCircle2 } from "lucide-react"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { duckDBEngine } from "@/lib/duckdb"
import type { DuckDBEngineError } from "@/lib/duckdb/duckdb-error"

type HealthState =
  | { status: "checking" }
  | { status: "healthy"; value: 42 }
  | { status: "error"; error: DuckDBEngineError }

function EngineReadiness() {
  const snapshot = useSyncExternalStore(
    duckDBEngine.subscribe,
    duckDBEngine.getSnapshot,
    duckDBEngine.getSnapshot,
  )
  const [health, setHealth] = useState<HealthState>({ status: "checking" })

  const prepare = useCallback(async (reset = false) => {
    setHealth({ status: "checking" })

    try {
      if (reset) await duckDBEngine.reset()
      else await duckDBEngine.initialize()

      const value = await duckDBEngine.healthCheck()
      setHealth({ status: "healthy", value })
    } catch (error) {
      setHealth({
        status: "error",
        error: error as DuckDBEngineError,
      })
    }
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        if (duckDBEngine.getSnapshot().state === "disposed") {
          await duckDBEngine.reset()
        } else {
          await duckDBEngine.initialize()
        }
        const value = await duckDBEngine.healthCheck()
        if (active) setHealth({ status: "healthy", value })
      } catch (error) {
        if (active) {
          setHealth({ status: "error", error: error as DuckDBEngineError })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [])

  if (health.status === "error") {
    return (
      <div
        className="flex flex-col gap-3 rounded-md border border-loss-border bg-loss-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-loss" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              We couldn't prepare local analysis.
            </p>
            <p className="mt-1 text-xs leading-[18px] text-text-secondary">
              {health.error.userMessage}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => void prepare(true)}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (health.status === "healthy") {
    return (
      <div
        className="flex items-center gap-2 text-[13px] leading-[18px] text-text-secondary"
        data-testid="engine-readiness"
        data-engine-state={snapshot.state}
        data-engine-bundle={snapshot.bundleType ?? undefined}
        data-initialization-ms={snapshot.initializationMs ?? undefined}
        data-health-value={health.value}
        role="status"
      >
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden="true" />
        Local analysis is ready.
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 text-[13px] leading-[18px] text-text-secondary"
      data-testid="engine-readiness"
      data-engine-state={snapshot.state}
      role="status"
    >
      <Spinner className="text-brand" aria-hidden="true" />
      Preparing local analysis engine…
    </div>
  )
}

export { EngineReadiness }
