import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Modal, useToast } from '../../../shared/ui';

function DialogActions({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button onClick={onClose}>{t('dev.feedback.dialogAction')}</Button>
    </>
  );
}

type FeedbackDialogsProps = {
  modalOpen: boolean;
  sheetOpen: boolean;
  closeModal: () => void;
  closeSheet: () => void;
};

function FeedbackDialogs({ modalOpen, sheetOpen, closeModal, closeSheet }: FeedbackDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={t('dev.feedback.dialogTitle')}
        footer={<DialogActions onClose={closeModal} />}
      >
        <p>{t('dev.feedback.dialogBody')}</p>
      </Modal>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={t('dev.feedback.dialogTitle')}
        footer={<DialogActions onClose={closeSheet} />}
      >
        <p>{t('dev.feedback.dialogBody')}</p>
      </BottomSheet>
    </>
  );
}

export function FeedbackSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  function showSuccess(): void {
    toast.show({
      title: t('dev.feedback.toastSuccessTitle'),
      description: t('dev.feedback.toastSuccessBody'),
      tone: 'success',
    });
  }

  function showError(): void {
    toast.show({
      title: t('dev.feedback.toastErrorTitle'),
      description: t('dev.feedback.toastErrorBody'),
      tone: 'error',
    });
  }

  return (
    <section aria-labelledby="dev-feedback" className="flex flex-col gap-4">
      <h2 id="dev-feedback" className="text-h2 text-ink">
        {t('dev.section.feedback')}
      </h2>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={showSuccess}>{t('dev.feedback.toastSuccess')}</Button>
          <Button variant="secondary" onClick={showError}>
            {t('dev.feedback.toastError')}
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            {t('dev.feedback.modal')}
          </Button>
          <Button variant="ghost" onClick={() => setSheetOpen(true)}>
            {t('dev.feedback.sheet')}
          </Button>
        </div>
      </div>

      <FeedbackDialogs
        modalOpen={modalOpen}
        sheetOpen={sheetOpen}
        closeModal={() => setModalOpen(false)}
        closeSheet={() => setSheetOpen(false)}
      />
    </section>
  );
}
