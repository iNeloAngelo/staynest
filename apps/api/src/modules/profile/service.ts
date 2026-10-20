import { randomUUID } from 'node:crypto';
import type { UserDto } from '@staynest/shared';
import { AVATAR_MAX_BYTES } from '@staynest/shared';
import type { Logger } from 'pino';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import { errorCode } from '../../platform/errors/code';
import type { MediaStorage } from '../../platform/storage/index';
import { toUserDto, usersService } from '../users/index';
import { avatarStorageUnavailable, avatarTooLarge, avatarUnsupported } from './errors';
import { AvatarTooLargeError, AvatarUnsupportedError, processAvatar } from './image';

export type ProfileServiceDependencies = {
  db: Db;
  config: AppConfig;
  storage: MediaStorage;
  logger: Logger;
};

function avatarKey(userId: string): string {
  return `avatars/${userId}/${randomUUID()}.webp`;
}

export function createProfileService({ db, config, storage, logger }: ProfileServiceDependencies) {
  async function removeQuietly(key: string | null): Promise<void> {
    if (!key) return;

    try {
      await storage.remove([key]);
    } catch (error) {
      // Битый старый аватар не должен ломать обновление профиля.
      logger.warn({ code: errorCode(error) }, 'failed to remove avatar object');
    }
  }

  return {
    async setAvatar(userId: string, input: Buffer): Promise<UserDto> {
      let webp: Buffer;

      try {
        webp = await processAvatar(input, {
          maxBytes: AVATAR_MAX_BYTES,
          maxPixels: config.storage.maxPixels,
        });
      } catch (error) {
        if (error instanceof AvatarTooLargeError) throw avatarTooLarge();
        if (error instanceof AvatarUnsupportedError) throw avatarUnsupported();
        throw error;
      }

      const key = avatarKey(userId);
      const previous = await usersService.findById(db.kysely, userId);

      try {
        await storage.put(key, webp, 'image/webp');
      } catch (error) {
        logger.error({ code: errorCode(error) }, 'avatar upload to storage failed');
        throw avatarStorageUnavailable();
      }

      try {
        const updated = await usersService.setAvatarKey(db.kysely, userId, key);
        await removeQuietly(previous?.avatar_key ?? null);
        return toUserDto(updated, config.storage.publicPath);
      } catch (error) {
        await removeQuietly(key);
        throw error;
      }
    },

    async removeAvatar(userId: string): Promise<UserDto> {
      const current = await usersService.findById(db.kysely, userId);
      const updated = await usersService.setAvatarKey(db.kysely, userId, null);
      await removeQuietly(current?.avatar_key ?? null);
      return toUserDto(updated, config.storage.publicPath);
    },
  };
}
