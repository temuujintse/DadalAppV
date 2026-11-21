import { z } from 'zod';

/** Client-side validation mirrors the backend DTO rules (backend stays the authority). */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Имэйл хаягаа оруулна уу.')
  .max(254, 'Имэйл хэт урт байна.')
  .email('Имэйл хаяг буруу байна.');

export const passwordSchema = z
  .string()
  .min(8, 'Нууц үг дор хаяж 8 тэмдэгт байна.')
  .max(128, 'Нууц үг хэт урт байна.')
  .regex(/\p{L}/u, 'Нууц үгэнд дор хаяж нэг үсэг оруулна уу.')
  .regex(/\d/, 'Нууц үгэнд дор хаяж нэг тоо оруулна уу.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Нэрээ оруулна уу.')
  .max(50, 'Нэр 50 тэмдэгтээс ихгүй байна.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Нууц үгээ оруулна уу.'),
});

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
