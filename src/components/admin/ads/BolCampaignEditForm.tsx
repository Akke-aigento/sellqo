import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2, Wallet, CalendarDays, Ban, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCan } from '@/hooks/useCan';
import { TOOLTIP_NO_ACCESS_SHORT } from '@/lib/permissions/constants';
import { useTranslation } from 'react-i18next';

interface BolCampaign {
  id: string;
  name: string;
  status: string;
  targeting_type: string;
  campaign_type: string;
  daily_budget: number | null;
  total_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  tenant_id: string;
}

interface NegativeKeyword {
  keyword: string;
  matchType: string;
}

interface Props {
  campaign: BolCampaign;
  onClose: () => void;
  adGroupId?: string | null;
}

export function BolCampaignEditForm({ campaign, onClose, adGroupId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  // H4-7: budget-velden = disable+tooltip voor non-tenant_admin (transparantie).
  // Andere campaign-velden blijven gating op 'ads' resource (marketing kan dit).
  const canWriteBudget = useCan('write', 'ad_budgets');

  const [name, setName] = useState(campaign.name);
  const [targetingType, setTargetingType] = useState(campaign.targeting_type || 'AUTO');
  const [dailyBudget, setDailyBudget] = useState(campaign.daily_budget?.toString() ?? '');
  const [totalBudget, setTotalBudget] = useState(campaign.total_budget?.toString() ?? '');
  const [startDate, setStartDate] = useState(campaign.start_date ?? '');
  const [endDate, setEndDate] = useState(campaign.end_date ?? '');
  const [negKeywords, setNegKeywords] = useState<NegativeKeyword[]>([]);
  const [newNegKw, setNewNegKw] = useState('');
  const [newNegMatch, setNewNegMatch] = useState('broad');

  const addNegKeyword = () => {
    if (!newNegKw.trim()) return;
    setNegKeywords(prev => [...prev, { keyword: newNegKw.trim(), matchType: newNegMatch }]);
    setNewNegKw('');
  };

  const removeNegKeyword = (idx: number) => {
    setNegKeywords(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ads_bolcom_campaigns')
        .update({
          name,
          targeting_type: targetingType,
          daily_budget: dailyBudget ? parseFloat(dailyBudget) : null,
          total_budget: totalBudget ? parseFloat(totalBudget) : null,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .eq('id', campaign.id)
        .eq('tenant_id', campaign.tenant_id);

      if (error) throw error;

      // Add negative keywords if any and adGroupId exists
      if (negKeywords.length > 0 && adGroupId) {
        for (const nk of negKeywords) {
          await supabase.functions.invoke('ads-bolcom-manage', {
            body: {
              tenant_id: campaign.tenant_id,
              action: 'add_negative_keyword',
              adgroup_id: adGroupId,
              keyword: nk.keyword,
              match_type: nk.matchType,
            },
          });
        }
      }

      toast.success('Campagne bijgewerkt');
      qc.invalidateQueries({ queryKey: ['bolcom-campaign', campaign.id] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: General */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Settings2 className="h-4 w-4" />
          {t('admin.ads.bolCampaignEditForm.algemeen')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign-name">{t('admin.ads.bolCampaignEditForm.campagnenaam')}</Label>
          <Input id="campaign-name" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t('common.status')}</Label>
          <div>
            <Badge variant="outline" className={
              campaign.status === 'active' || campaign.status === 'ENABLED'
                ? 'bg-green-500/10 text-green-700 border-green-200'
                : 'bg-muted text-muted-foreground'
            }>
              {campaign.status}
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              {t('admin.ads.bolCampaignEditForm.gebruik_de_pauzeren_hervatten_knop_om')}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Label>{t('admin.ads.bolCampaignEditForm.campagne_modus')}</Label>
          <RadioGroup value={targetingType} onValueChange={setTargetingType} className="flex gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="AUTO" id="mode-auto" />
              <div>
                <Label htmlFor="mode-auto" className="cursor-pointer font-medium">AUTO</Label>
                <p className="text-xs text-muted-foreground">{t('admin.ads.bolCampaignEditForm.bol_com_kiest_automatisch_zoekwoorden')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="MANUAL" id="mode-manual" />
              <div>
                <Label htmlFor="mode-manual" className="cursor-pointer font-medium">MANUAL</Label>
                <p className="text-xs text-muted-foreground">{t('admin.ads.bolCampaignEditForm.je_kiest_zelf_de_zoekwoorden_en')}</p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator />

      {/* Section 2: Budget */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Wallet className="h-4 w-4" />
          {t('admin.ads.campaignWizard.budget')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daily-budget">{t('admin.ads.bolCampaignEditForm.dagbudget')}</Label>
            <Input
              id="daily-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder={t('admin.ads.bolCampaignEditForm.bijv_10_00')}
              value={dailyBudget}
              onChange={e => setDailyBudget(e.target.value)}
              disabled={!canWriteBudget}
              title={!canWriteBudget ? TOOLTIP_NO_ACCESS_SHORT : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total-budget">{t('admin.ads.bolCampaignEditForm.totaalbudget')}</Label>
            <Input
              id="total-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder={t('admin.ads.bolCampaignEditForm.optioneel')}
              value={totalBudget}
              onChange={e => setTotalBudget(e.target.value)}
              disabled={!canWriteBudget}
              title={!canWriteBudget ? TOOLTIP_NO_ACCESS_SHORT : undefined}
            />
            <p className="text-xs text-muted-foreground">{t('admin.ads.bolCampaignEditForm.laat_leeg_voor_onbeperkt')}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 3: Planning */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <CalendarDays className="h-4 w-4" />
          {t('admin.ads.bolCampaignEditForm.planning')}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">{t('admin.ads.bolCampaignEditForm.startdatum')}</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">{t('admin.ads.bolCampaignEditForm.einddatum')}</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('admin.ads.bolCampaignEditForm.laat_leeg_voor_doorlopend')}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 4: Negative Keywords */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Ban className="h-4 w-4" />
          {t('admin.adsBolcomCampaignDetail.negatieve_keywords')}
        </div>

        {!adGroupId && (
          <p className="text-sm text-muted-foreground">
            {t('admin.ads.bolCampaignEditForm.voeg_eerst_producten_toe_aan_de')}
          </p>
        )}

        {adGroupId && (
          <>
            {negKeywords.length > 0 && (
              <div className="space-y-2">
                {negKeywords.map((nk, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
                    <span className="text-sm flex-1">{nk.keyword}</span>
                    <Badge variant="outline" className="text-xs">{nk.matchType}</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeNegKeyword(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                placeholder={t('admin.ads.bolCampaignEditForm.negatief_keyword')}
                value={newNegKw}
                onChange={e => setNewNegKw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNegKeyword())}
                className="flex-1"
              />
              <Select value={newNegMatch} onValueChange={setNewNegMatch}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broad">{t('admin.ads.bolCampaignEditForm.broad')}</SelectItem>
                  <SelectItem value="phrase">{t('admin.ads.bolCampaignEditForm.phrase')}</SelectItem>
                  <SelectItem value="exact">{t('admin.ads.bolCampaignEditForm.exact')}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={addNegKeyword} disabled={!newNegKw.trim()}>
                <Plus className="h-4 w-4 mr-1" /> {t('admin.ads.bolCampaignEditForm.toevoegen')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('admin.ads.bolCampaignEditForm.negatieve_keywords_worden_bij_het_opslaan')}</p>
          </>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Opslaan
        </Button>
      </div>
    </div>
  );
}
