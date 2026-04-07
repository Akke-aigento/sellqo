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
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(campaign.name);
  const [targetingType, setTargetingType] = useState(campaign.targeting_type || 'AUTO');
  const [dailyBudget, setDailyBudget] = useState(campaign.daily_budget?.toString() ?? '');
  const [totalBudget, setTotalBudget] = useState(campaign.total_budget?.toString() ?? '');
  const [startDate, setStartDate] = useState(campaign.start_date ?? '');
  const [endDate, setEndDate] = useState(campaign.end_date ?? '');

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
          Algemeen
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaign-name">Campagnenaam</Label>
          <Input id="campaign-name" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <div>
            <Badge variant="outline" className={
              campaign.status === 'active' || campaign.status === 'ENABLED'
                ? 'bg-green-500/10 text-green-700 border-green-200'
                : 'bg-muted text-muted-foreground'
            }>
              {campaign.status}
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              (Gebruik de Pauzeren/Hervatten knop om de status te wijzigen)
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Campagne modus</Label>
          <RadioGroup value={targetingType} onValueChange={setTargetingType} className="flex gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="AUTO" id="mode-auto" />
              <div>
                <Label htmlFor="mode-auto" className="cursor-pointer font-medium">AUTO</Label>
                <p className="text-xs text-muted-foreground">Bol.com kiest automatisch zoekwoorden</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="MANUAL" id="mode-manual" />
              <div>
                <Label htmlFor="mode-manual" className="cursor-pointer font-medium">MANUAL</Label>
                <p className="text-xs text-muted-foreground">Je kiest zelf de zoekwoorden en biedingen</p>
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
          Budget
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daily-budget">Dagbudget (€)</Label>
            <Input
              id="daily-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="Bijv. 10.00"
              value={dailyBudget}
              onChange={e => setDailyBudget(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total-budget">Totaalbudget (€)</Label>
            <Input
              id="total-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="Optioneel"
              value={totalBudget}
              onChange={e => setTotalBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Laat leeg voor onbeperkt</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Section 3: Planning */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <CalendarDays className="h-4 w-4" />
          Planning
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Startdatum</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">Einddatum</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Laat leeg voor doorlopend</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Annuleren</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Opslaan
        </Button>
      </div>
    </div>
  );
}
