/**
 * Pet companion rules (pure, unit tested): which event fits the moment, local message templates,
 * and mapping AI animation names onto the app's pet state machine.
 * Most events never call the AI — templates are instant, free and work offline-first.
 */

export const PET_EVENTS = [
  'GREETING',
  'HABIT_COMPLETED',
  'PET_CARE',
  'STREAK_MILESTONE',
  'LEVEL_UP',
  'INACTIVE_RETURN',
  'DAILY_GOAL_COMPLETED',
] as const;
export type PetEvent = (typeof PET_EVENTS)[number];

/** Only these may use the AI (at most once per user, event and day). */
export const AI_EVENTS = new Set<PetEvent>([
  'STREAK_MILESTONE',
  'LEVEL_UP',
  'INACTIVE_RETURN',
  'DAILY_GOAL_COMPLETED',
]);

export const PET_EMOTIONS = ['HAPPY', 'EXCITED', 'CALM', 'PROUD', 'CARING', 'SLEEPY'] as const;
export const AI_ANIMATIONS = [
  'IDLE',
  'HAPPY',
  'EXCITED',
  'CARING',
  'SLEEPING',
  'CELEBRATE',
  'LEVEL_UP',
] as const;
export const PET_ACTIONS = [
  'VIEW_PROGRESS',
  'COMPLETE_HABIT',
  'CARE_PET',
  'VIEW_QUESTS',
  'NONE',
] as const;

export type PetEmotion = (typeof PET_EMOTIONS)[number];
export type AIAnimation = (typeof AI_ANIMATIONS)[number];
export type PetAction = (typeof PET_ACTIONS)[number];

/** App pet states (mobile renderer): the AI vocabulary is mapped onto them. */
export type AppPetState = 'IDLE' | 'HAPPY' | 'CARE' | 'SLEEPING' | 'CELEBRATE' | 'LEVEL_UP';

export function toAppAnimation(a: AIAnimation): AppPetState {
  switch (a) {
    case 'EXCITED':
      return 'CELEBRATE';
    case 'CARING':
      return 'CARE';
    default:
      return a;
  }
}

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];

export interface PetMoment {
  petName: string;
  dueToday: number;
  doneToday: number;
  bestCurrentStreak: number;
  /** Days since the last completion; null = never completed. */
  daysSinceLastCompletion: number | null;
  completedToday: boolean;
}

/** Server-side pick when the client does not name an event. */
export function chooseEvent(m: PetMoment): PetEvent {
  if (m.daysSinceLastCompletion !== null && m.daysSinceLastCompletion >= 3 && !m.completedToday) {
    return 'INACTIVE_RETURN';
  }
  if (m.dueToday > 0 && m.doneToday >= m.dueToday) return 'DAILY_GOAL_COMPLETED';
  if (m.completedToday && STREAK_MILESTONES.includes(m.bestCurrentStreak))
    return 'STREAK_MILESTONE';
  return 'GREETING';
}

interface Template {
  message: string;
  emotion: PetEmotion;
  animation: AIAnimation;
  suggestedAction: PetAction;
}

const TEMPLATES: Record<PetEvent, Template[]> = {
  GREETING: [
    {
      message: 'Сайн уу! Өнөөдөр хамтдаа нэг жижиг алхам хийх үү? 🌱',
      emotion: 'HAPPY',
      animation: 'HAPPY',
      suggestedAction: 'COMPLETE_HABIT',
    },
    {
      message: '{name} чамайг хараад баяртай байна! ✨',
      emotion: 'HAPPY',
      animation: 'HAPPY',
      suggestedAction: 'NONE',
    },
    {
      message: 'Нэг дадал, нэг инээмсэглэл — эхэлцгээе! 😊',
      emotion: 'EXCITED',
      animation: 'HAPPY',
      suggestedAction: 'COMPLETE_HABIT',
    },
  ],
  HABIT_COMPLETED: [
    {
      message: 'Ёстой гоё! Нэг алхам урагшиллаа 🎉',
      emotion: 'EXCITED',
      animation: 'CELEBRATE',
      suggestedAction: 'NONE',
    },
    {
      message: '{name} бахархаж байна! Үргэлжлүүлээрэй 💪',
      emotion: 'PROUD',
      animation: 'HAPPY',
      suggestedAction: 'NONE',
    },
  ],
  PET_CARE: [
    {
      message: 'Баярлалаа! Надад их таалагдлаа 💛',
      emotion: 'CARING',
      animation: 'CARING',
      suggestedAction: 'NONE',
    },
    {
      message: 'Ммм, ямар сайхан юм бэ! 🥰',
      emotion: 'HAPPY',
      animation: 'HAPPY',
      suggestedAction: 'NONE',
    },
  ],
  STREAK_MILESTONE: [
    {
      message: '{streak} өдөр дараалан! Гайхалтай тууштай байна 🔥',
      emotion: 'PROUD',
      animation: 'CELEBRATE',
      suggestedAction: 'VIEW_PROGRESS',
    },
  ],
  LEVEL_UP: [
    {
      message: 'Шинэ түвшин! Чи улам хүчтэй болж байна ⭐',
      emotion: 'EXCITED',
      animation: 'LEVEL_UP',
      suggestedAction: 'VIEW_PROGRESS',
    },
  ],
  INACTIVE_RETURN: [
    {
      message: 'Чамайг санаж байлаа! Өнөөдөр жижигхэн алхмаар эхэлье 🤗',
      emotion: 'CARING',
      animation: 'HAPPY',
      suggestedAction: 'COMPLETE_HABIT',
    },
  ],
  DAILY_GOAL_COMPLETED: [
    {
      message: 'Өнөөдрийн бүх дадал биеллээ! Чи гайхалтай 🌟',
      emotion: 'PROUD',
      animation: 'CELEBRATE',
      suggestedAction: 'VIEW_QUESTS',
    },
  ],
};

/** Deterministic variant per day so the bubble does not flicker between calls. */
export function templateFor(event: PetEvent, m: PetMoment, seed: number): Template {
  const list = TEMPLATES[event];
  const t = list[Math.abs(seed) % list.length];
  return {
    ...t,
    message: t.message
      .replace('{name}', m.petName)
      .replace('{streak}', String(m.bestCurrentStreak)),
  };
}
