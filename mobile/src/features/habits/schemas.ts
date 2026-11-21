import { z } from 'zod';

/** Device-local calendar date "YYYY-MM-DD". */
export function todayLocal(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export const habitFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Дадлын нэрээ оруулна уу.')
      .max(80, 'Нэр 80 тэмдэгтээс ихгүй байна.'),
    description: z.string().trim().max(500, 'Тайлбар 500 тэмдэгтээс ихгүй байна.'),
    icon: z.string(),
    color: z.string(),
    type: z.enum(['PERSONAL', 'FAMILY']),
    completionMode: z.enum(['PER_MEMBER', 'SHARED']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    assignedUserIds: z.array(z.string()),
    scheduleDays: z.array(z.number().int().min(0).max(6)).min(1, 'Дор хаяж нэг өдөр сонгоно уу.'),
    startDate: z.string(),
    endDate: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'FAMILY' && v.assignedUserIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignedUserIds'],
        message: 'Дор хаяж нэг гишүүн сонгоно уу.',
      });
    }
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Дуусах огноо эхлэх огнооноос хойш байна.',
      });
    }
  });

export type HabitFormValues = z.infer<typeof habitFormSchema>;

export function defaultHabitForm(): HabitFormValues {
  return {
    title: '',
    description: '',
    icon: 'sparkles',
    color: '#F97316',
    type: 'PERSONAL',
    completionMode: 'PER_MEMBER',
    difficulty: 'EASY',
    assignedUserIds: [],
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    startDate: todayLocal(),
    endDate: null,
  };
}
