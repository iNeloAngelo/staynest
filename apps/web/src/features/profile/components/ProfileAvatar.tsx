import type { UserDto } from '@staynest/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui';
import { useAvatarControls } from '../model/useAvatarControls';

function initial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || '?';
}

function AvatarImage({ user }: { user: UserDto }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        width={80}
        height={80}
        className="size-20 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-h2 font-semibold text-on-primary"
    >
      {initial(user.displayName)}
    </span>
  );
}

export function ProfileAvatar({ user }: { user: UserDto }) {
  const { t } = useTranslation();
  const { inputRef, upload, remove, busy, onFile, onRemove } = useAvatarControls(user);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <AvatarImage user={user} />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-h2 text-ink">{user.displayName}</h2>
          <p className="truncate text-small text-ink-muted">{user.email}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onFile}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={upload.isPending}
            disabled={busy}
            leftIcon={<ImagePlus className="size-4" aria-hidden="true" />}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending
              ? t('profile.avatarUploading')
              : user.avatarUrl
                ? t('profile.avatarChange')
                : t('profile.avatarUpload')}
          </Button>

          {user.avatarUrl ? (
            <Button
              variant="ghost"
              loading={remove.isPending}
              disabled={busy}
              leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={onRemove}
            >
              {t('profile.avatarRemove')}
            </Button>
          ) : null}
        </div>

        <p className="text-caption text-ink-muted">{t('profile.avatarHint')}</p>
      </div>
    </div>
  );
}
