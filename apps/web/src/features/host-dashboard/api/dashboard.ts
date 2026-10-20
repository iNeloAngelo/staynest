import type { DashboardResponse } from '@staynest/shared';
import { api } from '../../../shared/api';

export async function fetchDashboard(months = 6): Promise<DashboardResponse> {
  return api.get<DashboardResponse>(`/me/dashboard?months=${months}`);
}
