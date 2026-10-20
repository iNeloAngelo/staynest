import type { ListingPhotoDto } from '@staynest/shared';
import { ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';

function photoSrcSet(photo: ListingPhotoDto): string {
  return `${photo.urls.thumb} 400w, ${photo.urls.md} 1000w, ${photo.urls.lg} 2000w`;
}

export function GalleryPhoto({
  photo,
  title,
  index,
  className,
  sizes,
}: {
  photo: ListingPhotoDto;
  title: string;
  index: number;
  className?: string;
  sizes?: string;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imgRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, [photo.urls.md]);

  if (failed) {
    return (
      <div
        className={cn(
          'flex size-full items-center justify-center bg-surface-2 text-ink-muted',
          className,
        )}
      >
        <ImageOff className="size-8" aria-hidden="true" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={photo.urls.md}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={t('listing.photoAlt', { title, index: index + 1 })}
      width={photo.width}
      height={photo.height}
      loading={index === 0 ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('size-full object-cover', className)}
    />
  );
}
