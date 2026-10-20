import type { ChangePasswordInput, UpdateMeInput, UserResponse } from '@staynest/shared';
import { api } from '../../../shared/api';

export function updateMeRequest(input: UpdateMeInput): Promise<UserResponse> {
  return api.patch<UserResponse>('/me', input);
}

export function uploadAvatarRequest(file: File): Promise<UserResponse> {
  const form = new FormData();
  form.append('avatar', file);
  return api.upload<UserResponse>('/me/avatar', form);
}

export function removeAvatarRequest(): Promise<UserResponse> {
  return api.delete<UserResponse>('/me/avatar');
}

export function changePasswordRequest(input: ChangePasswordInput): Promise<void> {
  return api.post<void>('/auth/change-password', input, { authRetry: false });
}
