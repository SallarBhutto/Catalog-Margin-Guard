import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCw } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { FileRole } from "@/features/file-inspection"
import type { FileSelectionState } from "@/features/file-inspection/use-file-inspection"
import { formatFileSize } from "@/features/file-selection/file-formatting"
import { cn } from "@/lib/utils"

type FilePickerProps = {
  role: FileRole
  title: string
  prompt: string
  state: FileSelectionState
  onChoose: (file: File) => void
}

function FilePicker({ role, title, prompt, state, onChoose }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputId = `${role}-file-input`
  const descriptionId = `${role}-file-description`

  const selectFile = (file: File | undefined) => {
    if (file) onChoose(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    selectFile(event.dataTransfer.files[0])
  }

  const openPicker = () => inputRef.current?.click()

  let fileSummary: { name: string; size: number; format?: string } | null = null
  if (state.status === "inspecting") fileSummary = state.pendingFile
  if (state.status === "ready" || state.status === "warning") {
    fileSummary = state.result.metadata
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] leading-[22px] font-semibold text-text-primary">
          {title}
        </h3>
        <span className="text-xs text-text-muted">CSV or TSV</span>
      </div>

      <label htmlFor={inputId} className="sr-only">
        {prompt}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="sr-only"
        aria-describedby={descriptionId}
        onChange={(event) => selectFile(event.currentTarget.files?.[0])}
      />

      <div
        className={cn(
          "relative min-h-44 rounded-md border border-dashed p-5 transition-colors",
          isDragging
            ? "border-brand bg-brand-soft"
            : state.status === "error"
              ? "border-loss-border bg-loss-soft"
              : "border-border-strong bg-background",
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false)
          }
        }}
        onDrop={handleDrop}
        data-testid={`${role}-file-picker`}
      >
        {state.status === "idle" && (
          <button
            type="button"
            className="absolute inset-0 flex w-full flex-col items-center justify-center rounded-md p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            onClick={openPicker}
            aria-label={prompt}
          >
            <span className="flex size-10 items-center justify-center rounded-md border border-border bg-surface text-brand">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-4 text-sm font-semibold text-text-primary">
              Drop {role} file here
            </span>
            <span
              id={descriptionId}
              className="mt-1 text-xs leading-[18px] text-text-muted"
            >
              or choose from your computer
            </span>
          </button>
        )}

        {state.status === "inspecting" && fileSummary && (
          <div
            className="flex h-full min-h-32 flex-col items-center justify-center text-center"
            role="status"
          >
            <Spinner className="size-5 text-brand" aria-hidden="true" />
            <p className="mt-4 max-w-full truncate text-sm font-semibold text-text-primary">
              Inspecting locally…
            </p>
            <p className="mt-1 max-w-full truncate text-xs text-text-muted">
              {fileSummary.name} · {formatFileSize(fileSummary.size)}
            </p>
          </div>
        )}

        {(state.status === "ready" || state.status === "warning") && fileSummary && (
          <div className="flex min-h-32 flex-col justify-between gap-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-brand">
                <FileSpreadsheet className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className="truncate text-sm font-semibold text-text-primary"
                  title={fileSummary.name}
                >
                  {fileSummary.name}
                </p>
                <p className="mt-1 text-xs tabular-nums text-text-muted">
                  {formatFileSize(fileSummary.size)} · {fileSummary.format}
                </p>
                <p
                  className={cn(
                    "mt-3 flex items-center gap-1.5 text-[13px] font-medium",
                    state.status === "warning" ? "text-review" : "text-ok",
                  )}
                >
                  {state.status === "warning" ? (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  {state.status === "warning" ? "Ready with warning" : "Ready"}
                </p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="small" onClick={openPicker}>
              <RefreshCw aria-hidden="true" />
              Change
            </Button>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex min-h-32 flex-col justify-between gap-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-loss"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  We couldn't use this file.
                </p>
                <p className="mt-1 text-xs leading-[18px] text-text-secondary">
                  {state.error.userMessage}
                </p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="small" onClick={openPicker}>
              Choose another file
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export { FilePicker }
