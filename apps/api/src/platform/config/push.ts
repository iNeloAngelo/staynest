import { z } from 'zod';

export const pushEnvSchema = z.object({
  /** Web Push: VAPID-пара генерируется `pnpm vapid:generate` и живёт только в .env. */
  VAPID_PUBLIC_KEY: z.string().trim().optional(),
  VAPID_PRIVATE_KEY: z.string().trim().optional(),
  VAPID_SUBJECT: z
    .string()
    .trim()
    .regex(/^(mailto:|https:\/\/)/, 'VAPID_SUBJECT: mailto: или https://')
    .default('mailto:no-reply@staynest.local'),
});

export type PushEnv = z.infer<typeof pushEnvSchema>;

export type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
  privateKey: string | null;
  subject: string;
};

export function pushConfig(data: PushEnv): PushConfig {
  const publicKey = data.VAPID_PUBLIC_KEY || null;
  const privateKey = data.VAPID_PRIVATE_KEY || null;

  if ((publicKey === null) !== (privateKey === null)) {
    throw new Error('VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY задаются только вместе.');
  }

  return {
    enabled: publicKey !== null && privateKey !== null,
    publicKey,
    privateKey,
    subject: data.VAPID_SUBJECT,
  };
}
