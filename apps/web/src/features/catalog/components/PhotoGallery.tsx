import type { ListingPhotoDto } from '@staynest/shared';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';
import { IconButton } from '../../../shared/ui/IconButton';
import { Modal } from '../../../shared/ui/Modal';

type PhotoGalleryProps = {
  photos: ListingPhotoDto[];
  title: string;
};

type PhotoListProps = PhotoGalleryProps & {
  onOpen: (index: number) => void;
};

function photoSrcSet(photo: ListingPhotoDto): string {
  return `${photo.urls.thumb} 400w, ${photo.urls.md} 1000w, ${photo.urls.lg} 2000w`;
}

function GalleryPhoto({
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

function EmptyGallery() {
  const { t } = useTranslation();

  return (
    <div className="flex aspect-[16/10] items-center justify-center gap-2 rounded-lg bg-surface-2 text-ink-muted">
      <ImageOff className="size-8" aria-hidden="true" strokeWidth={1.5} />
      <span className="text-small">{t('listing.noPhotos')}</span>
    </div>
  );
}

function CarouselControls({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
        <IconButton
          label={t('listing.prevPhoto')}
          onClick={onPrev}
          className="bg-surface/90 shadow-sm"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('listing.nextPhoto')}
          onClick={onNext}
          className="bg-surface/90 shadow-sm"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </IconButton>
      </div>
      <p className="absolute right-2 bottom-2 rounded-full bg-ink/75 px-2 py-0.5 text-caption font-medium text-bg tabular-nums">
        {t('listing.counter', { current: index + 1, total })}
      </p>
    </>
  );
}

function MobileCarousel({ photos, title, onOpen }: PhotoListProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = photos.length;

  const goTo = (next: number) => {
    const bounded = (next + total) % total;
    const node = ref.current;
    if (node) node.scrollTo({ left: bounded * node.clientWidth, behavior: 'smooth' });
    setIndex(bounded);
  };

  return (
    <section aria-label={t('listing.gallery')} className="relative lg:hidden">
      <div
        ref={ref}
        role="group"
        aria-roledescription="carousel"
        aria-label={t('listing.gallery')}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          if (width > 0) setIndex(Math.round(event.currentTarget.scrollLeft / width));
        }}
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto rounded-lg bg-surface-2 [scrollbar-width:none]"
      >
        {photos.map((photo, photoIndex) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photoIndex)}
            aria-label={t('listing.openPhoto', { index: photoIndex + 1 })}
            className="w-full shrink-0 snap-center"
          >
            <GalleryPhoto photo={photo} title={title} index={photoIndex} sizes="100vw" />
          </button>
        ))}
      </div>

      {total > 1 ? (
        <CarouselControls
          index={index}
          total={total}
          onPrev={() => goTo(index - 1)}
          onNext={() => goTo(index + 1)}
        />
      ) : null}
    </section>
  );
}

function DesktopMosaic({ photos, title, onOpen }: PhotoListProps) {
  const { t } = useTranslation();
  const visible = photos.slice(0, 5);
  const rows = Math.max(1, visible.length - 1);

  return (
    <section aria-label={t('listing.gallery')} className="hidden lg:block">
      <div
        className="grid aspect-[16/10] gap-2 overflow-hidden rounded-lg"
        style={{
          gridTemplateColumns: visible.length > 1 ? '2fr 1fr' : '1fr',
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={t('listing.openPhoto', { index: index + 1 })}
            style={index === 0 ? { gridRow: `span ${rows}` } : undefined}
            className="relative overflow-hidden bg-surface-2"
          >
            <GalleryPhoto
              photo={photo}
              title={title}
              index={index}
              sizes={index === 0 ? '600px' : '300px'}
              className={cn(
                'transition-transform duration-panel hover:scale-[1.03] motion-reduce:transform-none',
              )}
            />
            {index === 4 && photos.length > 5 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/75 text-h3 font-semibold text-bg">
                +{photos.length - 5}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function LightboxControls({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <IconButton label={t('listing.prevPhoto')} onClick={onPrev}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </IconButton>
      <span className="text-small text-ink-muted tabular-nums">
        {t('listing.counter', { current: index + 1, total })}
      </span>
      <IconButton label={t('listing.nextPhoto')} onClick={onNext}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </IconButton>
    </div>
  );
}

function Lightbox({
  photos,
  title,
  index,
  setIndex,
  open,
  onClose,
}: PhotoGalleryProps & {
  index: number;
  setIndex: (index: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const photo = photos[index];
  const total = photos.length;

  useEffect(() => {
    if (!open || total < 2) return;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((index - 1 + total) % total);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((index + 1) % total);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, open, setIndex, total]);

  return (
    <Modal open={open} onClose={onClose} title={t('listing.gallery')}>
      {photo ? (
        <div className="flex flex-col gap-3">
          <img
            src={photo.urls.lg}
            srcSet={photoSrcSet(photo)}
            sizes="100vw"
            alt={t('listing.photoAlt', { title, index: index + 1 })}
            width={photo.width}
            height={photo.height}
            className="max-h-[65dvh] w-full rounded-md object-contain"
          />

          {total > 1 ? (
            <LightboxControls
              index={index}
              total={total}
              onPrev={() => setIndex((index - 1 + total) % total)}
              onNext={() => setIndex((index + 1) % total)}
            />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

export function PhotoGallery({ photos, title }: PhotoGalleryProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) return <EmptyGallery />;

  const openAt = (next: number) => {
    setIndex(next);
    setOpen(true);
  };

  return (
    <>
      <MobileCarousel photos={photos} title={title} onOpen={openAt} />
      <DesktopMosaic photos={photos} title={title} onOpen={openAt} />
      <Lightbox
        photos={photos}
        title={title}
        index={index}
        setIndex={setIndex}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
