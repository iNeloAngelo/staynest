import type { HealthResponse } from '@staynest/shared';
import { api } from './client';

export function fetchHealth(): Promise<HealthResponse> {
  return api.get<HealthResponse>('/health', { authRetry: false });
}
