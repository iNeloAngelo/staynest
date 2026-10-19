import type { PriceRuleDto } from '@staynest/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { formatMoney } from '../../../shared/lib/format';
import { formatShortDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';

function RuleItem({
  rule,
  currency,
  online,
  onEdit,
  onDelete,
}: {
  rule: PriceRuleDto;
  currency: string;
  online: boolean;
  onEdit: (rule: PriceRuleDto) => void;
  onDelete: (rule: PriceRuleDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">{rule.name}</p>
        <p className="text-small text-ink-muted">
          {t('hostCalendar.ruleRange', {
            from: formatShortDate(rule.dateFrom, i18n.language),
            to: formatShortDate(rule.dateTo, i18n.language),
          })}
        </p>
        <p className="text-small text-ink">
          {formatMoney(rule.nightlyPriceMinor, locale, currency)}{' '}
          <span className="text-ink-muted">/ {t('listing.price.perNight')}</span>
        </p>
        <p className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
          {rule.minNights !== null ? (
            <span>{t('hostCalendar.ruleMinNights', { count: rule.minNights })}</span>
          ) : null}
          <span>{t('hostCalendar.rulePriority', { count: rule.priority })}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <IconButton
          label={`${t('hostCalendar.editRule')}: ${rule.name}`}
          onClick={() => onEdit(rule)}
          disabled={!online}
        >
          <Pencil className="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`${t('hostCalendar.deleteRule')}: ${rule.name}`}
          onClick={() => onDelete(rule)}
          disabled={!online}
        >
          <Trash2 className="size-5" aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  );
}

export function PriceRulesSection({
  rules,
  loading,
  error,
  currency,
  online,
  onAdd,
  onEdit,
  onDelete,
}: {
  rules: PriceRuleDto[];
  loading: boolean;
  error: boolean;
  currency: string;
  online: boolean;
  onAdd: () => void;
  onEdit: (rule: PriceRuleDto) => void;
  onDelete: (rule: PriceRuleDto) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 text-ink">{t('hostCalendar.rulesTitle')}</h2>
          <p className="mt-1 text-small text-ink-muted">{t('hostCalendar.rulesHint')}</p>
        </div>
        <Button
          variant="secondary"
          onClick={onAdd}
          disabled={!online}
          leftIcon={<Plus className="size-4" aria-hidden="true" />}
        >
          {t('hostCalendar.addRule')}
        </Button>
      </div>

      {loading ? (
        <p className="text-small text-ink-muted">{t('common.loading')}</p>
      ) : error ? (
        <p className="text-small text-danger">{t('hostCalendar.loadErrorBody')}</p>
      ) : rules.length === 0 ? (
        <p className="text-small text-ink-muted">{t('hostCalendar.noRules')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rules.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              currency={currency}
              online={online}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
