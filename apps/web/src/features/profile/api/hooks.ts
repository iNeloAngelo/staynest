import type { ChangePasswordInput, UpdateMeInput, UserDto } from '@staynest/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api';
import {
  changePasswordRequest,
  removeAvatarRequest,
  updateMeRequest,
  uploadAvatarRequest,
} from './profile';

function useUserCache() {
  const queryClient = useQueryClient();

  return {
    setUser(user: UserDto): void {
      queryClient.setQueryData(queryKeys.me, user);
    },
  };
}

export function useUpdateProfile() {
  const cache = useUserCache();

  return useMutation({
    mutationFn: (input: UpdateMeInput) => updateMeRequest(input),
    onSuccess: (response) => cache.setUser(response.user),
  });
}

export function useUploadAvatar() {
  const cache = useUserCache();

  return useMutation({
    mutationFn: (file: File) => uploadAvatarRequest(file),
    onSuccess: (response) => cache.setUser(response.user),
  });
}

export function useRemoveAvatar() {
  const cache = useUserCache();

  return useMutation({
    mutationFn: removeAvatarRequest,
    onSuccess: (response) => cache.setUser(response.user),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePasswordRequest(input),
    onSuccess: () => {
      // Сервер уже отозвал сессии и очистил cookie: локальные данные не нужны.
      queryClient.setQueryData(queryKeys.me, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
    },
  });
}
