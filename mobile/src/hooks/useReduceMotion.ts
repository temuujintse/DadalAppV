import { useReducedMotion } from 'react-native-reanimated';
import { useMotionStore } from '@/store/motion.store';

/** True when motion should be minimal: the system setting or the in-app option. */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const reduce = useMotionStore((s) => s.preference === 'reduce');
  return system || reduce;
}
