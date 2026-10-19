import { MAX_PHOTO_UPLOAD_BYTES, MAX_PHOTOS_PER_LISTING } from '@staynest/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { useToast } from '../../../shared/ui';
import { uploadPhoto } from '../api/photos';
import { preparePhoto } from './compress';
import { photoErrorKey } from './errors';

type UploadStatus = 'compressing' | 'uploading' | 'done' | 'error';

export type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  errorKey: TranslationKey | null;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function acceptFiles(
  selected: File[],
  remaining: number,
  reject: (key: TranslationKey) => void,
): File[] {
  if (selected.length > remaining) reject('photos.errors.limit');

  return selected.slice(0, Math.max(0, remaining)).filter((file) => {
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      reject('photos.errors.tooLarge');
      return false;
    }
    if (!file.type.startsWith('image/')) {
      reject('photos.errors.unsupported');
      return false;
    }
    return true;
  });
}

type QueueContext = {
  listingId: string;
  files: Map<string, File>;
  update: (id: string, patch: Partial<UploadItem>) => void;
  forget: (id: string) => void;
  invalidate: () => Promise<unknown>;
  setTimer: (timer: ReturnType<typeof setTimeout>) => void;
};

async function runQueue(ids: string[], ctx: QueueContext): Promise<void> {
  for (const id of ids) {
    const file = ctx.files.get(id);
    if (!file) continue;

    try {
      ctx.update(id, { status: 'compressing', progress: 0, errorKey: null });
      const prepared = await preparePhoto(file);
      ctx.update(id, { status: 'uploading' });
      await uploadPhoto(ctx.listingId, prepared, (progress) => ctx.update(id, { progress }));
      ctx.update(id, { status: 'done', progress: 100 });
      await ctx.invalidate();
      ctx.setTimer(setTimeout(() => ctx.forget(id), 900));
    } catch (error) {
      ctx.update(id, { status: 'error', errorKey: photoErrorKey(error) });
    }
  }
}

function usePreviewCleanup(
  itemsRef: { current: UploadItem[] },
  timers: { current: Set<ReturnType<typeof setTimeout>> },
): void {
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );
}

export function usePhotoUploads(listingId: string, existingCount: number) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const itemsRef = useRef<UploadItem[]>(items);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  itemsRef.current = items;

  usePreviewCleanup(itemsRef, timers);

  function update(id: string, patch: Partial<UploadItem>): void {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function forget(id: string): void {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    files.current.delete(id);
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  function start(ids: string[]): void {
    void runQueue(ids, {
      listingId,
      files: files.current,
      update,
      forget,
      invalidate: () => queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] }),
      setTimer: (next) => {
        timers.current.add(next);
      },
    });
  }

  function addFiles(selected: File[]): void {
    const remaining = MAX_PHOTOS_PER_LISTING - existingCount - items.length;
    const accepted = acceptFiles(selected, remaining, (key) =>
      toast.show({ title: t(key), tone: 'error' }),
    );

    const created = accepted.map<UploadItem>((file) => {
      const id = newId();
      files.current.set(id, file);
      return {
        id,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: 'compressing',
        progress: 0,
        errorKey: null,
      };
    });

    if (created.length === 0) return;
    setItems((current) => [...current, ...created]);
    start(created.map((item) => item.id));
  }

  return {
    items,
    addFiles,
    retry: (id: string) => start([id]),
    dismiss: forget,
  };
}
