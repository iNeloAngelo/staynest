import type {
  AmenitiesResponse,
  CreateListingInput,
  ListingDto,
  ListingResponse,
  ListingsResponse,
  UpdateListingAmenitiesInput,
  UpdateListingInput,
} from '@staynest/shared';
import { api } from '../../../shared/api';

export async function fetchMyListings(): Promise<ListingDto[]> {
  const response = await api.get<ListingsResponse>('/me/listings');
  return response.listings;
}

export async function fetchAmenities(): Promise<AmenitiesResponse['amenities']> {
  const response = await api.get<AmenitiesResponse>('/amenities');
  return response.amenities;
}

export async function createListing(input: CreateListingInput = {}): Promise<ListingDto> {
  const response = await api.post<ListingResponse>('/listings', input);
  return response.listing;
}

export async function updateListing(id: string, input: UpdateListingInput): Promise<ListingDto> {
  const response = await api.patch<ListingResponse>(`/listings/${id}`, input);
  return response.listing;
}

export async function replaceListingAmenities(
  id: string,
  input: UpdateListingAmenitiesInput,
): Promise<ListingDto> {
  const response = await api.put<ListingResponse>(`/listings/${id}/amenities`, input);
  return response.listing;
}

export async function publishListing(id: string): Promise<ListingDto> {
  const response = await api.post<ListingResponse>(`/listings/${id}/publish`);
  return response.listing;
}

export async function archiveListing(id: string): Promise<ListingDto> {
  const response = await api.post<ListingResponse>(`/listings/${id}/archive`);
  return response.listing;
}

export async function deleteListing(id: string): Promise<void> {
  await api.delete<void>(`/listings/${id}`);
}
