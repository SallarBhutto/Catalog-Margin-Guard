import "@testing-library/jest-dom/vitest"

// Tests that opt into the Node environment have no window to patch.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
}
