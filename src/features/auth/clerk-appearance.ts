const clerkVariables = {
  colorPrimary: "#2563eb",
  colorForeground: "#0f172a",
  colorMutedForeground: "#64748b",
  colorBackground: "#ffffff",
  colorInputBackground: "#ffffff",
  colorInputText: "#0f172a",
  colorNeutral: "#475569",
  borderRadius: "0.5rem",
  fontFamily:
    '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: "0.875rem",
} as const

const clerkProviderAppearance = {
  variables: clerkVariables,
  cssLayerName: "clerk",
} as const

const clerkSignInAppearance = {
  variables: clerkVariables,
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      border: 0,
      borderRadius: 0,
      boxShadow: "none",
    },
    card: {
      width: "100%",
      padding: 0,
      border: 0,
      borderRadius: 0,
      background: "transparent",
      boxShadow: "none",
    },
    header: {
      display: "none",
    },
    main: {
      width: "100%",
      gap: "1rem",
    },
    socialButtonsBlockButton: {
      minHeight: "2.5rem",
      border: "1px solid #cbd5e1 !important",
      borderRadius: "0.5rem",
      background: "#ffffff",
      color: "#0f172a",
      boxShadow: "none !important",
      "&:hover, &:focus": {
        background: "#f8fafc",
      },
    },
    socialButtonsBlockButtonText: {
      color: "#0f172a",
      fontWeight: 600,
    },
    dividerLine: {
      background: "#e2e8f0",
    },
    dividerText: {
      color: "#64748b",
    },
    formFieldLabel: {
      color: "#0f172a",
      fontSize: "0.8125rem",
      fontWeight: 500,
    },
    formFieldInput: {
      minHeight: "2.5rem",
      border: "1px solid #cbd5e1 !important",
      borderRadius: "0.5rem",
      background: "#ffffff",
      color: "#0f172a",
      boxShadow: "none !important",
    },
    formButtonPrimary: {
      minHeight: "2.5rem",
      borderRadius: "0.5rem",
      background: "#2563eb",
      fontWeight: 600,
      boxShadow: "none !important",
      "&:hover, &:focus": {
        background: "#1d4ed8",
      },
    },
    footer: {
      width: "100%",
      padding: "0.25rem 0 0",
      background: "transparent",
    },
    footerAction: {
      margin: 0,
    },
    footerActionText: {
      color: "#475569",
    },
    footerActionLink: {
      color: "#2563eb",
      fontWeight: 600,
    },
    identityPreview: {
      border: "1px solid #e2e8f0",
      borderRadius: "0.5rem",
      background: "#f1f5f9",
      boxShadow: "none",
    },
    formFieldErrorText: {
      color: "#b91c1c",
    },
    alert: {
      border: "1px solid #fecaca",
      borderRadius: "0.5rem",
      background: "#fef2f2",
      color: "#991b1b",
    },
  },
} as const

const clerkUserButtonAppearance = {
  variables: clerkVariables,
  elements: {
    userButtonTrigger:
      "min-h-10 min-w-10 rounded-md outline-none focus:shadow-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    userButtonAvatarBox: "size-8",
    userButtonPopoverCard: "rounded-lg border border-border bg-surface shadow-floating",
    userButtonPopoverActionButton: "min-h-10 text-text-primary hover:bg-surface-subtle",
    userButtonPopoverActionButtonText: "text-[13px] font-medium",
    userButtonPopoverFooter: "hidden",
  },
} as const

export { clerkProviderAppearance, clerkSignInAppearance, clerkUserButtonAppearance }
