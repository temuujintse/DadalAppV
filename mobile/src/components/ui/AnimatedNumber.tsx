import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { AppText, AppTextProps } from './AppText';

/**
 * Counts from the previous value to the new one (XP counter). Jumps straight to the value when
 * Reduce Motion is on. Screen readers always get the final number.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  suffix = '',
  ...textProps
}: AppTextProps & { value: number; duration?: number; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const start = from.current;
    from.current = value;
    if (start === value) return;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        setShown(value);
        return;
      }
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round(start + (value - start) * eased));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <AppText {...textProps} accessibilityLabel={`${value}${suffix}`}>
      {shown}
      {suffix}
    </AppText>
  );
}
