import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PhotoTooLargeError, PhotoUnsupportedError, processPhoto } from './image';

const OPTIONS = { maxPixels: 40_000_000 };

async function jpeg(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 140, b: 110 } },
  })
    .jpeg()
    .toBuffer();
}

async function decoded(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  return { format: meta.format, width: meta.width, height: meta.height, exif: meta.exif };
}

describe('processPhoto', () => {
  it('делает три WebP-варианта и blurhash, сохраняя пропорции', async () => {
    const result = await processPhoto(await jpeg(), OPTIONS);

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.blurhash).toMatch(/^[A-Za-z0-9#$%*+,-.:;=?@[\]^_{|}~]+$/);

    const sizes = await Promise.all(
      (['thumb', 'md', 'lg'] as const).map((variant) => decoded(result.variants[variant])),
    );

    expect(sizes.map((size) => size.format)).toEqual(['webp', 'webp', 'webp']);
    expect(sizes[0]).toMatchObject({ width: 400, height: 300 });
    // Исходник меньше 1000/2000 px, поэтому без апскейла.
    expect(sizes[1]).toMatchObject({ width: 800, height: 600 });
    expect(sizes[2]).toMatchObject({ width: 800, height: 600 });
  });

  it('разворачивает по EXIF и вырезает метаданные', async () => {
    const rotated = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .withMetadata({
        orientation: 6,
        exif: {
          IFD0: { Copyright: 'test', ImageDescription: 'secret location' },
        },
      })
      .jpeg()
      .toBuffer();

    expect((await sharp(rotated).metadata()).exif).toBeDefined();

    const result = await processPhoto(rotated, OPTIONS);
    expect(result.width).toBe(600);
    expect(result.height).toBe(800);

    for (const variant of Object.values(result.variants)) {
      const meta = await decoded(variant);
      expect(meta.exif).toBeUndefined();
      expect(meta.width).toBeLessThanOrEqual(2000);
    }
  });

  it('не верит расширению: exe под видом jpg отвергается по сигнатуре', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(512, 0)]);

    await expect(processPhoto(exe, OPTIONS)).rejects.toBeInstanceOf(PhotoUnsupportedError);
  });

  it('отвергает HEIC: prebuilt-libvips декодирует только AVIF', async () => {
    const heic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('mif1heic'),
      Buffer.alloc(32),
    ]);

    await expect(processPhoto(heic, OPTIONS)).rejects.toBeInstanceOf(PhotoUnsupportedError);
  });

  it('принимает PNG и WebP', async () => {
    const png = await sharp({
      create: { width: 500, height: 400, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const webp = await sharp(png).webp().toBuffer();

    const fromPng = await processPhoto(png, OPTIONS);
    const fromWebp = await processPhoto(webp, OPTIONS);

    expect(fromPng.width).toBe(500);
    expect(fromWebp.height).toBe(400);
  });

  it('отвергает файл с сигнатурой PNG, но битым содержимым', async () => {
    const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);

    await expect(processPhoto(broken, OPTIONS)).rejects.toBeInstanceOf(PhotoUnsupportedError);
  });

  it('отвергает изображение больше limitInputPixels', async () => {
    const large = await jpeg(2000, 2000);

    await expect(processPhoto(large, { maxPixels: 1_000_000 })).rejects.toBeInstanceOf(
      PhotoTooLargeError,
    );
  });
});
