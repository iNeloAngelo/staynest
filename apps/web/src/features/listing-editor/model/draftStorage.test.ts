import { beforeEach, describe, expect, it } from 'vitest';
import { completeListing } from '../../../test/api-mocks';
import {
  clearStoredDraft,
  makeStoredDraft,
  readStoredDraft,
  writeStoredDraft,
} from './draftStorage';
import { fromListing } from './form';

const listingId = completeListing.id;

function snapshot(overrides: Partial<Parameters<typeof makeStoredDraft>[0]> = {}) {
  return makeStoredDraft({
    listingId,
    form: fromListing(completeListing),
    step: 2,
    maxReached: 3,
    baseUpdatedAt: completeListing.updatedAt,
    dirty: true,
    ...overrides,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('draft storage', () => {
  it('сохраняет и возвращает снимок черновика', () => {
    writeStoredDraft(snapshot());

    const restored = readStoredDraft(listingId);
    expect(restored).toMatchObject({
      listingId,
      step: 2,
      maxReached: 3,
      dirty: true,
    });
    expect(restored?.form.title).toBe('Дом у озера');
  });

  it('игнорирует снимок другого объявления', () => {
    writeStoredDraft(snapshot());

    expect(readStoredDraft('4d1e2f3a-0000-4000-8000-000000000000')).toBeNull();
  });

  it('не падает на битом JSON и неизвестной версии', () => {
    window.localStorage.setItem(`staynest:listing-draft:${listingId}`, '{broken');
    expect(readStoredDraft(listingId)).toBeNull();

    window.localStorage.setItem(
      `staynest:listing-draft:${listingId}`,
      JSON.stringify({ ...snapshot(), version: 99 }),
    );
    expect(readStoredDraft(listingId)).toBeNull();
  });

  it('удаляет снимок после публикации или удаления', () => {
    writeStoredDraft(snapshot());
    clearStoredDraft(listingId);

    expect(readStoredDraft(listingId)).toBeNull();
  });

  it('сохраняет несохранённые правки как dirty', () => {
    writeStoredDraft(snapshot({ dirty: false }));

    expect(readStoredDraft(listingId)?.dirty).toBe(false);
  });
});
