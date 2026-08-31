import { useCallback, useEffect, useRef, useState } from "react"

import { FileInspectionError } from "@/features/file-inspection/file-inspection-error"
import { fileInspectionService } from "@/features/file-inspection/file-inspection-service"
import type {
  FileInspectionResult,
  FileRole,
} from "@/features/file-inspection/file-inspection-types"

type FileSelectionState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "inspecting"
      pendingFile: { name: string; size: number }
    }>
  | Readonly<{
      status: "ready" | "warning"
      result: FileInspectionResult
    }>
  | Readonly<{
      status: "error"
      error: FileInspectionError
    }>

function useFileInspection(role: FileRole) {
  const [state, setState] = useState<FileSelectionState>({ status: "idle" })
  const operationId = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      operationId.current += 1
      void fileInspectionService.release(role)
    }
  }, [role])

  const chooseFile = useCallback(
    async (file: File) => {
      const currentOperation = ++operationId.current
      setState({
        status: "inspecting",
        pendingFile: { name: file.name, size: file.size },
      })

      try {
        const result = await fileInspectionService.inspect(role, file)
        if (!mounted.current || currentOperation !== operationId.current) return
        setState({ status: result.warning ? "warning" : "ready", result })
      } catch (error) {
        if (!mounted.current || currentOperation !== operationId.current) return
        setState({
          status: "error",
          error:
            error instanceof FileInspectionError
              ? error
              : new FileInspectionError("UNKNOWN_PROCESSING_ERROR", { cause: error }),
        })
      }
    },
    [role],
  )

  const clearFile = useCallback(async () => {
    operationId.current += 1
    setState({ status: "idle" })
    await fileInspectionService.release(role)
  }, [role])

  return { state, chooseFile, clearFile }
}

export { useFileInspection }
export type { FileSelectionState }
