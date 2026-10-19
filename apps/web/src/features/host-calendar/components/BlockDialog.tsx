import type { BlockInput } from '@staynest/shared';
import { addDays } from '@staynest/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLongDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { Modal } from '../../../shared/ui/Modal';
import type { IsoRange } from '../../booking/model/selection';

function BlockForm({
  range,
  reason,
  error,
  onReasonChange,
}: {
  range: { from: string; to: string };
  reason: string;
  error: string | null;
  onReasonChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <p>
        {t('hostCalendar.blockNights', {
          from: formatLongDate(range.from, i18n.language),
          to: formatLongDate(addDays(range.to, -1), i18n.language),
        })}
      </p>
      <p className="text-small text-ink-muted">{t('hostCalendar.blockBody')}</p>
      <Input
        label={t('hostCalendar.reason')}
        placeholder={t('hostCalendar.reasonPlaceholder')}
        value={reason}
        maxLength={200}
        onChange={(event) => onReasonChange(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function BlockDialog({
  open,
  range,
  saving,
  error,
  online,
  onClose,
  onSubmit,
}: {
  open: boolean;
  range: IsoRange | undefined;
  saving: boolean;
  error: string | null;
  online: boolean;
  onClose: () => void;
  onSubmit: (input: BlockInput) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!range?.from || !range.to) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hostCalendar.blockTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('hostCalendar.cancel')}
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                dateFrom: range.from,
                dateTo: addDays(range.to ?? range.from, -1),
                reason: reason.trim() || undefined,
              })
            }
            loading={saving}
            disabled={saving || !online}
          >
            {t('hostCalendar.blockAction')}
          </Button>
        </>
      }
    >
      <BlockForm
        range={{ from: range.from, to: range.to }}
        reason={reason}
        error={error}
        onReasonChange={setReason}
      />
    </Modal>
  );
}
