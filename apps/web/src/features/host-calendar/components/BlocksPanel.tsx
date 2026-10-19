import type { BlockDto } from '@staynest/shared';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLongDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { Modal } from '../../../shared/ui/Modal';
import { useToast } from '../../../shared/ui';
import { useDeleteBlock } from '../api/hooks';
import { hostErrorText } from '../model/errors';

function BlockList({
  blocks,
  online,
  onRemove,
}: {
  blocks: BlockDto[];
  online: boolean;
  onRemove: (block: BlockDto) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <ul className="flex flex-col divide-y divide-border">
      {blocks.map((block) => (
        <li key={block.id} className="flex items-start justify-between gap-3 py-3">
          <div>
            <p className="text-small font-semibold text-ink">
              {t('hostCalendar.ruleRange', {
                from: formatLongDate(block.dateFrom, i18n.language),
                to: formatLongDate(block.dateTo, i18n.language),
              })}
            </p>
            {block.reason ? <p className="text-small text-ink-muted">{block.reason}</p> : null}
          </div>

          <IconButton
            label={`${t('hostCalendar.removeConfirm')}: ${block.dateFrom}`}
            onClick={() => onRemove(block)}
            disabled={!online}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function RemoveBlockDialog({
  target,
  saving,
  onClose,
  onConfirm,
}: {
  target: BlockDto | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={t('hostCalendar.removeTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('hostCalendar.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={saving}>
            {t('hostCalendar.removeConfirm')}
          </Button>
        </>
      }
    >
      <p>{t('hostCalendar.removeBody')}</p>
    </Modal>
  );
}

export function BlocksPanel({
  listingId,
  blocks,
  online,
}: {
  listingId: string;
  blocks: BlockDto[];
  online: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const remove = useDeleteBlock(listingId);
  const [target, setTarget] = useState<BlockDto | null>(null);

  async function confirm(): Promise<void> {
    if (!target) return;

    try {
      await remove.mutateAsync(target.id);
      toast.show({ title: t('hostCalendar.blockRemoved'), tone: 'success' });
      setTarget(null);
    } catch (error) {
      toast.show({
        title: hostErrorText(error, t),
        tone: 'error',
      });
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-h3 text-ink">{t('hostCalendar.blocksTitle')}</h2>
      {blocks.length === 0 ? (
        <p className="text-small text-ink-muted">{t('hostCalendar.noBlocks')}</p>
      ) : (
        <BlockList blocks={blocks} online={online} onRemove={setTarget} />
      )}

      <RemoveBlockDialog
        target={target}
        saving={remove.isPending}
        onClose={() => setTarget(null)}
        onConfirm={() => void confirm()}
      />
    </section>
  );
}
