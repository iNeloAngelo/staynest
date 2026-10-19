import type { ListingPhotoDto } from '@staynest/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/ui';
import { photoErrorKey } from './errors';
import { usePhotoActions } from './usePhotoActions';

function moveItem(list: ListingPhotoDto[], from: number, to: number): ListingPhotoDto[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}

export function usePhotoOrder(listingId: string, photos: ListingPhotoDto[]) {
  const { t } = useTranslation();
  const toast = useToast();
  const actions = usePhotoActions(listingId);
  const [ordered, setOrdered] = useState(photos);
  const [dragged, setDragged] = useState<string | null>(null);

  useEffect(() => {
    setOrdered(photos);
  }, [photos]);

  function persist(next: ListingPhotoDto[]): void {
    setOrdered(next);
    actions.reorder.mutateAsync(next.map((photo) => photo.id)).catch((error: unknown) => {
      setOrdered(photos);
      toast.show({ title: t(photoErrorKey(error)), tone: 'error' });
    });
  }

  function move(photoId: string, delta: -1 | 1): void {
    const from = ordered.findIndex((photo) => photo.id === photoId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    persist(moveItem(ordered, from, to));
  }

  function dropOn(targetId: string): void {
    if (!dragged || dragged === targetId) {
      setDragged(null);
      return;
    }

    const from = ordered.findIndex((photo) => photo.id === dragged);
    const to = ordered.findIndex((photo) => photo.id === targetId);
    setDragged(null);
    if (from >= 0 && to >= 0) persist(moveItem(ordered, from, to));
  }

  return {
    ordered,
    dragged,
    setDragged,
    move,
    dropOn,
    reordering: actions.reorder.isPending,
  };
}
