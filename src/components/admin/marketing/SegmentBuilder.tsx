import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
