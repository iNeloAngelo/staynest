import type {
  ListingPhotoDto,
  ListingPhotosResponse,
  UpdatePhotoOrderInput,
} from '@staynest/shared';
import { api } from '../../../shared/api';

export async function uploadPhoto(
  listingId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<ListingPhotoDto[]> {
  const form = new FormData();
  form.append('files', file, file.name);

  const response = await api.upload<ListingPhotosResponse>(`/listings/${listingId}/photos`, form, {
    onProgress,
  });

  return response.photos;
}

export async function reorderPhotos(
  listingId: string,
  input: UpdatePhotoOrderInput,
): Promise<ListingPhotoDto[]> {
  const response = await api.patch<ListingPhotosResponse>(
    `/listings/${listingId}/photos/order`,
    input,
  );

  return response.photos;
}

export async function setCoverPhoto(
  listingId: string,
  photoId: string,
): Promise<ListingPhotoDto[]> {
  const response = await api.patch<ListingPhotosResponse>(
    `/listings/${listingId}/photos/${photoId}/cover`,
  );

  return response.photos;
}

export async function deletePhoto(listingId: string, photoId: string): Promise<void> {
  await api.delete<void>(`/listings/${listingId}/photos/${photoId}`);
}
