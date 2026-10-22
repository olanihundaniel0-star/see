export const theme = {
  colors: {
    background: "#131313",
    surface: "#1f1f1f",
    surfaceMid: "rgba(24, 24, 27, 0.45)",
    surfaceLow: "rgba(39, 39, 42, 0.30)",
    border: "rgba(255, 255, 255, 0.10)",
    borderActive: "rgba(255, 255, 255, 0.20)",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
    textDim: "#A1A1AA",
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
    errorSurface: "#3c2422",
    outline: "#8f9194",
    outlineVariant: "#45474a",
    onSurface: "#e2e2e2",
    onSurfaceVariant: "#c5c6ca",
    placeholder: "#A1A1AA",
    // Terminal Glass border tokens
    borderResting: "rgba(255, 255, 255, 0.08)",
    borderActiveGlass: "rgba(255, 255, 255, 0.14)",
    borderInput: "rgba(255, 255, 255, 0.12)",
    borderFocus: "rgba(255, 255, 255, 0.32)",
    borderFocusStrong: "rgba(255, 255, 255, 0.40)",
    scrim: "rgba(0, 0, 0, 0.70)",
    switchTrackActive: "#77777e",
    // Blur-friendly glass fill (Z-10 / telemetry pods)
    glassBlur: "rgba(18, 18, 20, 0.55)"
  },
  radius: {
    controls: 4,
    cards: 8,
    sheets: 12
  },
  ascii: {
    // Legacy aliases; new screens use plain-language headings.
    online: "[● SYS_ONLINE]",
    devHub: "// DEV_HUB",
    pipeline: "// PIPELINE",
    radar: "// RADAR",
    vault: "// VAULT",
    alerts: "// ALERTS",
    dossier: "// DOSSIER"
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  layout: { screenPadding: 16, maxWidth: 760, touchTarget: 48 },
  type: {
    title: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
    heading: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 20, lineHeight: 26 },
    cardTitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 18, lineHeight: 24 },
    body: { fontFamily: "SpaceGrotesk_400Regular", fontSize: 16, lineHeight: 24 },
    label: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 14, lineHeight: 20 },
    meta: { fontFamily: "SpaceGrotesk_400Regular", fontSize: 13, lineHeight: 19 },
    code: { fontFamily: "SpaceMono_400Regular", fontSize: 12, lineHeight: 18 }
  }
} as const;
