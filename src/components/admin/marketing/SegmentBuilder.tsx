import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCustomerTags } from '@/hooks/useCustomerTags';
import type { SegmentFilterRules } from '@/types/marketing';
import { useTranslation } from 'react-i18next';

interface SegmentBuilderProps {
  filterRules: SegmentFilterRules;
  onChange: (rules: SegmentFilterRules) => void;
  memberCount?: number;
}

// Landnamen staan als i18n-key; `code` is de ISO-code en blijft letterlijk.
const COUNTRIES = [
  { code: 'NL', nameKey: 'admin.marketing.segmentBuilder.countries.NL' },
  { code: 'BE', nameKey: 'admin.marketing.segmentBuilder.countries.BE' },
  { code: 'DE', nameKey: 'admin.marketing.segmentBuilder.countries.DE' },
  { code: 'FR', nameKey: 'admin.marketing.segmentBuilder.countries.FR' },
  { code: 'LU', nameKey: 'admin.marketing.segmentBuilder.countries.LU' },
];

export function SegmentBuilder({ filterRules, onChange, memberCount }: SegmentBuilderProps) {
  const { t } = useTranslation();
  const { data: availableTags = [] } = useCustomerTags();

  const updateRule = <K extends keyof SegmentFilterRules>(key: K, value: SegmentFilterRules[K]) => {
    onChange({ ...filterRules, [key]: value });
  };

  const addCountry = (code: string) => {
    const countries = filterRules.countries || [];
    if (!countries.includes(code)) {
      updateRule('countries', [...countries, code]);
    }
  };

  const removeCountry = (code: string) => {
    const countries = filterRules.countries || [];
    updateRule('countries', countries.filter(c => c !== code));
  };

  const addTag = (tag: string) => {
    const tags = filterRules.tags || [];
    if (!tags.includes(tag)) {
      updateRule('tags', [...tags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    const tags = filterRules.tags || [];
    updateRule('tags', tags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-6">
      {memberCount !== undefined && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="text-2xl font-bold">{memberCount.toLocaleString('nl-NL')}</div>
          <p className="text-sm text-muted-foreground">{t('admin.marketing.segmentBuilder.klanten_in_dit_segment')}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Customer Type */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.klanttype')}</Label>
          <Select
            value={filterRules.customer_type || 'all'}
            onValueChange={(value) => updateRule('customer_type', value as 'b2c' | 'b2b' | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.marketing.segmentBuilder.alle_klanten')}</SelectItem>
              <SelectItem value="b2c">{t('admin.marketing.segmentBuilder.particulier_b2c')}</SelectItem>
              <SelectItem value="b2b">{t('admin.marketing.segmentBuilder.zakelijk_b2b')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.tags')}</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(filterRules.tags || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {availableTags.length > 0 ? (
            <Select onValueChange={addTag}>
              <SelectTrigger>
                <SelectValue placeholder={t('admin.marketing.segmentBuilder.tag_toevoegen')} />
              </SelectTrigger>
              <SelectContent>
                {availableTags.filter(t => !(filterRules.tags || []).includes(t)).map((tag) => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">{t('admin.marketing.segmentBuilder.geen_tags_beschikbaar_bij_klanten')}</p>
          )}
          {(filterRules.tags || []).length > 1 && (
            <div className="flex items-center gap-3 mt-2">
              <Label className="text-xs">{t('admin.marketing.segmentBuilder.match_logica')}</Label>
              <Select
                value={filterRules.tags_match || 'any'}
                onValueChange={(value) => updateRule('tags_match', value as 'any' | 'all')}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('admin.marketing.segmentBuilder.minstens_een_tag_of')}</SelectItem>
                  <SelectItem value="all">{t('admin.marketing.segmentBuilder.alle_tags_en')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Email Subscribed */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.nieuwsbrief_status')}</Label>
          <Select
            value={filterRules.email_subscribed === undefined ? 'all' : filterRules.email_subscribed ? 'yes' : 'no'}
            onValueChange={(value) => {
              if (value === 'all') {
                const newRules = { ...filterRules };
                delete newRules.email_subscribed;
                onChange(newRules);
              } else {
                updateRule('email_subscribed', value === 'yes');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.marketing.segmentBuilder.alle_klanten_2')}</SelectItem>
              <SelectItem value="yes">{t('admin.marketing.segmentBuilder.geabonneerd')}</SelectItem>
              <SelectItem value="no">{t('admin.marketing.segmentBuilder.niet_geabonneerd')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Countries */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.landen')}</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(filterRules.countries || []).map((code) => {
              const country = COUNTRIES.find(c => c.code === code);
              return (
                <Badge key={code} variant="secondary" className="gap-1">
                  {country ? t(country.nameKey) : code}
                  <button onClick={() => removeCountry(code)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          <Select onValueChange={addCountry}>
            <SelectTrigger>
              <SelectValue placeholder={t('admin.marketing.segmentBuilder.land_toevoegen')} />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.filter(c => !(filterRules.countries || []).includes(c.code)).map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {t(country.nameKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Order Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.min_bestellingen')}</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.min_orders ?? ''}
              onChange={(e) => updateRule('min_orders', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.max_bestellingen')}</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.max_orders ?? ''}
              onChange={(e) => updateRule('max_orders', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="∞"
            />
          </div>
        </div>

        {/* Total Spent */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.min_besteed')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={filterRules.min_total_spent ?? ''}
              onChange={(e) => updateRule('min_total_spent', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.max_besteed')}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={filterRules.max_total_spent ?? ''}
              onChange={(e) => updateRule('max_total_spent', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="∞"
            />
          </div>
        </div>

        {/* Created date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.klant_aangemaakt_na')}</Label>
            <Input
              type="date"
              value={filterRules.created_after ?? ''}
              onChange={(e) => updateRule('created_after', e.target.value || undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.klant_aangemaakt_voor')}</Label>
            <Input
              type="date"
              value={filterRules.created_before ?? ''}
              onChange={(e) => updateRule('created_before', e.target.value || undefined)}
            />
          </div>
        </div>

        {/* Activity */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.laatste_bestelling_dagen_geleden')}</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.last_order_days_ago ?? ''}
              onChange={(e) => updateRule('last_order_days_ago', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder={t('admin.marketing.segmentBuilder.bijv_30')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.marketing.segmentBuilder.inactief_sinds_dagen')}</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.no_order_since_days ?? ''}
              onChange={(e) => updateRule('no_order_since_days', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder={t('admin.marketing.segmentBuilder.bijv_90')}
            />
          </div>
        </div>

        {/* Engagement Score */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.min_engagement_score_0_100')}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={filterRules.min_engagement_score ?? ''}
            onChange={(e) => updateRule('min_engagement_score', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="0"
          />
        </div>

        {/* Preferred language */}
        <div className="space-y-2">
          <Label>{t('admin.marketing.segmentBuilder.voorkeurstaal_klant')}</Label>
          <Select
            value={filterRules.preferred_language || 'any'}
            onValueChange={(value) => {
              if (value === 'any') {
                const r = { ...filterRules };
                delete r.preferred_language;
                onChange(r);
              } else {
                updateRule('preferred_language', value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('admin.marketing.segmentBuilder.alle_talen')}</SelectItem>
              <SelectItem value="nl">{t('admin.marketing.segmentBuilder.nederlands')}</SelectItem>
              <SelectItem value="en">{t('admin.marketing.segmentBuilder.english')}</SelectItem>
              <SelectItem value="fr">{t('admin.marketing.segmentBuilder.francais')}</SelectItem>
              <SelectItem value="de">{t('admin.marketing.segmentBuilder.deutsch')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
