import { beforeEach, describe, expect, it } from 'vitest';
import { completeListing, demoListing } from '../../../test/api-mocks';
import { makeStoredDraft, writeStoredDraft } from './draftStorage';
import { fromListing } from './form';
import { initialWizardState } from './wizardState';

beforeEach(() => {
  window.localStorage.clear();
});

describe('initial wizard state', () => {
  it('начинает пустой черновик с первого шага', () => {
    const initial = initialWizardState(demoListing);

    expect(initial.step).toBe(0);
    expect(initial.notice).toBeNull();
  });

  it('продолжает незаконченный черновик с первого пробела', () => {
    const listing = {
      ...completeListing,
      addressLine: null,
    };

    const initial = initialWizardState(listing);

    expect(initial.step).toBe(1);
    expect(initial.notice).toEqual({ kind: 'resumed', step: 1 });
  });

  it('открывает полное объявление на предпросмотре', () => {
    const initial = initialWizardState(completeListing);

    expect(initial.step).toBe(4);
    expect(initial.notice).toEqual({ kind: 'resumed', step: 4 });
  });

  it('восстанавливает несохранённые правки из localStorage', () => {
    const form = { ...fromListing(demoListing), title: 'Восстановленный дом' };
    writeStoredDraft(
      makeStoredDraft({
        listingId: demoListing.id,
        form,
        step: 0,
        maxReached: 2,
        baseUpdatedAt: demoListing.updatedAt,
        dirty: true,
      }),
    );

    const initial = initialWizardState(demoListing);

    expect(initial.form.title).toBe('Восстановленный дом');
    expect(initial.step).toBe(0);
    expect(initial.maxReached).toBe(2);
    expect(initial.notice).toEqual({ kind: 'restored', step: 0 });
  });

  it('показывает конфликт, если сервер обновился после снимка', () => {
    writeStoredDraft(
      makeStoredDraft({
        listingId: demoListing.id,
        form: { ...fromListing(demoListing), title: 'Моя версия' },
        step: 0,
        maxReached: 0,
        baseUpdatedAt: '2026-10-18T10:00:00.000Z',
        dirty: true,
      }),
    );
    const listing = { ...demoListing, updatedAt: '2026-10-19T12:00:00.000Z' };

    const initial = initialWizardState(listing);

    expect(initial.form.title).toBe('');
    expect(initial.notice?.kind).toBe('conflict');
  });

  it('восстанавливает несохранённые правки опубликованного объявления', () => {
    writeStoredDraft(
      makeStoredDraft({
        listingId: completeListing.id,
        form: { ...fromListing(completeListing), title: 'Старая правка' },
        step: 0,
        maxReached: 0,
        baseUpdatedAt: completeListing.updatedAt,
        dirty: true,
      }),
    );
    const published = { ...completeListing, status: 'published' as const };

    const initial = initialWizardState(published);

    expect(initial.form.title).toBe('Старая правка');
    expect(initial.notice).toEqual({ kind: 'restored', step: 0 });
  });
});
