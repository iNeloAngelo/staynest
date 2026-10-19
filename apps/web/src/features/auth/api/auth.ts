import type {
  AcceptedResponse,
  LoginInput,
  RegisterInput,
  RegisterResponse,
  ResetPasswordInput,
  UserDto,
  UserResponse,
  VerifyEmailInput,
} from '@staynest/shared';
import { ApiError, api } from '../../../shared/api';

export async function fetchMe(): Promise<UserDto | null> {
  try {
    const response = await api.get<UserResponse>('/me');
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function loginRequest(input: LoginInput): Promise<UserResponse> {
  return api.post<UserResponse>('/auth/login', input, { authRetry: false });
}

export function registerRequest(input: RegisterInput): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', input, { authRetry: false });
}

export function resendVerificationRequest(email: string): Promise<AcceptedResponse> {
  return api.post<AcceptedResponse>('/auth/resend-verification', { email }, { authRetry: false });
}

export function logoutRequest(): Promise<void> {
  return api.post<void>('/auth/logout', undefined, { authRetry: false });
}

export function verifyEmailRequest(input: VerifyEmailInput): Promise<void> {
  return api.post<void>('/auth/verify-email', input, { authRetry: false });
}

export function forgotPasswordRequest(email: string): Promise<AcceptedResponse> {
  return api.post<AcceptedResponse>('/auth/forgot-password', { email }, { authRetry: false });
}

export function resetPasswordRequest(input: ResetPasswordInput): Promise<void> {
  return api.post<void>('/auth/reset-password', input, { authRetry: false });
}
