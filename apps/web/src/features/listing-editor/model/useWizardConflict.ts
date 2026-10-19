import { useState } from 'react';
import type { StoredDraft } from './draftStorage';
import { clearStoredDraft } from './draftStorage';
import type { InitialWizardState, WizardNotice } from './wizardState';

export type WizardConflict = {
  notice: WizardNotice | null;
  conflictDraft: StoredDraft | null;
  dismissNotice: () => void;
  takeMine: () => StoredDraft | null;
  keepServer: () => void;
  showRestored: (step: number) => void;
};

export function useWizardConflict(initial: InitialWizardState): WizardConflict {
  const conflict = initial.notice?.kind === 'conflict' ? initial.notice.draft : null;
  const [conflictDraft, setConflictDraft] = useState<StoredDraft | null>(conflict);
  const [notice, setNotice] = useState<WizardNotice | null>(
    initial.notice?.kind === 'conflict' ? null : initial.notice,
  );

  function takeMine(): StoredDraft | null {
    const draft = conflictDraft;
    setConflictDraft(null);
    return draft;
  }

  function keepServer(): void {
    if (conflictDraft) clearStoredDraft(conflictDraft.listingId);
    setConflictDraft(null);
    setNotice(null);
  }

  function showRestored(step: number): void {
    setNotice({ kind: 'restored', step });
  }

  return {
    notice,
    conflictDraft,
    dismissNotice: () => setNotice(null),
    takeMine,
    keepServer,
    showRestored,
  };
}
