import {
  getCurrentLocation,
  getCurrentPathname,
  navigateTo,
  replaceRoute,
  subscribeToRoute,
} from "@/app/app-router"

describe("application client-side router", () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    window.history.replaceState({}, "", "/")
    // jsdom reports any real document navigation (location.href assignment) as an error.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it("pushes history entries without document navigation and notifies subscribers", () => {
    const pushState = vi.spyOn(window.history, "pushState")
    const listener = vi.fn()
    const unsubscribe = subscribeToRoute(listener)

    navigateTo("/check")

    expect(pushState).toHaveBeenCalledWith({}, "", "http://localhost:3000/check")
    expect(getCurrentPathname()).toBe("/check")
    expect(getCurrentLocation()).toBe("/check")
    expect(listener).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()

    unsubscribe()
    navigateTo("/")
    expect(listener).toHaveBeenCalledTimes(1)
    pushState.mockRestore()
  })

  it("treats navigation to the current URL as a no-op", () => {
    const pushState = vi.spyOn(window.history, "pushState")
    const listener = vi.fn()
    const unsubscribe = subscribeToRoute(listener)
    window.history.replaceState({}, "", "/check")

    navigateTo("/check")
    navigateTo("http://localhost:3000/check")

    expect(pushState).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    pushState.mockRestore()
  })

  it("replaces the current entry without document navigation", () => {
    const replaceState = vi.spyOn(window.history, "replaceState")
    const pushState = vi.spyOn(window.history, "pushState")
    const listener = vi.fn()
    const unsubscribe = subscribeToRoute(listener)

    replaceRoute("/check?state=1#top")

    expect(replaceState).toHaveBeenCalledWith(
      {},
      "",
      "http://localhost:3000/check?state=1#top",
    )
    expect(pushState).not.toHaveBeenCalled()
    expect(getCurrentLocation()).toBe("/check?state=1#top")
    expect(listener).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
    unsubscribe()
    replaceState.mockRestore()
    pushState.mockRestore()
  })

  it("notifies subscribers on browser history traversal", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToRoute(listener)

    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("never navigates the document to another origin", () => {
    const pushState = vi.spyOn(window.history, "pushState")
    const replaceState = vi.spyOn(window.history, "replaceState")
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    navigateTo("https://accounts.example.com/sign-in")
    replaceRoute("https://accounts.example.com/sign-in")

    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(window.location.origin).toBe("http://localhost:3000")
    expect(getCurrentPathname()).toBe("/")
    expect(consoleError).not.toHaveBeenCalled()
    pushState.mockRestore()
    replaceState.mockRestore()
  })
})
