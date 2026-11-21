import { create } from 'zustand';
import { emitPetEvent } from '@/features/pets/animation/pet-animation';
import type {
  AccessoryUnlock,
  AchievementUnlock,
  CareResult,
  ClaimResult,
  CompletionResult,
  QuestCompleted,
} from '@/types/api';

/**
 * Celebration queue, decoupled from business logic: the completion and care flows only
 * *publish* events; CelebrationHost and the pet renderer decide how (and whether, under
 * Reduced Motion) to animate them.
 */
export type ModalCelebration =
  | { kind: 'levelUp'; level: number; scope: 'personal' | 'family' }
  | { kind: 'petLevelUp'; level: number }
  | { kind: 'achievement'; achievement: AchievementUnlock }
  | { kind: 'accessory'; accessory: AccessoryUnlock }
  | { kind: 'questReady'; quest: QuestCompleted };

export interface XpToast {
  id: number;
  personalXP: number;
  familyXP: number;
  petXP: number;
}

interface CelebrationState {
  toast: XpToast | null;
  queue: ModalCelebration[];
  showToast: (toast: Omit<XpToast, 'id'>) => void;
  clearToast: () => void;
  enqueue: (items: ModalCelebration[]) => void;
  dismiss: () => void;
}

let toastId = 0;

export const useCelebrationStore = create<CelebrationState>((set) => ({
  toast: null,
  queue: [],
  showToast: (toast) => set({ toast: { ...toast, id: ++toastId } }),
  clearToast: () => set({ toast: null }),
  enqueue: (items) => set((s) => ({ queue: [...s.queue, ...items] })),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/** Turns a server completion result into celebration + pet events. */
export function celebrateCompletion(result: CompletionResult): void {
  if (result.replayed) return;
  const store = useCelebrationStore.getState();
  store.showToast({
    personalXP: result.rewards.personalXP,
    familyXP: result.rewards.familyXP,
    petXP: result.rewards.petXP,
  });
  emitPetEvent('HABIT_COMPLETED');

  const modals: ModalCelebration[] = [];
  if (result.gamification.leveledUp) {
    modals.push({ kind: 'levelUp', level: result.gamification.level, scope: 'personal' });
  }
  if (result.pet?.leveledUp) {
    modals.push({ kind: 'petLevelUp', level: result.pet.level });
  }
  for (const achievement of result.achievementsUnlocked) {
    modals.push({ kind: 'achievement', achievement });
  }
  for (const accessory of result.accessoriesUnlocked ?? []) {
    modals.push({ kind: 'accessory', accessory });
  }
  if (result.family?.leveledUp) {
    modals.push({ kind: 'levelUp', level: result.family.level, scope: 'family' });
  }
  // One "quest ready" nudge is enough; the Quests tab shows the rest.
  const ready = result.questsCompleted?.[0];
  if (ready) modals.push({ kind: 'questReady', quest: ready });
  if (modals.length) store.enqueue(modals);
}

/** Celebration for claiming a quest reward. */
export function celebrateClaim(result: ClaimResult): void {
  const store = useCelebrationStore.getState();
  store.showToast({
    personalXP: result.rewards.personalXP,
    familyXP: result.rewards.familyXP,
    petXP: 0,
  });
  const modals: ModalCelebration[] = [];
  if (result.gamification.leveledUp) {
    modals.push({ kind: 'levelUp', level: result.gamification.level, scope: 'personal' });
  }
  for (const achievement of result.achievementsUnlocked) {
    modals.push({ kind: 'achievement', achievement });
  }
  if (result.family?.leveledUp) {
    modals.push({ kind: 'levelUp', level: result.family.level, scope: 'family' });
  }
  if (modals.length) store.enqueue(modals);
}

/** Celebration for a pet care action. */
export function celebrateCare(result: CareResult): void {
  if (result.replayed) return;
  const store = useCelebrationStore.getState();
  store.showToast({ personalXP: 0, familyXP: 0, petXP: result.petXP });

  const modals: ModalCelebration[] = [];
  if (result.leveledUp) modals.push({ kind: 'petLevelUp', level: result.pet.level });
  for (const achievement of result.achievementsUnlocked) {
    modals.push({ kind: 'achievement', achievement });
  }
  for (const accessory of result.accessoriesUnlocked) {
    modals.push({ kind: 'accessory', accessory });
  }
  const ready = result.questsCompleted?.[0];
  if (ready) modals.push({ kind: 'questReady', quest: ready });
  if (modals.length) store.enqueue(modals);
}
