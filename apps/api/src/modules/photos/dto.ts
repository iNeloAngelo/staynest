import type { ListingPhotoDto } from '@staynest/shared';
import { variantKey } from '../../platform/storage/index';
import type { MediaStorage } from '../../platform/storage/index';
import type { PhotoRow } from './repo';

export function toPhotoDto(row: PhotoRow, storage: MediaStorage): ListingPhotoDto {
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    position: row.position,
    isCover: row.is_cover,
    urls: {
      thumb: storage.publicUrl(variantKey(row.storage_prefix, 'thumb')),
      md: storage.publicUrl(variantKey(row.storage_prefix, 'md')),
      lg: storage.publicUrl(variantKey(row.storage_prefix, 'lg')),
    },
  };
}
