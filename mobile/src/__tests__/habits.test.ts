import { describe, expect, it } from '@jest/globals';
import { describeSchedule } from '@/features/habits/constants';
import { defaultHabitForm, habitFormSchema, todayLocal } from '@/features/habits/schemas';

describe('describeSchedule', () => {
  it('names presets and lists custom days Monday-first', () => {
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Өдөр бүр');
    expect(describeSchedule([5, 1, 2, 3, 4])).toBe('Ажлын өдөр');
    expect(describeSchedule([6, 0])).toBe('Амралтын өдөр');
    expect(describeSchedule([0, 1, 3])).toBe('Да, Лх, Ня');
  });
});

describe('habit form schema', () => {
  it('accepts the default personal habit once titled', () => {
    expect(habitFormSchema.safeParse({ ...defaultHabitForm(), title: 'Ном унших' }).success).toBe(
      true,
    );
  });

  it('requires a title, at least one weekday and assignees for family habits', () => {
    const r = habitFormSchema.safeParse({
      ...defaultHabitForm(),
      title: ' ',
      type: 'FAMILY',
      assignedUserIds: [],
      scheduleDays: [],
    });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'Дадлын нэрээ оруулна уу.',
        'Дор хаяж нэг өдөр сонгоно уу.',
        'Дор хаяж нэг гишүүн сонгоно уу.',
      ]),
    );
  });

  it('rejects an end date before the start date', () => {
    const r = habitFormSchema.safeParse({
      ...defaultHabitForm(),
      title: 'X',
      startDate: '2026-11-21',
      endDate: '2026-11-20',
    });
    expect(r.success).toBe(false);
  });

  it('formats the device-local date', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
