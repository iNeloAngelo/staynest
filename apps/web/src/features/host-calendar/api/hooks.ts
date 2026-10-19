import type {
  BlockInput,
  HostCalendarResponse,
  PriceRuleDto,
  PriceRuleInput,
  PriceRulePatch,
} from '@staynest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBlock,
  createPriceRule,
  deleteBlock,
  deletePriceRule,
  fetchHostCalendar,
  fetchPriceRules,
  updatePriceRule,
} from './hostCalendar';

const hostKeys = {
  calendar: (listingId: string, from: string, to: string) =>
    ['host-calendar', listingId, from, to] as const,
  rules: (listingId: string) => ['host-calendar', 'rules', listingId] as const,
};

const CALENDAR_STALE_TIME_MS = 15_000;

function useInvalidateCalendar(listingId: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['host-calendar', listingId] });
    void queryClient.invalidateQueries({ queryKey: ['booking'] });
  };
}

export function useHostCalendar(listingId: string, from: string, to: string, enabled: boolean) {
  return useQuery<HostCalendarResponse>({
    queryKey: hostKeys.calendar(listingId, from, to),
    queryFn: () => fetchHostCalendar(listingId, from, to),
    enabled: enabled && Boolean(listingId),
    staleTime: CALENDAR_STALE_TIME_MS,
  });
}

export function usePriceRules(listingId: string) {
  return useQuery<PriceRuleDto[]>({
    queryKey: hostKeys.rules(listingId),
    queryFn: () => fetchPriceRules(listingId),
    enabled: Boolean(listingId),
    staleTime: CALENDAR_STALE_TIME_MS,
  });
}

export function useCreatePriceRule(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PriceRuleInput) => createPriceRule(listingId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hostKeys.rules(listingId) });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useUpdatePriceRule(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: PriceRulePatch }) =>
      updatePriceRule(listingId, ruleId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hostKeys.rules(listingId) });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useDeletePriceRule(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => deletePriceRule(listingId, ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hostKeys.rules(listingId) });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
  });
}

export function useCreateBlock(listingId: string) {
  const invalidate = useInvalidateCalendar(listingId);

  return useMutation({
    mutationFn: (input: BlockInput) => createBlock(listingId, input),
    onSettled: () => invalidate(),
  });
}

export function useDeleteBlock(listingId: string) {
  const invalidate = useInvalidateCalendar(listingId);

  return useMutation({
    mutationFn: (blockId: string) => deleteBlock(listingId, blockId),
    onSettled: () => invalidate(),
  });
}
