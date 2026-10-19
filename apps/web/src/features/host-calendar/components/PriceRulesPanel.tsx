import type { PriceRuleDto, PriceRuleInput } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { useToast } from '../../../shared/ui';
import {
  useCreatePriceRule,
  useDeletePriceRule,
  usePriceRules,
  useUpdatePriceRule,
} from '../api/hooks';
import { hostErrorText } from '../model/errors';
import { PriceRuleDialog } from './PriceRuleDialog';
import { PriceRulesSection } from './PriceRulesSection';

function useRuleEditor(listingId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreatePriceRule(listingId);
  const update = useUpdatePriceRule(listingId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PriceRuleDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function start(rule: PriceRuleDto | null): void {
    setEditing(rule);
    setFormError(null);
    setOpen(true);
  }

  async function submit(input: PriceRuleInput): Promise<void> {
    setFormError(null);

    try {
      if (editing) {
        await update.mutateAsync({ ruleId: editing.id, input });
        toast.show({ title: t('hostCalendar.ruleUpdated'), tone: 'success' });
      } else {
        await create.mutateAsync(input);
        toast.show({ title: t('hostCalendar.ruleCreated'), tone: 'success' });
      }
      setOpen(false);
    } catch (error) {
      setFormError(hostErrorText(error, t, 'hostCalendar.formError'));
    }
  }

  return {
    open,
    editing,
    formError,
    saving: create.isPending || update.isPending,
    start,
    submit,
    close: () => setOpen(false),
  };
}

function useRuleDeletion(listingId: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const remove = useDeletePriceRule(listingId);
  const [target, setTarget] = useState<PriceRuleDto | null>(null);

  async function confirm(): Promise<void> {
    if (!target) return;

    try {
      await remove.mutateAsync(target.id);
      toast.show({ title: t('hostCalendar.ruleDeleted'), tone: 'success' });
      setTarget(null);
    } catch (error) {
      toast.show({ title: hostErrorText(error, t), tone: 'error' });
    }
  }

  return { target, saving: remove.isPending, setTarget, confirm };
}

export function PriceRulesPanel({
  listingId,
  currency,
  online,
}: {
  listingId: string;
  currency: string;
  online: boolean;
}) {
  const { t } = useTranslation();
  const query = usePriceRules(listingId);
  const editor = useRuleEditor(listingId);
  const deletion = useRuleDeletion(listingId);

  return (
    <>
      <PriceRulesSection
        rules={query.data ?? []}
        loading={query.isPending}
        error={query.isError}
        currency={currency}
        online={online}
        onAdd={() => editor.start(null)}
        onEdit={editor.start}
        onDelete={deletion.setTarget}
      />

      <PriceRuleDialog
        open={editor.open}
        rule={editor.editing}
        saving={editor.saving}
        error={editor.formError}
        onClose={editor.close}
        onSubmit={(input) => void editor.submit(input)}
      />

      <Modal
        open={deletion.target !== null}
        onClose={() => deletion.setTarget(null)}
        title={t('hostCalendar.confirmDeleteRuleTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => deletion.setTarget(null)}>
              {t('hostCalendar.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => void deletion.confirm()}
              loading={deletion.saving}
            >
              {t('hostCalendar.deleteRule')}
            </Button>
          </>
        }
      >
        <p>{t('hostCalendar.confirmDeleteRuleBody')}</p>
      </Modal>
    </>
  );
}
