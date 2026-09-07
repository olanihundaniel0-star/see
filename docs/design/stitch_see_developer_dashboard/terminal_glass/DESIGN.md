---
name: Terminal Glass
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c5c6ca'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#8f9194'
  outline-variant: '#45474a'
  surface-tint: '#c6c6c9'
  primary: '#ffffff'
  on-primary: '#2f3033'
  primary-container: '#e2e2e5'
  on-primary-container: '#636467'
  inverse-primary: '#5d5e61'
  secondary: '#c6c5cf'
  on-secondary: '#2f3038'
  secondary-container: '#4a4b53'
  on-secondary-container: '#bcbbc5'
  tertiary: '#ffffff'
  on-tertiary: '#352f2b'
  tertiary-container: '#ebe0da'
  on-tertiary-container: '#6a635e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e5'
  primary-fixed-dim: '#c6c6c9'
  on-primary-fixed: '#1a1c1e'
  on-primary-fixed-variant: '#454749'
  secondary-fixed: '#e3e1ec'
  secondary-fixed-dim: '#c6c5cf'
  on-secondary-fixed: '#1a1b22'
  on-secondary-fixed-variant: '#46464e'
  tertiary-fixed: '#ebe0da'
  tertiary-fixed-dim: '#cfc4bf'
  on-tertiary-fixed: '#201b17'
  on-tertiary-fixed-variant: '#4c4541'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Space Mono
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.02em
  telemetry-readout:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-code:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  grid-margin: 1rem
  gutter-mobile: 0.75rem
  gutter-desktop: 1.25rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

This design system establishes an unapologetic, high-density computing environment engineered for software architects, systems engineers, and technical purists. The visual identity merges brutalist cyber-terminal mechanics with dark monochromatic glassmorphism: pitch-black absolute foundations, layered smoked zinc transparencies, precision hairline borders, and dense monospace telemetry readouts.

### Aesthetic Principles
- **Monochromatic Rigor:** Zero decorative chromatic noise. The interface relies strictly on calibrated grayscale luminance tiers ranging from pure void `#000000` to high-contrast optical white `#FFFFFF`.
- **Tactical Translucency:** Floating glass slabs utilize deep zinc tinting (`rgba(9, 9, 11, 0.60)` to `rgba(24, 24, 27, 0.40)`) with extreme backdrop diffusion (`backdrop-blur-xl`), imparting the sensation of polished obsidian optical filters over raw background pipelines.
- **Retro-Telemetry Syntax:** Interfaces are treated as live systems. Component headers, telemetry tags, micro-badges, and progress indicators incorporate monospace symbols, prompt brackets (`[● SYS_ONLINE]`, `[■■■□□] 60%`, `[!]`), and directory signatures (`// DEV_HUB`).
- **Engineered Density:** Information architecture prioritizes scannability, structural data matrices, and compact tactile controls over hollow whitespace.

## Colors

The color palette rejects standard hue accents in favor of hyper-tactical grayscale values. Gradients, glows, and surface colors derive entirely from alpha-transparent shifts across the zinc spectrum.

### Surface Architecture
- **Pitch Void (`#000000`):** The unbending substrate. Never softened into dark gray; it grounds the display and eliminates screen edge bleeding on OLED hardware.
- **Glass Tier 1 (`zinc-glass-high`):** Deep panels and background sheets (`rgba(9, 9, 11, 0.65)`).
- **Glass Tier 2 (`zinc-glass-mid`):** Interactive cards, modular cells, and list containers (`rgba(24, 24, 27, 0.45)`).
- **Glass Tier 3 (`zinc-glass-low`):** Input fields, chips, nested states, and button surfaces (`rgba(39, 39, 42, 0.30)`).

### Edges & Borders
All boundaries are defined by crisp, non-feathered 1px hairline edges:
- Resting borders use `rgba(255, 255, 255, 0.08)`.
- Active or high-elevation card borders scale to `rgba(255, 255, 255, 0.14)`.
- Focus, active command inputs, or telemetry triggers ignite with `rgba(255, 255, 255, 0.32)`.

## Typography

The typographic hierarchy enforces a dual-engine protocol: **Space Grotesk** governs structural titles and critical metrics, delivering an incisive, technical aesthetic. **Space Mono** drives all functional copy, readouts, operational telemetry, parameters, and UI status tags.

### Typographic Directives
- **Structural Display:** Headers are set tightly with negative letter spacing (`-0.02em` to `-0.04em`) to maintain an engineered, compact footprint.
- **Monospace Telemetry:** Status badges, dates, salary metrics, memory statistics, and code tokens strictly execute in Space Mono with expanded uppercase tracking (`0.05em` to `0.08em`).
- **Micro-Decorators:** Always prepend data categories with terminal syntax (e.g., `// DEV_HUB`, `SYS.V4`, `> EXEC_PROFILE`).

## Layout & Spacing

