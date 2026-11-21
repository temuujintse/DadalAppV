import { z } from 'zod';

export const familyNameSchema = z
  .string()
  .trim()
  .min(1, 'Гэр бүлийн нэрээ оруулна уу.')
  .max(60, 'Нэр 60 тэмдэгтээс ихгүй байна.');

export const createFamilySchema = z.object({
  name: familyNameSchema,
  avatarKey: z.string(),
});

/** Invite codes look like "7KQ2M-X9DPA"; case, spaces and dashes are ignored by the server. */
export const joinFamilySchema = z.object({
  code: z
    .string()
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
    .pipe(
      z
        .string()
        .length(10, 'Урилгын код 10 тэмдэгттэй байна.')
        .regex(/^[0-9A-Z]+$/, 'Код зөвхөн үсэг, тоо агуулна.'),
    ),
});

export type CreateFamilyForm = z.infer<typeof createFamilySchema>;
export type JoinFamilyInput = z.input<typeof joinFamilySchema>;

/** Formats raw input as the user types: "7kq2mx" → "7KQ2M-X". */
export function formatInviteCode(input: string): string {
  const raw = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 10);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}
