import type { ListingPhotoDto } from '@staynest/shared';
import { ChevronLeft, ChevronRight, Star, Trash2 } from 'lucide-react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../shared/ui';

type PhotoTileProps = {
  photo: ListingPhotoDto;
  index: number;
  total: number;
  disabled: boolean;
  dragging: boolean;
  onCover: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (photo: ListingPhotoDto) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (id: string) => void;
  onFiles: (files: File[]) => void;
};

function TilePreview({ photo, index }: { photo: ListingPhotoDto; index: number }) {
  const { t } = useTranslation();

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      <img
        src={photo.urls.thumb}
        srcSet={`${photo.urls.thumb} 400w, ${photo.urls.md} 1000w, ${photo.urls.lg} 2000w`}
        sizes="(min-width: 640px) 33vw, 50vw"
        alt={t('photos.alt', { index: index + 1 })}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />

      {photo.isCover ? (
        <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2.5 py-1 text-caption font-semibold text-ink shadow-sm">
          {t('photos.cover')}
        </span>
      ) : null}
    </div>
  );
}

function TileControls({
  photo,
  index,
  total,
  disabled,
  onCover,
  onMove,
  onRemove,
}: Omit<PhotoTileProps, 'dragging' | 'onDragStart' | 'onDragEnd' | 'onDrop' | 'onFiles'>) {
  const { t } = useTranslation();

  return (
    <figcaption className="grid grid-cols-2 gap-1 border-t border-border p-1 sm:grid-cols-4">
      <IconButton
        label={photo.isCover ? t('photos.cover') : t('photos.makeCover')}
        disabled={disabled || photo.isCover}
        onClick={() => onCover(photo.id)}
      >
        <Star className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton
        label={t('photos.moveEarlier')}
        disabled={disabled || index === 0}
        onClick={() => onMove(photo.id, -1)}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton
        label={t('photos.moveLater')}
        disabled={disabled || index === total - 1}
        onClick={() => onMove(photo.id, 1)}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton
        label={t('photos.remove')}
        tone="danger"
        disabled={disabled}
        onClick={() => onRemove(photo)}
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </IconButton>
    </figcaption>
  );
}

export function PhotoTile(props: PhotoTileProps) {
  const { onDragStart, onDragEnd, onDrop, onFiles, dragging, ...rest } = props;

  function dragStart(event: DragEvent<HTMLLIElement>): void {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', props.photo.id);
    onDragStart(props.photo.id);
  }

  function drop(event: DragEvent<HTMLLIElement>): void {
    event.preventDefault();
    if (props.disabled) return;

    if (Array.from(event.dataTransfer.types).includes('Files')) {
      onFiles(Array.from(event.dataTransfer.files));
      return;
    }

    onDrop(props.photo.id);
  }

  return (
    <li
      draggable={!props.disabled}
      onDragStart={dragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={drop}
      className={dragging ? 'opacity-60' : undefined}
    >
      <figure className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface">
        <TilePreview photo={props.photo} index={props.index} />
        <TileControls {...rest} />
      </figure>
    </li>
  );
}
