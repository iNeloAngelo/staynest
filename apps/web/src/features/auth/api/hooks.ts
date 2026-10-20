import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UserDto,
  VerifyEmailInput,
} from '@staynest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api';
import { detachCurrentDevicePush } from '../../notifications';
import { endSessionLocally } from '../model/end-session';
import { getSessionOwner, rememberSessionOwner } from '../model/session';
import {
  fetchMe,
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
  resendVerificationRequest,
  resetPasswordRequest,
  verifyEmailRequest,
} from './auth';

const ME_STALE_TIME_MS = 5 * 60 * 1000;

export function useMe() {
  return useQuery<UserDto | null>({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      const user = await fetchMe(signal);
      // Восстановленная по cookie сессия тоже должна иметь владельца:
      // иначе истечение токена не сможет очистить чужие кэши.
      if (user) rememberSessionOwner(user.id);
      return user;
    },
    retry: false,
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => loginRequest(input),
    onSuccess: async (response) => {
      const previousOwner = getSessionOwner();
      // Любой вход подчищает прежние кэши: владелец мог быть неизвестен
      // (восстановленная сессия, очищенный localStorage, приватный режим).
      await endSessionLocally(queryClient, {
        detachPush: previousOwner !== null && previousOwner !== response.user.id,
      });

      rememberSessionOwner(response.user.id);
      queryClient.setQueryData(queryKeys.me, response.user);
      // Первый 200 /me прогревает staynest-me для офлайн-чтения.
      void queryClient.invalidateQueries({ queryKey: queryKeys.me, refetchType: 'all' });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => registerRequest(input),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => resendVerificationRequest(email),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (input: VerifyEmailInput) => verifyEmailRequest(input),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => forgotPasswordRequest(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPasswordRequest(input),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Отписка должна успеть до того, как сервер отзовёт cookie.
      await detachCurrentDevicePush().catch(() => undefined);
      return logoutRequest();
    },
    onSuccess: () => endSessionLocally(queryClient, { detachPush: false }),
  });
}