Layouts follow a tactical, density-driven modular grid designed for rapid thumb execution on mobile devices while expanding cleanly into multi-column matrices on desktop dashboards.

### Grid & Density Model
- **Mobile (Phone):** 4-column fluid layout with `1rem` (16px) screen margins and `0.75rem` (12px) gutters. Elements prioritize strict vertical card stacks with synchronized internal rhythm.
- **Tablet / Large Mobile:** 8-column layout with `1.5rem` margins and `1rem` gutters.
- **Desktop / Workstation:** 12-column fixed grid with maximum content width capped at `1200px` for optimal cockpit-style telemetry scannability.

### Spacing Cadence
Spacing follows a strict 4px base increment. High-priority cards maintain internal padding of `0.75rem` to `1rem`, avoiding excessive negative space to keep diagnostic telemetry unified and connected.

## Elevation & Depth

Visual depth is achieved through translucent planar layering, optical refraction, and hairline borders rather than traditional drop shadows.

### Elevation Stacking Rules
- **Base Substrate (Z-0):** Unlit `#000000` foundation.
- **Layer 1 - Data Cells (Z-10):** Translucent fill `rgba(9, 9, 11, 0.65)` layered with `backdrop-filter: blur(24px)`, framed with a 1px border of `rgba(255, 255, 255, 0.08)`.
- **Layer 2 - Active Panels & Sheets (Z-20):** Fill `rgba(24, 24, 27, 0.50)` with `backdrop-filter: blur(32px)`. Internal specular gradient: top border receives a 1px highlight of `rgba(255, 255, 255, 0.20)` transitioning to `rgba(255, 255, 255, 0.06)` along the bottom edge.
- **Layer 3 - Floating Modals, Dropdowns & HUD Toasts (Z-30):** Fill `rgba(24, 24, 27, 0.85)` with `backdrop-filter: blur(40px)`, cast over an ambient directional rim glow `box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25), 0 20px 40px -15px rgba(0, 0, 0, 0.9)`.

## Shapes

The design system employs a soft, rigid-radius shape vocabulary (`roundedness: 1`). Elements favor tight precision corners over playful curvature, aligning with physical terminal displays and industrial silicon die packaging.

### Radius Architecture
- **Interactive Controls (Buttons, Inputs, Badges):** Fixed at `0.25rem` (4px).
- **Cards & Data Modules:** Fixed at `0.5rem` (8px) using `rounded-lg`.
- **Overlays, Full-Screen Sheets, and System Modals:** Scaled to `0.75rem` (12px) using `rounded-xl`.

## Components

### Buttons
- **Primary Tactical Action:** Background is high-contrast white `#FFFFFF` with pitch-black `#000000` text in bold Space Mono. Border radius is `0.25rem`. Active state scales down (`scale(0.98)`).
- **Glass / Secondary Button:** Translucent zinc fill (`rgba(39, 39, 42, 0.40)`), 1px border (`rgba(255, 255, 255, 0.14)`), text in `#E4E4E7`. Monospace bracket affixes accompany labels (e.g., `[ EXECUTE ]`).
- **Terminal Ghost Action:** Transparent background with hairline border `rgba(255, 255, 255, 0.10)`. Hover/press fills to `rgba(255, 255, 255, 0.06)`.

### Input Fields
- **Container:** Smoked background `rgba(9, 9, 11, 0.70)`, 1px border `rgba(255, 255, 255, 0.12)`, radius `0.25rem`.
- **Typography:** Placeholder text rendered in muted `#52525B` Space Mono. Input values display in crisp `#FFFFFF`.
- **Active State:** Focus state snaps the border to `rgba(255, 255, 255, 0.40)` and adds a trailing monospace block cursor `_`.

### Cards & Telemetry Pods
- **Structure:** Backdrop blur `blur(24px)`, translucent zinc background `rgba(18, 18, 20, 0.55)`, hairline 1px perimeter border.
- **Card Header Syntax:** Includes tactical ASCII breadcrumbs and status indicators (e.g., `// MEM_ALLOC [● SYS_ONLINE]`).
- **Visual Dividers:** 1px horizontal dividers styled as dashed or solid lines in `rgba(255, 255, 255, 0.08)`.

### Chips, Badges & ASCII Gauges
- **Status Badges:** Compact monospace inline containers enclosed in bracket markers: `[SYS_OK]`, `[WARN: 82%]`, `[DEBUG]`. Background `rgba(255, 255, 255, 0.05)`, border `rgba(255, 255, 255, 0.15)`.
- **Progress Trackers:** Constructed with character-based micro gauges: `[■■■■□□□□] 50%` or segmented 2px high hairline SVG meters.

### Checkboxes & Radios
- **Checkbox:** Square box (`16px × 16px`), radius `2px`, border `1px solid rgba(255, 255, 255, 0.20)`. Checked state displays a solid white square center `■` or high-contrast check mark.
- **Radio Button:** Dual ring with concentric circle indicator (`rgba(255, 255, 255, 0.90)`), maintaining mechanical precision.