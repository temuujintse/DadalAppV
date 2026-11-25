/**
 * Family Habit design tokens — "Modern Playful Minimalism".
 * Brand palette (2026-11-25): Primary #6C63FF, Secondary #8B85FF, Accent #FFB84D,
 * Background #F7F7FC, Text #25243A. Primary for actions/XP; Accent for quests & special rewards.
 */
export const colors = {
  primary: '#6C63FF',
  primarySoft: '#EEEDFF',
  primaryPressed: '#5A52E0',
  background: '#F7F7FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEFF8',
  text: '#25243A',
  /** Muted text (captions, hints) — readable grey-violet, not the brand Secondary. */
  secondary: '#66657C',
  border: '#E6E5F2',
  /** Brand Accent: quest / special-reward buttons (with dark text), highlights. */
  accent: '#FFB84D',
  success: '#22C55E',
  successSoft: '#DCFCE7',
  warning: '#FFB84D',
  warningSoft: '#FFF3DC',
  warningText: '#8A5A00',
  error: '#EF4444',
  errorSoft: '#FEE2E2',
  /** Brand Secondary: AI / coach fills and icons. */
  purple: '#8B85FF',
  purpleSoft: '#F0EFFF',
  /**
   * Text-only shades of the palette (WCAG AA ≥ 4.5:1 on the light surfaces). The palette
   * colours stay for fills, icons and progress; small text uses these.
   */
  primaryText: '#5249D8',
  successText: '#15803D',
  errorText: '#B91C1C',
  purpleText: '#5B54D6',
  white: '#FFFFFF',
  overlay: 'rgba(37, 36, 58, 0.45)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/** Type scale. Line heights are generous for Mongolian Cyrillic diacritics (Ө, Ү, Ё). */
export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#25243A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;

/** Motion durations (ms) from the UX spec. */
export const motion = {
  tab: 220,
  modal: 200,
  press: 120,
  stateChange: 250,
} as const;

export type TypographyVariant = keyof typeof typography;
