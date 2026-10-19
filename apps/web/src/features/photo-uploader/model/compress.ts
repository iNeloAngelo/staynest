import { MAX_PHOTO_UPLOAD_BYTES } from '@staynest/shared';

export const MAX_IMAGE_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/** Вписывает размеры в квадрат maxEdge, не увеличивая маленькие фото. */
export function fitWithin(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height };

  const ratio = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

type Drawable = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function loadBitmap(file: File): Promise<Drawable | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safari и старые браузеры: пробуем через <img>.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
}

/**
 * Клиентское сжатие до 2000 px по длинной стороне (FR-L3). Сервер всё равно
 * перекодирует файл, но трафик с телефона и время загрузки заметно меньше.
 * EXIF orientation браузер применяет при декодировании; итог — свежий файл.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
    throw new Error('photo_too_large');
  }

  if (!file.type.startsWith('image/')) throw new Error('photo_unsupported_type');

  const drawable = await loadBitmap(file);
  if (!drawable) throw new Error('photo_unsupported_type');

  try {
    const size = fitWithin(drawable.width, drawable.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('photo_unsupported_type');

    context.drawImage(drawable.source, 0, 0, size.width, size.height);

    const webp = await toBlob(canvas, 'image/webp');
    const blob = webp ?? (await toBlob(canvas, 'image/jpeg'));
    if (!blob) throw new Error('photo_unsupported_type');

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';

    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } finally {
    drawable.release();
  }
}
