import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePhoto, reorderPhotos, setCoverPhoto } from '../api/photos';

function useInvalidateListingPhotos() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] });
}

export function usePhotoActions(listingId: string) {
  const invalidate = useInvalidateListingPhotos();

  const reorder = useMutation({
    mutationFn: (photoIds: string[]) => reorderPhotos(listingId, { photoIds }),
    onSuccess: () => invalidate(),
  });

  const cover = useMutation({
    mutationFn: (photoId: string) => setCoverPhoto(listingId, photoId),
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => deletePhoto(listingId, photoId),
    onSuccess: () => invalidate(),
  });

  return {
    reorder,
    cover,
    remove,
    busy: reorder.isPending || cover.isPending || remove.isPending,
  };
}
