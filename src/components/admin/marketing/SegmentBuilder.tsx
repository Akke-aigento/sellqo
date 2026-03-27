import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SegmentFilterRules } from '@/types/marketing';

interface SegmentBuilderProps {
  filterRules: SegmentFilterRules;
  onChange: (rules: SegmentFilterRules) => void;
  memberCount?: number;
}

const COUNTRIES = [
  { code: 'NL', name: 'Nederland' },
  { code: 'BE', name: 'België' },
  { code: 'DE', name: 'Duitsland' },
  { code: 'FR', name: 'Frankrijk' },
  { code: 'LU', name: 'Luxemburg' },
];

const AUTO_TAGS = [
  { value: 'VIP', label: 'VIP', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Loyal', label: 'Loyal', color: 'bg-green-100 text-green-800' },
  { value: 'New', label: 'Nieuw', color: 'bg-blue-100 text-blue-800' },
  { value: 'Sleeping', label: 'Slapend', color: 'bg-gray-100 text-gray-800' },
  { value: 'At Risk', label: 'Risico', color: 'bg-orange-100 text-orange-800' },
  { value: 'Lost', label: 'Verloren', color: 'bg-red-100 text-red-800' },
  { value: 'B2B Verified', label: 'B2B Geverifieerd', color: 'bg-purple-100 text-purple-800' },
  { value: 'Omni-channel', label: 'Omni-channel', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'High Value', label: 'Hoge waarde', color: 'bg-emerald-100 text-emerald-800' },
];

export function SegmentBuilder({ filterRules, onChange, memberCount }: SegmentBuilderProps) {
  const updateRule = <K extends keyof SegmentFilterRules>(key: K, value: SegmentFilterRules[K]) => {
    onChange({ ...filterRules, [key]: value });
  };

  const removeRule = (key: keyof SegmentFilterRules) => {
    const newRules = { ...filterRules };
    delete newRules[key];
    onChange(newRules);
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

  const toggleAutoTag = (tag: string) => {
    const tags = filterRules.auto_tags || [];
    if (tags.includes(tag)) {
      updateRule('auto_tags', tags.filter(t => t !== tag));
    } else {
      updateRule('auto_tags', [...tags, tag]);
    }
  };

  return (
    <div className="space-y-6">
      {memberCount !== undefined && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="text-2xl font-bold">{memberCount.toLocaleString('nl-NL')}</div>
          <p className="text-sm text-muted-foreground">klanten in dit segment</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Customer Type */}
        <div className="space-y-2">
          <Label>Klanttype</Label>
          <Select
            value={filterRules.customer_type || 'all'}
            onValueChange={(value) => updateRule('customer_type', value as 'b2c' | 'b2b' | 'all')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle klanten</SelectItem>
              <SelectItem value="b2c">Particulier (B2C)</SelectItem>
              <SelectItem value="b2b">Zakelijk (B2B)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Tags */}
        <div className="space-y-2">
          <Label>Klanttags (auto-tagging)</Label>
          <div className="flex flex-wrap gap-2">
            {AUTO_TAGS.map(tag => {
              const isSelected = (filterRules.auto_tags || []).includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleAutoTag(tag.value)}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  {tag.label}
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecteer tags om klanten te filteren op basis van automatische classificatie
          </p>
        </div>

        {/* Countries */}
        <div className="space-y-2">
          <Label>Landen</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(filterRules.countries || []).map((code) => {
              const country = COUNTRIES.find(c => c.code === code);
              return (
                <Badge key={code} variant="secondary" className="gap-1">
                  {country?.name || code}
                  <button onClick={() => removeCountry(code)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          <Select onValueChange={addCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Land toevoegen..." />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.filter(c => !(filterRules.countries || []).includes(c.code)).map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Order Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Min. bestellingen</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.min_orders ?? ''}
              onChange={(e) => updateRule('min_orders', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Max. bestellingen</Label>
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
            <Label>Min. besteed (€)</Label>
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
            <Label>Max. besteed (€)</Label>
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

        {/* Activity */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Laatste bestelling (dagen geleden)</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.last_order_days_ago ?? ''}
              onChange={(e) => updateRule('last_order_days_ago', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="bijv. 30"
            />
          </div>
          <div className="space-y-2">
            <Label>Inactief sinds (dagen)</Label>
            <Input
              type="number"
              min={0}
              value={filterRules.no_order_since_days ?? ''}
              onChange={(e) => updateRule('no_order_since_days', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="bijv. 90"
            />
          </div>
        </div>

        {/* Registration Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Geregistreerd vanaf</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterRules.registration_date_from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterRules.registration_date_from 
                    ? format(new Date(filterRules.registration_date_from), 'dd MMM yyyy', { locale: nl })
                    : 'Kies datum'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterRules.registration_date_from ? new Date(filterRules.registration_date_from) : undefined}
                  onSelect={(d) => updateRule('registration_date_from', d?.toISOString())}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Geregistreerd tot</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filterRules.registration_date_to && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterRules.registration_date_to 
                    ? format(new Date(filterRules.registration_date_to), 'dd MMM yyyy', { locale: nl })
                    : 'Kies datum'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterRules.registration_date_to ? new Date(filterRules.registration_date_to) : undefined}
                  onSelect={(d) => updateRule('registration_date_to', d?.toISOString())}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Engagement Score */}
        <div className="space-y-2">
          <Label>Min. engagement score (0-100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={filterRules.min_engagement_score ?? ''}
            onChange={(e) => updateRule('min_engagement_score', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
}
