/** Preset avatars — no photo uploads in v1 (minimal personal data, child-safe). */
export const USER_AVATAR_KEYS = [
  'fox',
  'bear',
  'cat',
  'dog',
  'panda',
  'rabbit',
  'owl',
  'penguin',
  'lion',
  'koala',
  'tiger',
  'frog',
] as const;

export const FAMILY_AVATAR_KEYS = [
  'home',
  'ger',
  'mountain',
  'tree',
  'sun',
  'star',
  'heart',
  'rocket',
] as const;

/** Habit icon keys — rendered with lucide icons on the client. */
export const HABIT_ICON_KEYS = [
  'sparkles',
  'footprints',
  'book-open',
  'dumbbell',
  'droplet',
  'moon',
  'apple',
  'bed',
  'music',
  'heart',
  'sun',
  'leaf',
  'bike',
  'pencil',
  'smile',
  'brush',
] as const;

/** Habit colour palette (soft, accessible on white). */
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
