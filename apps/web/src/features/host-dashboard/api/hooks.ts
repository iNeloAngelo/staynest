import type { DashboardResponse } from '@staynest/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from './dashboard';

const DASHBOARD_STALE_TIME_MS = 60_000;

export function useDashboard(months = 6) {
  return useQuery<DashboardResponse>({
    queryKey: ['host-dashboard', months],
    queryFn: () => fetchDashboard(months),
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}
