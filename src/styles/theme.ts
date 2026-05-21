/**
 * ChemistCare PrescriberOS — Design Tokens
 *
 * Single source of truth for color, typography, spacing, elevation, radius.
 * CSS variables (HSL triplets) live in `src/index.css`. Tailwind references
 * those variables in `tailwind.config.ts`. This file is the canonical
 * TypeScript reference for non-CSS consumers (charts, canvas, sketch pad,
 * generated PDFs, etc.).
 *
 * Rules:
 *   - One primary clinical color (deep teal). One signal color (coral) for
 *     alerts/errors only.
 *   - Neutral cool grayscale. No warm greys.
 *   - 4px base spacing grid. Use 16 or 24 for component padding.
 *   - Sharp, minimal shadows. shadow-sm cards, shadow-md modals only.
 *   - Radius: 6px UI, 8px cards, full for pills.
 */

// ─── Color ───────────────────────────────────────────────────────────────────
// HSL triplets (matching CSS variable format in index.css).
export const colorTokens = {
  // Primary — Deep Clinical Teal #0F5B5E
  primary: '182 72% 21%',
  primaryForeground: '0 0% 100%',

  // Signal — Coral #E85D4E (alerts/errors only; never CTAs)
  signal: '7 78% 60%',
  signalForeground: '0 0% 100%',

  // Neutral scale (no warm tint)
  neutral: {
    0: '0 0% 100%',       // #FFFFFF
    50: '0 0% 98%',       // #FAFAFA
    100: '0 0% 96%',      // #F5F5F5
    200: '0 0% 90%',      // #E5E5E5
    300: '0 0% 83%',      // #D4D4D4
    400: '0 0% 64%',      // #A3A3A3
    500: '0 0% 45%',      // #737373
    600: '0 0% 32%',      // #525252
    700: '0 0% 25%',      // #404040
    800: '0 0% 15%',      // #262626
    900: '0 0% 9%',       // #171717
    950: '0 0% 4%',       // #0A0A0A
  },

  // Clinical status — used sparingly, only for clinical signals
  clinical: {
    safe: '155 68% 32%',
    safeBg: '155 40% 96%',
    warning: '38 92% 45%',
    warningBg: '38 70% 96%',
    danger: '7 78% 60%',        // same as signal
    dangerBg: '7 60% 97%',
    info: '182 72% 21%',         // same as primary
    infoBg: '182 30% 96%',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    heading: 'Inter, system-ui, -apple-system, sans-serif',
    mono: '"Roboto Mono", "JetBrains Mono", monospace', // Roboto Mono reserved for clinical note output
  },
  // Disciplined scale — no arbitrary sizes
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1.5' }],     // 12
    sm: ['0.875rem', { lineHeight: '1.5' }],    // 14
    base: ['1rem', { lineHeight: '1.5' }],      // 16
    lg: ['1.125rem', { lineHeight: '1.4' }],    // 18
    xl: ['1.25rem', { lineHeight: '1.3' }],     // 20
    '2xl': ['1.5rem', { lineHeight: '1.2' }],   // 24
    '3xl': ['1.875rem', { lineHeight: '1.2' }], // 30
    '4xl': ['2.25rem', { lineHeight: '1.2' }],  // 36
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// 4px base. Tailwind's default scale already matches this — we only document
// the approved component padding values to discourage drift.
export const spacing = {
  base: 4,
  componentPaddingSm: 16, // p-4
  componentPaddingMd: 24, // p-6
} as const;

// ─── Elevation ───────────────────────────────────────────────────────────────
// Sharp, minimal, neutral shadows only. No colored shadows.
export const elevation = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)', // modals/dropdowns only
} as const;

// ─── Radius ──────────────────────────────────────────────────────────────────
export const radius = {
  md: '0.375rem', // 6px — UI elements (buttons, inputs)
  lg: '0.5rem',   // 8px — cards, panels
  full: '9999px', // pills only
} as const;

export const theme = {
  color: colorTokens,
  typography,
  spacing,
  elevation,
  radius,
} as const;

export type Theme = typeof theme;
