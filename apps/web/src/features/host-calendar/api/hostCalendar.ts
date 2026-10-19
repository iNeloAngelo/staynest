import type {
  BlockDto,
  BlockInput,
  HostCalendarResponse,
  PriceRuleDto,
  PriceRuleInput,
  PriceRulePatch,
  PriceRuleResponse,
  PriceRulesResponse,
} from '@staynest/shared';
import { api } from '../../../shared/api';

function calendarParams(from: string, to: string): string {
  return new URLSearchParams({ from, to }).toString();
}

export async function fetchHostCalendar(
  listingId: string,
  from: string,
  to: string,
): Promise<HostCalendarResponse> {
  return api.get<HostCalendarResponse>(
    `/listings/${listingId}/calendar/host?${calendarParams(from, to)}`,
  );
}

export async function fetchPriceRules(listingId: string): Promise<PriceRuleDto[]> {
  const response = await api.get<PriceRulesResponse>(`/listings/${listingId}/price-rules`);
  return response.priceRules;
}

export async function createPriceRule(
  listingId: string,
  input: PriceRuleInput,
): Promise<PriceRuleDto> {
  const response = await api.post<PriceRuleResponse>(`/listings/${listingId}/price-rules`, input);
  return response.priceRule;
}

export async function updatePriceRule(
  listingId: string,
  ruleId: string,
  input: PriceRulePatch,
): Promise<PriceRuleDto> {
  const response = await api.patch<PriceRuleResponse>(
    `/listings/${listingId}/price-rules/${ruleId}`,
    input,
  );
  return response.priceRule;
}

export async function deletePriceRule(listingId: string, ruleId: string): Promise<void> {
  await api.delete<void>(`/listings/${listingId}/price-rules/${ruleId}`);
}

export async function createBlock(listingId: string, input: BlockInput): Promise<BlockDto> {
  const response = await api.post<{ block: BlockDto }>(`/listings/${listingId}/blocks`, input);
  return response.block;
}

export async function deleteBlock(listingId: string, blockId: string): Promise<void> {
  await api.delete<void>(`/listings/${listingId}/blocks/${blockId}`);
}
