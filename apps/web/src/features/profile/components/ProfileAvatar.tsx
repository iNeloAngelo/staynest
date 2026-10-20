import type { UserDto } from '@staynest/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui';
import { useAvatarControls } from '../model/useAvatarControls';
import { AvatarRemoveDialog } from './AvatarRemoveDialog';

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

type AvatarActionsProps = {
  hasAvatar: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  uploadPending: boolean;
  removePending: boolean;
  busy: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onPick: () => void;
  onRemove: () => void;
};

function AvatarActions({
  hasAvatar,
  inputRef,
  uploadPending,
  removePending,
  busy,
  onFile,
  onPick,
  onRemove,
}: AvatarActionsProps) {
  const { t } = useTranslation();

  return (
    <>
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
          loading={uploadPending}
          disabled={busy}
          leftIcon={<ImagePlus className="size-4" aria-hidden="true" />}
          onClick={onPick}
        >
          {uploadPending
            ? t('profile.avatarUploading')
            : hasAvatar
              ? t('profile.avatarChange')
              : t('profile.avatarUpload')}
        </Button>

        {hasAvatar ? (
          <Button
            variant="ghost"
            loading={removePending}
            disabled={busy}
            leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
            onClick={onRemove}
          >
            {t('profile.avatarRemove')}
          </Button>
        ) : null}
      </div>

      <p className="text-caption text-ink-muted">{t('profile.avatarHint')}</p>
    </>
  );
}

export function ProfileAvatar({ user }: { user: UserDto }) {
  const controls = useAvatarControls(user);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AvatarImage user={user} />

        <div className="flex min-w-0 flex-col gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-h2 text-ink">{user.displayName}</h2>
            <p className="truncate text-small text-ink-muted">{user.email}</p>
          </div>

          <AvatarActions
            hasAvatar={Boolean(user.avatarUrl)}
            inputRef={controls.inputRef}
            uploadPending={controls.upload.isPending}
            removePending={controls.remove.isPending}
            busy={controls.busy}
            onFile={controls.onFile}
            onPick={() => controls.inputRef.current?.click()}
            onRemove={controls.openRemove}
          />
        </div>
      </div>

      <AvatarRemoveDialog
        open={controls.confirmOpen}
        pending={controls.remove.isPending}
        onClose={controls.closeRemove}
        onConfirm={controls.confirmRemove}
      />
    </>
  );
}
