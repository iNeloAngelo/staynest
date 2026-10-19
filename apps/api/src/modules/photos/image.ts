import { encode as encodeBlurhash } from 'blurhash';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

/** Разрешённые форматы. HEIC сознательно нет: prebuilt libvips декодирует только AVIF (см. ADR-047). */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const VARIANTS = [
  { name: 'thumb', size: 400, quality: 78 },
  { name: 'md', size: 1000, quality: 80 },
  { name: 'lg', size: 2000, quality: 82 },
] as const;

type PhotoVariantName = (typeof VARIANTS)[number]['name'];

export type ProcessedPhoto = {
  width: number;
  height: number;
  blurhash: string | null;
  variants: Record<PhotoVariantName, Buffer>;
};

export class PhotoUnsupportedError extends Error {
  constructor(public readonly reason: 'mime' | 'decode') {
    super('unsupported photo');
    this.name = 'PhotoUnsupportedError';
  }
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super('photo pixel limit exceeded');
    this.name = 'PhotoTooLargeError';
  }
}

export type PhotoProcessorOptions = {
  maxPixels: number;
};

function isPixelLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /pixel limit|too large|exceeds/i.test(message);
}

async function detectMime(input: Buffer): Promise<string> {
  const detected = await fileTypeFromBuffer(input);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) throw new PhotoUnsupportedError('mime');
  return detected.mime;
}

async function toRaw(input: Buffer, maxPixels: number) {
  try {
    return await sharp(input, {
      limitInputPixels: maxPixels,
      failOn: 'error',
      sequentialRead: true,
    })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (isPixelLimitError(error)) throw new PhotoTooLargeError();
    throw new PhotoUnsupportedError('decode');
  }
}

async function encodeVariant(
  raw: { data: Buffer; info: { width: number; height: number; channels: number } },
  size: number,
  quality: number,
): Promise<Buffer> {
  return sharp(raw.data, {
    raw: {
      width: raw.info.width,
      height: raw.info.height,
      channels: raw.info.channels as 1 | 2 | 3 | 4,
    },
  })
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function makeBlurhash(raw: {
  data: Buffer;
  info: { width: number; height: number; channels: number };
}): Promise<string | null> {
  try {
    const small = await sharp(raw.data, {
      raw: {
        width: raw.info.width,
        height: raw.info.height,
        channels: raw.info.channels as 1 | 2 | 3 | 4,
      },
    })
      .resize(32, 32, { fit: 'inside' })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    return encodeBlurhash(
      new Uint8ClampedArray(small.data),
      small.info.width,
      small.info.height,
      4,
      3,
    );
  } catch {
    // Плейсхолдер не критичен: фото должно загрузиться и без blurhash.
    return null;
  }
}

/**
 * Полная перекодировка: EXIF (включая GPS), ICC и прочие метаданные теряются,
 * потому что варианты собираются из сырых пикселей. Формат определяется по
 * содержимому, а не по имени файла.
 */
export async function processPhoto(
  input: Buffer,
  { maxPixels }: PhotoProcessorOptions,
): Promise<ProcessedPhoto> {
  await detectMime(input);
  const raw = await toRaw(input, maxPixels);

  const entries = await Promise.all(
    VARIANTS.map(async ({ name, size, quality }) => {
      const buffer = await encodeVariant(raw, size, quality);
      return [name, buffer] as const;
    }),
  );

  return {
    width: raw.info.width,
    height: raw.info.height,
    blurhash: await makeBlurhash(raw),
    variants: Object.fromEntries(entries) as Record<PhotoVariantName, Buffer>,
  };
}
