import { describe, expect, it } from '@jest/globals';
import { colors } from '@/theme';
import { contrastRatio } from '@/utils/contrast';

/** WCAG AA for normal-size text. */
const AA = 4.5;

describe('text colour contrast', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it.each([
    ['text', colors.text],
    ['secondary', colors.secondary],
    ['primaryText', colors.primaryText],
    ['successText', colors.successText],
    ['errorText', colors.errorText],
    ['purpleText', colors.purpleText],
  ])('%s is readable on background and surface', (_name, fg) => {
    expect(contrastRatio(fg, colors.background)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(fg, colors.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps buttons readable', () => {
    // Bold 16px labels: WCAG large-text threshold (3:1) for white on Primary.
    expect(contrastRatio(colors.white, colors.primary)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.text, colors.accent)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.white, colors.purpleText)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps tinted banners readable', () => {
    expect(contrastRatio(colors.primaryText, colors.primarySoft)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.errorText, colors.errorSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.warningText, colors.warningSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.successText, colors.successSoft)).toBeGreaterThanOrEqual(AA);
  });
});
