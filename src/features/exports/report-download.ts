const OBJECT_URL_LIFETIME_MS = 60_000

/** Hands a locally generated file to the browser's download manager. Nothing is uploaded. */
function deliverBrowserDownload(file: Blob, filename: string) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // The browser needs the URL until the download has started; release the data afterwards.
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS)
}

export { deliverBrowserDownload }
