/**
 * Family Habit design tokens — "Modern Playful Minimalism".
 * One accent per screen: Primary (orange) for actions/XP, Purple only for quests & special rewards.
 */
export const colors = {
  primary: '#F97316',
  primarySoft: '#FFEDD5',
  primaryPressed: '#EA580C',
  background: '#FFF9F3',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF3E6',
  text: '#1E293B',
  secondary: '#64748B',
  border: '#F1E4D6',
  success: '#22C55E',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningText: '#92400E',
  error: '#EF4444',
  errorSoft: '#FEE2E2',
  purple: '#8B5CF6',
  purpleSoft: '#EDE9FE',
  /**
   * Text-only shades of the palette (WCAG AA ≥ 4.5:1 on the light surfaces). The palette
   * colours stay for fills, icons and progress; small text uses these.
   */
  primaryText: '#C2410C',
  successText: '#15803D',
  errorText: '#B91C1C',
  purpleText: '#6D28D9',
  white: '#FFFFFF',
  overlay: 'rgba(30, 41, 59, 0.45)',
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
    shadowColor: '#7C2D12',
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
