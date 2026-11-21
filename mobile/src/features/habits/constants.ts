import type { HabitCompletionMode, HabitDifficulty } from '@/types/api';

/** Mirrors backend HABIT_COLORS. */
export const HABIT_COLORS = [
  '#F97316',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#14B8A6',
  '#64748B',
] as const;

export const DIFFICULTY: Record<HabitDifficulty, { label: string; xp: number; dots: number }> = {
  EASY: { label: 'Хялбар', xp: 10, dots: 1 },
  MEDIUM: { label: 'Дунд', xp: 20, dots: 2 },
  HARD: { label: 'Хэцүү', xp: 30, dots: 3 },
};

export const COMPLETION_MODE: Record<HabitCompletionMode, { label: string; hint: string }> = {
  PER_MEMBER: {
    label: 'Гишүүн бүр',
    hint: 'Оноогдсон гишүүн бүр өөрийнхөө дадлыг тусад нь биелүүлнэ.',
  },
  SHARED: {
    label: 'Хамтдаа нэг удаа',
    hint: 'Нэг гишүүн гэр бүлийн өмнөөс өдөрт нэг удаа биелүүлнэ.',
  },
};

/** Monday-first week (Mongolian convention). Values: 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS = [
  { value: 1, short: 'Да', long: 'Даваа' },
  { value: 2, short: 'Мя', long: 'Мягмар' },
  { value: 3, short: 'Лх', long: 'Лхагва' },
  { value: 4, short: 'Пү', long: 'Пүрэв' },
  { value: 5, short: 'Ба', long: 'Баасан' },
  { value: 6, short: 'Бя', long: 'Бямба' },
  { value: 0, short: 'Ня', long: 'Ням' },
] as const;

export const SCHEDULE_PRESETS = [
  { label: 'Өдөр бүр', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Ажлын өдөр', days: [1, 2, 3, 4, 5] },
  { label: 'Амралтын өдөр', days: [0, 6] },
] as const;

/** Human summary of a schedule, e.g. "Өдөр бүр", "Да, Лх, Ба". */
export function describeSchedule(days: number[]): string {
  const set = new Set(days);
  const preset = SCHEDULE_PRESETS.find(
    (p) => p.days.length === set.size && p.days.every((d) => set.has(d)),
  );
  if (preset) return preset.label;
  return WEEKDAYS.filter((w) => set.has(w.value))
    .map((w) => w.short)
    .join(', ');
}
