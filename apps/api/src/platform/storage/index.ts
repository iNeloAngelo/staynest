import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Logger } from 'pino';
import type { StorageConfig } from '../config/index';
import { errorCode } from '../errors/code';

export type PhotoVariant = 'thumb' | 'md' | 'lg';

export type MediaStorage = {
  /**
   * Создаёт бакет и публичную политику только на префиксы `listings/` и `avatars/`.
   * Идемпотентно.
   */
  ensureReady: () => Promise<void>;
  put: (key: string, body: Buffer, contentType: string) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
  /** Ключ объекта → публичный путь `/media/...`. */
  publicUrl: (key: string) => string;
  close: () => void;
};

export function variantKey(storagePrefix: string, variant: PhotoVariant): string {
  return `${storagePrefix}/${variant}.webp`;
}

export function photoKeys(storagePrefix: string): string[] {
  return (['thumb', 'md', 'lg'] as const).map((variant) => variantKey(storagePrefix, variant));
}

function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadMedia',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${bucket}/listings/*/*/*.webp`,
          `arn:aws:s3:::${bucket}/avatars/*/*.webp`,
        ],
      },
    ],
  });
}

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;

  return name === 'NotFound' || name === 'NoSuchBucket' || status === 404;
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function prepareBucket(client: S3Client, config: StorageConfig): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: config.bucket,
      Policy: publicReadPolicy(config.bucket),
    }),
  );
}

export function createMediaStorage(config: StorageConfig, logger: Logger): MediaStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });

  let ready: Promise<void> | null = null;

  function ensureReady(): Promise<void> {
    if (!ready) {
      ready = prepareBucket(client, config).catch((error: unknown) => {
        ready = null;
        logger.error({ code: errorCode(error) }, 'media storage is not ready');
        throw error;
      });
    }

    return ready;
  }

  const storage: MediaStorage = {
    ensureReady,

    async put(key, body, contentType) {
      await ensureReady();
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    },

    async remove(keys) {
      if (keys.length === 0) return;
      await ensureReady();
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: keys.map((key) => ({ Key: key })), Quiet: true },
        }),
      );
    },

    publicUrl(key) {
      return `${config.publicPath}/${encodeKey(key)}`;
    },

    close() {
      client.destroy();
    },
  };

  return storage;
}
