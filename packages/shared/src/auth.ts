import { z } from 'zod';

/** Аватар: один квадрат 512 px, лимит исходника 5 МБ. */
export const AVATAR_SIZE = 512;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const localeSchema = z.enum(['ru', 'en']);

const RESERVED_EMAIL_DOMAIN = '@telegram.invalid';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254)
  // Синтетические адреса Telegram-аккаунтов нельзя занять обычной регистрацией.
  .refine((value) => !value.endsWith(RESERVED_EMAIL_DOMAIN), 'Этот домен зарезервирован.');

export const passwordSchema = z.string().min(10).max(128);

export const displayNameSchema = z.string().trim().min(1).max(80);

export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .transform((value) => (value === '' ? null : value));

export const tokenSchema = z.string().trim().min(20).max(200);

export const registerInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
    locale: localeSchema.default('ru'),
  })
  .strict();

export const loginInputSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const verifyEmailInputSchema = z
  .object({ token: tokenSchema, password: passwordSchema })
  .strict();

export const resendVerificationInputSchema = z.object({ email: emailSchema }).strict();

export const forgotPasswordInputSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordInputSchema = z
  .object({ token: tokenSchema, password: passwordSchema })
  .strict();

export const changePasswordInputSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .strict();

export const updateMeInputSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    phone: phoneSchema.nullable().optional(),
    locale: localeSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Нужно передать хотя бы одно поле.',
  });

export const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  phone: z.string().nullable(),
  /** Ключ в S3; клиенту нужен готовый URL, поэтому отдаём и его. */
  avatarKey: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  locale: localeSchema,
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const sessionDtoSchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export const userResponseSchema = z.object({ user: userDtoSchema });

export const sessionsResponseSchema = z.object({ sessions: z.array(sessionDtoSchema) });

export const registerResponseSchema = z.object({
  status: z.literal('accepted'),
  emailVerificationRequired: z.boolean(),
});

export const acceptedResponseSchema = z.object({ status: z.literal('accepted') });

export type Locale = z.infer<typeof localeSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type UpdateMeInput = z.infer<typeof updateMeInputSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
export type SessionDto = z.infer<typeof sessionDtoSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;
export type ForgotPasswordResponse = AcceptedResponse;
