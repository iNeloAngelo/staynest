import type { ListingPhotoDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/ui';
import { photoErrorKey } from '../model/errors';
import { usePhotoActions } from '../model/usePhotoActions';
import { usePhotoOrder } from '../model/usePhotoOrder';
import { PhotoTile } from './PhotoTile';

type PhotoGridProps = {
  listingId: string;
  photos: ListingPhotoDto[];
  disabled: boolean;
  onRemove: (photo: ListingPhotoDto) => void;
  onFiles: (files: File[]) => void;
};

export function PhotoGrid({ listingId, photos, disabled, onRemove, onFiles }: PhotoGridProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const order = usePhotoOrder(listingId, photos);
  const actions = usePhotoActions(listingId);

  function makeCover(photoId: string): void {
    actions.cover.mutateAsync(photoId).catch((error: unknown) => {
      toast.show({ title: t(photoErrorKey(error)), tone: 'error' });
    });
  }

  const busy = disabled || order.reordering || actions.cover.isPending;

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {order.ordered.map((photo, index) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          index={index}
          total={order.ordered.length}
          disabled={busy}
          dragging={order.dragged === photo.id}
          onCover={makeCover}
          onMove={order.move}
          onRemove={onRemove}
          onDragStart={order.setDragged}
          onDragEnd={() => order.setDragged(null)}
          onDrop={order.dropOn}
          onFiles={onFiles}
        />
      ))}
    </ul>
  );
}
