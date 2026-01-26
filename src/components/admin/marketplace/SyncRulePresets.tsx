import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SYNC_PRESETS } from '@/lib/syncRuleDefaults';
import type { MarketplaceType } from '@/types/marketplace';
import type { SyncPreset, SyncRules } from '@/types/syncRules';

interface SyncRulePresetsProps {
  marketplaceType: MarketplaceType;
  currentRules: SyncRules;
  onApplyPreset: (preset: Partial<SyncRules>) => void;
}

export function SyncRulePresets({
  marketplaceType,
  currentRules,
  onApplyPreset,
}: SyncRulePresetsProps) {
  const presets = SYNC_PRESETS[marketplaceType] || [];

  if (presets.length === 0) return null;

  // Check which preset is currently active (if any)
  const isPresetActive = (preset: SyncPreset): boolean => {
    const presetRules = preset.rules;
    
    for (const [key, presetConfig] of Object.entries(presetRules)) {
      const currentConfig = currentRules[key as keyof SyncRules];
      if (!currentConfig) continue;
      
      if (currentConfig.enabled !== presetConfig?.enabled) return false;
      if (currentConfig.direction !== presetConfig?.direction) return false;
      if (currentConfig.autoSync !== presetConfig?.autoSync) return false;
    }
    
    return true;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Snelle Configuratie</CardTitle>
        </div>
        <CardDescription>
          Kies een vooraf geconfigureerde setup
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {presets.map((preset) => {
            const isActive = isPresetActive(preset);
            
            return (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset.rules)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  "hover:border-primary/50 hover:bg-muted/50",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{preset.name}</span>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          Actief
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {preset.description}
                    </p>
                  </div>
                </div>
                
                {/* Show enabled data types */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(preset.rules).map(([key, config]) => {
                    if (!config?.enabled) return null;
                    
                    const labels: Record<string, string> = {
                      orders: 'Orders',
                      products: 'Producten',
                      inventory: 'Voorraad',
                      customers: 'Klanten',
                      invoices: 'Facturen',
                      returns: 'Retouren',
                      shipments: 'Verzending',
                      categories: 'Categorieën',
                      taxes: 'BTW',
                    };
                    
                    return (
                      <Badge key={key} variant="outline" className="text-xs">
                        {labels[key] || key}
                      </Badge>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
