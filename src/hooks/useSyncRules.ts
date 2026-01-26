import { useState, useCallback, useEffect } from 'react';
import { useMarketplaceConnections } from './useMarketplaceConnections';
import { getDefaultSyncRules, PLATFORM_CAPABILITIES } from '@/lib/syncRuleDefaults';
import type { MarketplaceConnection, MarketplaceType } from '@/types/marketplace';
import type { 
  SyncRules, 
  SyncRuleConfig, 
  SyncDataType, 
  SyncDirection,
  FieldMapping,
  StatusMapping 
} from '@/types/syncRules';

interface UseSyncRulesReturn {
  syncRules: SyncRules;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  
  // Rule operations
  updateRule: (dataType: SyncDataType, updates: Partial<SyncRuleConfig>) => void;
  toggleRule: (dataType: SyncDataType, enabled: boolean) => void;
  setDirection: (dataType: SyncDataType, direction: SyncDirection) => void;
  setAutoSync: (dataType: SyncDataType, autoSync: boolean) => void;
  
  // Field mapping operations
  toggleFieldMapping: (dataType: SyncDataType, fieldId: string, enabled: boolean) => void;
  updateFieldMappings: (dataType: SyncDataType, mappings: FieldMapping[]) => void;
  
  // Status mapping operations
  updateStatusMappings: (dataType: SyncDataType, mappings: StatusMapping[]) => void;
  
  // Custom settings
  updateCustomSettings: (dataType: SyncDataType, settings: Record<string, unknown>) => void;
  
  // Bulk operations
  applyPreset: (presetRules: Partial<SyncRules>) => void;
  resetToDefaults: () => void;
  
  // Persistence
  saveRules: () => Promise<void>;
  discardChanges: () => void;
  
  // Capabilities
  getCapabilities: (dataType: SyncDataType) => { import: boolean; export: boolean; bidirectional: boolean } | null;
  isDataTypeSupported: (dataType: SyncDataType) => boolean;
}

export function useSyncRules(connection: MarketplaceConnection | null): UseSyncRulesReturn {
  const { updateConnection } = useMarketplaceConnections();
  
  const [syncRules, setSyncRules] = useState<SyncRules>({});
  const [originalRules, setOriginalRules] = useState<SyncRules>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize sync rules from connection or defaults
  useEffect(() => {
    if (!connection) {
      setIsLoading(false);
      return;
    }

    const existingRules = connection.settings?.syncRules as SyncRules | undefined;
    const defaultRules = getDefaultSyncRules(connection.marketplace_type);
    
    // Merge existing rules with defaults (existing takes precedence)
    const mergedRules: SyncRules = { ...defaultRules };
    if (existingRules) {
      Object.keys(existingRules).forEach((key) => {
        const dataType = key as SyncDataType;
        if (existingRules[dataType]) {
          mergedRules[dataType] = {
            ...mergedRules[dataType],
            ...existingRules[dataType],
          };
        }
      });
    }
    
    setSyncRules(mergedRules);
    setOriginalRules(mergedRules);
    setIsLoading(false);
  }, [connection]);

  // Track changes
  useEffect(() => {
    const hasChanges = JSON.stringify(syncRules) !== JSON.stringify(originalRules);
    setHasChanges(hasChanges);
  }, [syncRules, originalRules]);

  // Get capabilities for a data type
  const getCapabilities = useCallback((dataType: SyncDataType) => {
    if (!connection) return null;
    return PLATFORM_CAPABILITIES[connection.marketplace_type][dataType];
  }, [connection]);

  // Check if data type is supported
  const isDataTypeSupported = useCallback((dataType: SyncDataType) => {
    return getCapabilities(dataType) !== null;
  }, [getCapabilities]);

  // Update a single rule
  const updateRule = useCallback((dataType: SyncDataType, updates: Partial<SyncRuleConfig>) => {
    setSyncRules(prev => ({
      ...prev,
      [dataType]: {
        ...prev[dataType],
        ...updates,
        lastModified: new Date().toISOString(),
      },
    }));
  }, []);

  // Toggle rule enabled/disabled
  const toggleRule = useCallback((dataType: SyncDataType, enabled: boolean) => {
    updateRule(dataType, { enabled });
  }, [updateRule]);

  // Set sync direction
  const setDirection = useCallback((dataType: SyncDataType, direction: SyncDirection) => {
    updateRule(dataType, { direction });
  }, [updateRule]);

  // Set auto sync
  const setAutoSync = useCallback((dataType: SyncDataType, autoSync: boolean) => {
    updateRule(dataType, { autoSync });
  }, [updateRule]);

  // Toggle field mapping
  const toggleFieldMapping = useCallback((dataType: SyncDataType, fieldId: string, enabled: boolean) => {
    setSyncRules(prev => {
      const currentRule = prev[dataType];
      if (!currentRule) return prev;

      const updatedMappings = currentRule.fieldMappings.map(mapping =>
        mapping.id === fieldId ? { ...mapping, enabled } : mapping
      );

      return {
        ...prev,
        [dataType]: {
          ...currentRule,
          fieldMappings: updatedMappings,
          lastModified: new Date().toISOString(),
        },
      };
    });
  }, []);

  // Update all field mappings
  const updateFieldMappings = useCallback((dataType: SyncDataType, mappings: FieldMapping[]) => {
    updateRule(dataType, { fieldMappings: mappings });
  }, [updateRule]);

  // Update status mappings
  const updateStatusMappings = useCallback((dataType: SyncDataType, mappings: StatusMapping[]) => {
    updateRule(dataType, { statusMappings: mappings });
  }, [updateRule]);

  // Update custom settings
  const updateCustomSettings = useCallback((dataType: SyncDataType, settings: Record<string, unknown>) => {
    setSyncRules(prev => {
      const currentRule = prev[dataType];
      if (!currentRule) return prev;

      return {
        ...prev,
        [dataType]: {
          ...currentRule,
          customSettings: {
            ...currentRule.customSettings,
            ...settings,
          },
          lastModified: new Date().toISOString(),
        },
      };
    });
  }, []);

  // Apply preset
  const applyPreset = useCallback((presetRules: Partial<SyncRules>) => {
    setSyncRules(prev => ({
      ...prev,
      ...presetRules,
    }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    if (!connection) return;
    const defaultRules = getDefaultSyncRules(connection.marketplace_type);
    setSyncRules(defaultRules);
  }, [connection]);

  // Save rules to database
  const saveRules = useCallback(async () => {
    if (!connection) return;

    setIsSaving(true);
    try {
      await updateConnection.mutateAsync({
        id: connection.id,
        updates: {
          settings: {
            ...connection.settings,
            syncRules,
          },
        },
      });
      setOriginalRules(syncRules);
    } finally {
      setIsSaving(false);
    }
  }, [connection, syncRules, updateConnection]);

  // Discard changes
  const discardChanges = useCallback(() => {
    setSyncRules(originalRules);
  }, [originalRules]);

  return {
    syncRules,
    isLoading,
    isSaving,
    hasChanges,
    updateRule,
    toggleRule,
    setDirection,
    setAutoSync,
    toggleFieldMapping,
    updateFieldMappings,
    updateStatusMappings,
    updateCustomSettings,
    applyPreset,
    resetToDefaults,
    saveRules,
    discardChanges,
    getCapabilities,
    isDataTypeSupported,
  };
}
