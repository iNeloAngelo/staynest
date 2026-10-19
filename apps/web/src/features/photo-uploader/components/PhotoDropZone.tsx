import { Camera, ImagePlus, Upload } from 'lucide-react';
import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

type PhotoDropZoneProps = {
  disabled: boolean;
  onFiles: (files: File[]) => void;
};

type FileInputsProps = {
  browseRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
};

function FileInputs({ browseRef, cameraRef, onPick }: FileInputsProps) {
  const { t } = useTranslation();

  return (
    <>
      <input
        ref={browseRef}
        type="file"
        accept={ACCEPT}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={onPick}
        aria-label={t('photos.choose')}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={onPick}
        aria-label={t('photos.camera')}
      />
    </>
  );
}

export function PhotoDropZone({ disabled, onFiles }: PhotoDropZoneProps) {
  const { t } = useTranslation();
  const browseRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  function pick(event: ChangeEvent<HTMLInputElement>): void {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function drop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setActive(false);
    if (disabled) return;
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      onFiles(Array.from(event.dataTransfer.files));
    }
  }

  return (
    <>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={drop}
        className={`flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors duration-micro ${
          active ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        <Upload className="size-6 text-ink-muted" aria-hidden="true" />
        <p className="text-small text-ink-muted">{t('photos.dropHint')}</p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => browseRef.current?.click()}
            leftIcon={<ImagePlus className="size-5" aria-hidden="true" />}
          >
            {t('photos.choose')}
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            leftIcon={<Camera className="size-5" aria-hidden="true" />}
            className="sm:hidden"
          >
            {t('photos.camera')}
          </Button>
        </div>
      </div>

      <FileInputs browseRef={browseRef} cameraRef={cameraRef} onPick={pick} />
    </>
  );
}
