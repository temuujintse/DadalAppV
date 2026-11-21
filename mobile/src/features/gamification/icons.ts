import {
  Blocks,
  CalendarCheck,
  Crown,
  Flame,
  Footprints,
  LucideIcon,
  PawPrint,
  Trophy,
  Users,
} from 'lucide-react-native';

/** Achievement icon keys (from the seed catalog) → lucide icons. */
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  crown: Crown,
  blocks: Blocks,
  users: Users,
  'calendar-check': CalendarCheck,
  'paw-print': PawPrint,
  trophy: Trophy,
};
