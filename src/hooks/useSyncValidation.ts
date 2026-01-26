import { useMemo } from 'react';
import type { SyncRules, SyncDataType, SyncRuleConfig } from '@/types/syncRules';
import type { MarketplaceType } from '@/types/marketplace';

export interface ValidationWarning {
  id: string;
  dataType: SyncDataType;
  severity: 'warning' | 'error' | 'info';
  message: string;
  field?: string;
}

interface ValidationRule {
  condition: (config: SyncRuleConfig, rules: SyncRules) => boolean;
  message: string;
  severity: 'warning' | 'error' | 'info';
  field?: string;
}

// Platform-specific validation rules
const VALIDATION_RULES: Record<MarketplaceType, Partial<Record<SyncDataType, ValidationRule[]>>> = {
  bol_com: {
    products: [
      {
        condition: (config) => 
          config.enabled && 
          config.direction !== 'import' &&
          !config.fieldMappings.find(f => f.id === 'sku')?.enabled,
        message: 'SKU veld is vereist voor Bol.com product matching',
        severity: 'error',
        field: 'sku',
      },
      {
        condition: (config) => 
          config.enabled && 
          config.direction !== 'import' &&
          !config.fieldMappings.find(f => f.id === 'barcode')?.enabled,
        message: 'EAN/Barcode is vereist voor Bol.com producten',
        severity: 'warning',
        field: 'barcode',
      },
    ],
    inventory: [
      {
        condition: (config) => 
          config.enabled && 
          (config.customSettings?.safetyStock ?? 0) === 0,
        message: 'Veiligheidsvoorraad is 0 - risico op overselling',
        severity: 'warning',
      },
    ],
  },
  amazon: {
    products: [
      {
        condition: (config) => 
          config.enabled && 
          config.direction !== 'import' &&
          !config.fieldMappings.find(f => f.id === 'sku')?.enabled,
        message: 'SKU veld is vereist voor Amazon product matching',
        severity: 'error',
        field: 'sku',
      },
    ],
    inventory: [
      {
        condition: (config) => 
          config.enabled && 
          (config.customSettings?.safetyStock ?? 0) === 0,
        message: 'Veiligheidsvoorraad is 0 - risico op overselling',
        severity: 'warning',
      },
    ],
  },
  shopify: {
    customers: [
      {
        condition: (config) => 
          config.enabled && 
          config.direction === 'export',
        message: 'Privacy: klantgegevens worden naar extern platform verzonden',
        severity: 'info',
      },
    ],
  },
  woocommerce: {
    customers: [
      {
        condition: (config) => 
          config.enabled && 
          config.direction === 'export',
        message: 'Privacy: klantgegevens worden naar extern platform verzonden',
        severity: 'info',
      },
    ],
  },
  odoo: {
    invoices: [
      {
        condition: (config) => 
          config.enabled && 
          config.direction !== 'import' &&
          !config.customSettings?.journalId,
        message: 'Geen Odoo journaal geselecteerd voor factuur export',
        severity: 'warning',
      },
    ],
  },
};

// Generic validation rules that apply to all platforms
const GENERIC_RULES: Partial<Record<SyncDataType, ValidationRule[]>> = {
  orders: [
    {
      condition: (config) => 
        config.enabled && 
        config.direction === 'bidirectional' &&
        !config.conflictStrategy,
      message: 'Geen conflict strategie ingesteld voor bidirectionele sync',
      severity: 'warning',
    },
  ],
  products: [
    {
      condition: (config) => 
        config.enabled && 
        config.direction === 'bidirectional' &&
        !config.conflictStrategy,
      message: 'Geen conflict strategie ingesteld voor bidirectionele sync',
      severity: 'warning',
    },
  ],
  inventory: [
    {
      condition: (config) => 
        config.enabled && 
        config.autoSync &&
        !config.syncFrequency,
      message: 'Geen sync frequentie ingesteld - standaard interval wordt gebruikt',
      severity: 'info',
    },
  ],
};

export function useSyncValidation(
  syncRules: SyncRules,
  marketplaceType: MarketplaceType | null
): ValidationWarning[] {
  return useMemo(() => {
    if (!marketplaceType) return [];

    const warnings: ValidationWarning[] = [];
    const platformRules = VALIDATION_RULES[marketplaceType] || {};

    // Check each data type
    (Object.keys(syncRules) as SyncDataType[]).forEach((dataType) => {
      const config = syncRules[dataType];
      if (!config) return;

      // Platform-specific rules
      const rules = platformRules[dataType] || [];
      rules.forEach((rule, index) => {
        if (rule.condition(config, syncRules)) {
          warnings.push({
            id: `${marketplaceType}-${dataType}-${index}`,
            dataType,
            severity: rule.severity,
            message: rule.message,
            field: rule.field,
          });
        }
      });

      // Generic rules
      const genericRules = GENERIC_RULES[dataType] || [];
      genericRules.forEach((rule, index) => {
        if (rule.condition(config, syncRules)) {
          warnings.push({
            id: `generic-${dataType}-${index}`,
            dataType,
            severity: rule.severity,
            message: rule.message,
            field: rule.field,
          });
        }
      });
    });

    return warnings;
  }, [syncRules, marketplaceType]);
}
