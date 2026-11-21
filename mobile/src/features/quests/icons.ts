import { CalendarRange, CheckCheck, Heart, LucideIcon, Target, Users } from 'lucide-react-native';

/** Quest icon keys from the seed catalog → lucide icons (static lookup, never created in render). */
export const QUEST_ICONS: Record<string, LucideIcon> = {
  target: Target,
  'check-check': CheckCheck,
  heart: Heart,
  users: Users,
  'calendar-range': CalendarRange,
};
