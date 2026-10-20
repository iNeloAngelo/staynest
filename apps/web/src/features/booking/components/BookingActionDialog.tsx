import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOOKING_MESSAGE_MAX, BOOKING_REASON_MAX } from '@staynest/shared';
import { Button, Modal, Textarea } from '../../../shared/ui';

export type BookingActionKind = 'confirm' | 'decline' | 'cancel-guest' | 'cancel-host';

const TITLE_KEYS = {
  confirm: 'booking.actions.confirmTitle',
  decline: 'booking.actions.declineTitle',
  'cancel-guest': 'booking.actions.cancelGuestTitle',
  'cancel-host': 'booking.actions.cancelHostTitle',
} as const;

const BODY_KEYS = {
  confirm: 'booking.actions.confirmBody',
  decline: 'booking.actions.declineBody',
  'cancel-guest': 'booking.actions.cancelGuestBody',
  'cancel-host': 'booking.actions.cancelHostBody',
} as const;

const SUBMIT_KEYS = {
  confirm: 'booking.actions.confirm',
  decline: 'booking.actions.decline',
  'cancel-guest': 'booking.actions.cancelGuest',
  'cancel-host': 'booking.actions.cancelHost',
} as const;

function CommentField({
  kind,
  value,
  error,
  onChange,
}: {
  kind: BookingActionKind;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  if (kind === 'confirm' || kind === 'cancel-guest') return null;

  const isReason = kind === 'cancel-host';

  return (
    <Textarea
      label={isReason ? t('booking.actions.reason') : t('booking.actions.comment')}
      hint={isReason ? t('booking.actions.reasonHint') : t('booking.actions.commentHint')}
      value={value}
      maxLength={isReason ? BOOKING_REASON_MAX : BOOKING_MESSAGE_MAX}
      currentLength={value.length}
      showCounter
      error={error ?? undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ActionBody({
  kind,
  text,
  localError,
  serverError,
  onChange,
}: {
  kind: BookingActionKind;
  text: string;
  localError: string | null;
  serverError: string | null;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <p>{t(BODY_KEYS[kind])}</p>
      <CommentField kind={kind} value={text} error={localError} onChange={onChange} />
      {serverError ? (
        <p role="alert" className="text-small text-danger">
          {serverError}
        </p>
      ) : null}
    </div>
  );
}

function ActionFooter({
  kind,
  saving,
  onClose,
  onSubmit,
}: {
  kind: BookingActionKind;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const danger = kind !== 'confirm';

  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={saving} onClick={onSubmit}>
        {t(SUBMIT_KEYS[kind])}
      </Button>
    </>
  );
}

export function BookingActionDialog({
  open,
  kind,
  saving,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kind: BookingActionKind;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (value: { comment?: string; reason?: string }) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setLocalError(null);
    }
  }, [open, kind]);

  function submit(): void {
    if (kind === 'cancel-host' && text.trim() === '') {
      setLocalError(t('booking.actions.reasonRequired'));
      return;
    }

    setLocalError(null);
    if (kind === 'cancel-host') onSubmit({ reason: text.trim() });
    else if (kind === 'decline') onSubmit({ comment: text.trim() || undefined });
    else onSubmit({});
  }

  const footer = <ActionFooter kind={kind} saving={saving} onClose={onClose} onSubmit={submit} />;

  return (
    <Modal open={open} onClose={onClose} title={t(TITLE_KEYS[kind])} footer={footer}>
      <ActionBody
        kind={kind}
        text={text}
        localError={localError}
        serverError={serverError}
        onChange={(value) => {
          setText(value);
          setLocalError(null);
        }}
      />
    </Modal>
  );
}
