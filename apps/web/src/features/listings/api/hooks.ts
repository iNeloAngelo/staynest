import type {
  CreateListingInput,
  ListingDto,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveListing,
  createListing,
  deleteListing,
  fetchAmenities,
  fetchMyListings,
  publishListing,
  replaceListingAmenities,
  updateListing,
} from './listings';

const listingKeys = {
  mine: ['listings', 'mine'] as const,
  amenities: ['amenities'] as const,
};

const LISTINGS_STALE_TIME_MS = 15_000;
const AMENITIES_STALE_TIME_MS = 10 * 60 * 1000;

function useInvalidateMine() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey: listingKeys.mine,
      refetchType: 'active',
    });
}

export function useMyListings() {
  return useQuery<ListingDto[]>({
    queryKey: listingKeys.mine,
    queryFn: fetchMyListings,
    staleTime: LISTINGS_STALE_TIME_MS,
  });
}

export function useAmenities() {
  return useQuery({
    queryKey: listingKeys.amenities,
    queryFn: fetchAmenities,
    staleTime: AMENITIES_STALE_TIME_MS,
  });
}

export function useCreateListing() {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: (input: CreateListingInput = {}) => createListing(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateListing(id: string) {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: (input: UpdateListingInput) => updateListing(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useReplaceAmenities(id: string) {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: (input: UpdateListingAmenitiesInput) => replaceListingAmenities(id, input),
    onSuccess: () => invalidate(),
  });
}

export function usePublishListing() {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: publishListing,
    onSuccess: () => invalidate(),
  });
}

export function useArchiveListing() {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: archiveListing,
    onSuccess: () => invalidate(),
  });
}

export function useDeleteListing() {
  const invalidate = useInvalidateMine();

  return useMutation({
    mutationFn: deleteListing,
    onSuccess: () => invalidate(),
  });
}
