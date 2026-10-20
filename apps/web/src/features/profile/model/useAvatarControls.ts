import { AVATAR_MAX_BYTES } from '@staynest/shared';
import type { UserDto } from '@staynest/shared';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/ui';
import { useRemoveAvatar, useUploadAvatar } from '../api/hooks';

export function useAvatarControls(user: UserDto) {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Сброс значения позволяет выбрать тот же файл повторно после ошибки.
    event.target.value = '';
    if (!file) return;

    if (file.size > AVATAR_MAX_BYTES) {
      toast.show({ title: t('profile.avatarError'), tone: 'error' });
      return;
    }

    upload.mutate(file, {
      onError: () => toast.show({ title: t('profile.avatarError'), tone: 'error' }),
    });
  }

  function openRemove(): void {
    if (!user.avatarUrl) return;
    setConfirmOpen(true);
  }

  function confirmRemove(): void {
    setConfirmOpen(false);

    remove.mutate(undefined, {
      onSuccess: () => toast.show({ title: t('profile.avatarRemoved'), tone: 'success' }),
      onError: () => toast.show({ title: t('profile.avatarError'), tone: 'error' }),
    });
  }

  return {
    inputRef,
    upload,
    remove,
    busy,
    onFile,
    openRemove,
    confirmRemove,
    confirmOpen,
    closeRemove: () => setConfirmOpen(false),
  };
}
