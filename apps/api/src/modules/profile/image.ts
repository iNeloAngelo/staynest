import { AVATAR_SIZE } from '@staynest/shared';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export class AvatarUnsupportedError extends Error {
  constructor(public readonly reason: 'mime' | 'decode') {
    super('unsupported avatar');
    this.name = 'AvatarUnsupportedError';
  }
}

export class AvatarTooLargeError extends Error {
  constructor(public readonly reason: 'bytes' | 'pixels') {
    super('avatar is too large');
    this.name = 'AvatarTooLargeError';
  }
}

export type AvatarOptions = {
  maxBytes: number;
  maxPixels: number;
};

function isPixelLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /pixel limit|too large|exceeds/i.test(message);
}

/**
 * Квадратный WebP из сырых пикселей: EXIF (включая GPS) и прочие метаданные
 * не переносятся, формат определяется по содержимому, а не по имени файла.
 */
export async function processAvatar(
  input: Buffer,
  { maxBytes, maxPixels }: AvatarOptions,
): Promise<Buffer> {
  if (input.byteLength > maxBytes) throw new AvatarTooLargeError('bytes');

  const detected = await fileTypeFromBuffer(input);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    throw new AvatarUnsupportedError('mime');
  }

  try {
    return await sharp(input, {
      limitInputPixels: maxPixels,
      failOn: 'error',
      sequentialRead: true,
    })
      .rotate()
      .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: 'cover', position: 'centre' })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch (error) {
    if (isPixelLimitError(error)) throw new AvatarTooLargeError('pixels');
    throw new AvatarUnsupportedError('decode');
  }
}
