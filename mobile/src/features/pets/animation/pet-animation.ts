import { create } from 'zustand';
import type { PetMood } from '@/types/api';

/**
 * Pet animation state machine (spec §3.5). Renderer-agnostic: the SVG renderer consumes it today,
 * a Rive renderer can consume the same states later (one state-machine input per state).
 */
export type PetAnimationState =
  'IDLE' | 'HAPPY' | 'SAD' | 'EATING' | 'CARE' | 'LEVEL_UP' | 'SLEEPING' | 'CELEBRATE' | 'UNLOCK';

/** How long each one-shot state plays before falling back to the base state. */
export const TRANSIENT_MS: Record<PetAnimationState, number> = {
  IDLE: 0,
  SLEEPING: 0,
  HAPPY: 1800,
  SAD: 2600,
  EATING: 2400,
  CARE: 2200,
  LEVEL_UP: 2600,
  CELEBRATE: 2600,
  UNLOCK: 2200,
};

/**
 * Domain events. Business code only says *what happened*; the mapping below decides how the pet
 * reacts, so animation tweaks never touch business logic.
 */
export type PetEvent =
  | 'HABIT_COMPLETED'
  | 'USER_LEVEL_UP'
  | 'PET_LEVEL_UP'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'ACCESSORY_UNLOCKED'
  | 'ACCESSORY_EQUIPPED'
  | 'CARE_PET'
  | 'CARE_FEED'
  | 'CARE_PLAY'
  | 'CARE_BATH'
  | 'TAPPED'
  | 'QUEST_COMPLETED'
  | 'MISSED_YOU';

const EVENT_TO_STATE: Record<PetEvent, PetAnimationState> = {
  HABIT_COMPLETED: 'HAPPY',
  USER_LEVEL_UP: 'CELEBRATE',
  PET_LEVEL_UP: 'LEVEL_UP',
  ACHIEVEMENT_UNLOCKED: 'CELEBRATE',
  ACCESSORY_UNLOCKED: 'UNLOCK',
  ACCESSORY_EQUIPPED: 'HAPPY',
  CARE_PET: 'CARE',
  CARE_FEED: 'EATING',
  CARE_PLAY: 'HAPPY',
  CARE_BATH: 'CARE',
  TAPPED: 'HAPPY',
  QUEST_COMPLETED: 'CELEBRATE',
  // Temporary expression only — never a punishment (spec).
  MISSED_YOU: 'SAD',
};

/** Higher wins when events overlap (a level-up should not be cut off by a tap). */
const PRIORITY: Record<PetAnimationState, number> = {
  IDLE: 0,
  SLEEPING: 0,
  SAD: 1,
  HAPPY: 2,
  CARE: 2,
  EATING: 2,
  UNLOCK: 3,
  CELEBRATE: 3,
  LEVEL_UP: 4,
};

interface Transient {
  state: PetAnimationState;
  id: number;
  until: number;
}

interface PetAnimationStore {
  transient: Transient | null;
  play: (state: PetAnimationState) => void;
  clear: (id: number) => void;
}

let nextId = 0;

export const usePetAnimationStore = create<PetAnimationStore>((set, get) => ({
  transient: null,
  play: (state) => {
    const now = Date.now();
    const current = get().transient;
    if (current && current.until > now && PRIORITY[current.state] > PRIORITY[state]) return;
    const id = ++nextId;
    set({ transient: { state, id, until: now + TRANSIENT_MS[state] } });
    setTimeout(() => get().clear(id), TRANSIENT_MS[state]);
  },
  clear: (id) => {
    if (get().transient?.id === id) set({ transient: null });
  },
}));

export function emitPetEvent(event: PetEvent): void {
  usePetAnimationStore.getState().play(EVENT_TO_STATE[event]);
}

/** Quiet hours: the pet sleeps 21:00–07:00 local time (wakes briefly when tapped). */
export function isSleepTime(date: Date = new Date()): boolean {
  const h = date.getHours();
  return h >= 21 || h < 7;
}

/** The resting state shown when nothing is happening. */
export function baseState(date: Date = new Date()): PetAnimationState {
  return isSleepTime(date) ? 'SLEEPING' : 'IDLE';
}

export function usePetAnimationState(): PetAnimationState {
  const transient = usePetAnimationStore((s) => s.transient);
  return transient ? transient.state : baseState();
}

export function moodText(name: string, mood: PetMood, sleeping: boolean): string {
  if (sleeping) return `${name} унтаж байна. Сайхан амраарай 💤`;
  switch (mood) {
    case 'HAPPY':
      return `${name} маш их баярлаж байна!`;
    case 'CONTENT':
      return `${name} тайван, сэтгэл хангалуун байна.`;
    case 'LONELY':
      return `${name} чамайг санасан шүү. Хамт тоглох уу?`;
  }
}
