export const theme = {
  colors: {
    background: "#000000",
    surface: "rgba(9, 9, 11, 0.60)",
    surfaceMid: "rgba(24, 24, 27, 0.45)",
    surfaceLow: "rgba(39, 39, 42, 0.30)",
    border: "rgba(255, 255, 255, 0.10)",
    borderActive: "rgba(255, 255, 255, 0.20)",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
    textDim: "#71717A",
    // Terminal Glass palette (solid ramp)
    surfaceLowest: "#0e0e0e",
    surfaceLowSolid: "#1b1b1b",
    surfaceContainer: "#1f1f1f",
    surfaceHigh: "#2a2a2a",
    surfaceHighest: "#353535",
    primary: "#ffffff",
    onPrimary: "#2f3033",
    error: "#ffb4ab",
    errorContainer: "#93000a",
    outline: "#8f9194",
    outlineVariant: "#45474a",
    onSurface: "#e2e2e2",
    onSurfaceVariant: "#c5c6ca",
    placeholder: "#52525B",
    // Terminal Glass border tokens
    borderResting: "rgba(255, 255, 255, 0.08)",
    borderActiveGlass: "rgba(255, 255, 255, 0.14)",
    borderInput: "rgba(255, 255, 255, 0.12)",
    borderFocus: "rgba(255, 255, 255, 0.32)",
    borderFocusStrong: "rgba(255, 255, 255, 0.40)",
    // Blur-friendly glass fill (Z-10 / telemetry pods)
    glassBlur: "rgba(18, 18, 20, 0.55)"
  },
  radius: {
    controls: 4,
    cards: 8,
    sheets: 12
  },
  ascii: {
    online: "[● SYS_ONLINE]",
    devHub: "// DEV_HUB",
    pipeline: "// PIPELINE",
    radar: "// RADAR",
    vault: "// VAULT",
    alerts: "// ALERTS",
    dossier: "// DOSSIER"
  }
} as const;
