import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { expressionFor } from '@/features/pets/animation/art';
import {
  baseState,
  emitPetEvent,
  isSleepTime,
  moodText,
  TRANSIENT_MS,
  usePetAnimationStore,
} from '@/features/pets/animation/pet-animation';

describe('pet animation state machine', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    usePetAnimationStore.setState({ transient: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps business events to animation states and falls back after the duration', () => {
    emitPetEvent('CARE_FEED');
    expect(usePetAnimationStore.getState().transient?.state).toBe('EATING');
    jest.advanceTimersByTime(TRANSIENT_MS.EATING + 10);
    expect(usePetAnimationStore.getState().transient).toBeNull();
  });

  it('does not let a tap interrupt a level-up celebration', () => {
    emitPetEvent('PET_LEVEL_UP');
    emitPetEvent('TAPPED');
    expect(usePetAnimationStore.getState().transient?.state).toBe('LEVEL_UP');
  });

  it('lets a bigger event replace a smaller one', () => {
    emitPetEvent('TAPPED');
    emitPetEvent('ACCESSORY_UNLOCKED');
    expect(usePetAnimationStore.getState().transient?.state).toBe('UNLOCK');
  });

  it('sleeps at night and idles during the day', () => {
    expect(isSleepTime(new Date(2026, 0, 1, 23))).toBe(true);
    expect(isSleepTime(new Date(2026, 0, 1, 6))).toBe(true);
    expect(isSleepTime(new Date(2026, 0, 1, 12))).toBe(false);
    expect(baseState(new Date(2026, 0, 1, 12))).toBe('IDLE');
    expect(baseState(new Date(2026, 0, 1, 22))).toBe('SLEEPING');
  });
});

describe('pet expression & copy', () => {
  it('gives every state an expression', () => {
    expect(expressionFor('SLEEPING')).toMatchObject({ eyes: 'closed' });
    expect(expressionFor('HAPPY')).toMatchObject({ eyes: 'happy', mouth: 'open', blush: true });
    expect(expressionFor('EATING').mouth).toBe('chew');
    expect(expressionFor('SAD').mouth).toBe('frown');
  });

  it('uses kind, non-blaming mood copy', () => {
    const lonely = moodText('Бамбаа', 'LONELY', false);
    expect(lonely).toContain('санасан');
    expect(lonely).not.toMatch(/буруу|муу|өлсөж|үхэ/);
    expect(moodText('Бамбаа', 'HAPPY', true)).toContain('унтаж');
  });
});
