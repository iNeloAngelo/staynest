import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UserDto,
  VerifyEmailInput,
} from '@staynest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api';
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
    queryFn: fetchMe,
    retry: false,
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => loginRequest(input),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.me, response.user);
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
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.me, null);
      // Данные других пользовательских запросов не должны переживать выход.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.me[0],
      });
    },
  });
}
