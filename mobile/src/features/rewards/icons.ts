import {
  Bike,
  Book,
  Film,
  Gamepad2,
  Gift,
  IceCreamCone,
  LucideIcon,
  Music,
  Pizza,
  Star,
  Trees,
} from 'lucide-react-native';

/** Keys mirror backend REWARD_ICON_KEYS. */
export const REWARD_ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  film: Film,
  pizza: Pizza,
  'gamepad-2': Gamepad2,
  'ice-cream': IceCreamCone,
  trees: Trees,
  book: Book,
  music: Music,
  bike: Bike,
  star: Star,
};

/** One-tap ideas for parents creating rewards. */
export const REWARD_IDEAS: { title: string; icon: string; xpCost: number }[] = [
  { title: 'Кино сонгох эрх', icon: 'film', xpCost: 100 },
  { title: 'Дуртай хоолоо сонгох', icon: 'pizza', xpCost: 120 },
  { title: '30 минут нэмэлт тоглоом', icon: 'gamepad-2', xpCost: 80 },
  { title: 'Хамтдаа паркаар зугаалах', icon: 'trees', xpCost: 200 },
  { title: 'Зайрмаг', icon: 'ice-cream', xpCost: 60 },
];
