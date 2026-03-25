import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, RotateCcw, AlertCircle, ArrowRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSyncRules } from '@/hooks/useSyncRules';
import { useSyncValidation } from '@/hooks/useSyncValidation';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { PLATFORM_CAPABILITIES } from '@/lib/syncRuleDefaults';
import { SYNC_DATA_TYPES } from '@/types/syncRules';
import { SyncRuleCard } from './SyncRuleCard';
import { SyncRulePresets } from './SyncRulePresets';
import { SyncHistoryWidget } from './SyncHistoryWidget';
import { SyncValidationWarnings } from './SyncValidationWarnings';
import { SyncConfigManager } from './SyncConfigManager';
import type { MarketplaceConnection } from '@/types/marketplace';
import type { SyncDataType } from '@/types/syncRules';

interface SyncRulesTabProps {
  connection: MarketplaceConnection;
  platformName: string;
  onNavigateToProducts?: () => void;
}

export function SyncRulesTab({ connection, platformName, onNavigateToProducts }: SyncRulesTabProps) {
  const { connections } = useMarketplaceConnections();
  const {
    syncRules,
    isLoading,
    isSaving,
    hasChanges,
    toggleRule,
    setDirection,
    setAutoSync,
    toggleFieldMapping,
    updateStatusMappings,
    updateCustomSettings,
    setConflictStrategy,
    setSyncFrequency,
    applyPreset,
    resetToDefaults,
    importRules,
    saveRules,
    discardChanges,
    getCapabilities,
  } = useSyncRules(connection);

  const warnings = useSyncValidation(syncRules, connection?.marketplace_type || null);
  const otherConnections = connections?.filter(c => c.id !== connection?.id) || [];

  const capabilities = PLATFORM_CAPABILITIES[connection.marketplace_type];

  // Get supported data types for this platform
  const supportedTypes = SYNC_DATA_TYPES.filter(
    (dt) => capabilities[dt.type] !== null
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Validation Warnings */}
      <SyncValidationWarnings warnings={warnings} />

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Synchronisatie Regels</h3>
          <p className="text-sm text-muted-foreground">
            Bepaal wat er gesynchroniseerd wordt met {platformName}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={discardChanges}
                disabled={isSaving}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Annuleren
              </Button>
              <Button
                size="sm"
                onClick={saveRules}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Opslaan
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              Je hebt onopgeslagen wijzigingen. Vergeet niet op te slaan!
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        {/* Main sync rules */}
        <div className="space-y-4">
          {supportedTypes.map((dataTypeInfo) => {
            const dataType = dataTypeInfo.type as SyncDataType;
            const typeCapabilities = getCapabilities(dataType);
            
            return (
              <SyncRuleCard
                key={dataType}
                dataType={dataType}
                config={syncRules[dataType]}
                capabilities={typeCapabilities}
                platformName={platformName}
                connectionId={connection.id}
                onToggle={(enabled) => toggleRule(dataType, enabled)}
                onDirectionChange={(direction) => setDirection(dataType, direction)}
                onAutoSyncChange={(autoSync) => setAutoSync(dataType, autoSync)}
                onFieldToggle={(fieldId, enabled) => toggleFieldMapping(dataType, fieldId, enabled)}
                onStatusMappingsChange={(mappings) => updateStatusMappings(dataType, mappings)}
                onCustomSettingsChange={(settings) => updateCustomSettings(dataType, settings)}
                onConflictStrategyChange={(strategy) => setConflictStrategy(dataType, strategy)}
                onSyncFrequencyChange={(frequency) => setSyncFrequency(dataType, frequency)}
              />
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Sync History */}
          <SyncHistoryWidget connectionId={connection.id} />

          {/* Presets */}
          <SyncRulePresets
            marketplaceType={connection.marketplace_type}
            currentRules={syncRules}
            onApplyPreset={applyPreset}
          />
          
          {/* Config Manager */}
          <SyncConfigManager
            syncRules={syncRules}
            currentConnectionId={connection.id}
            otherConnections={otherConnections}
            onImport={importRules}
            onCopyToConnection={(targetId) => {
              console.log('Copy to connection:', targetId);
            }}
          />

          {/* Reset to defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reset</CardTitle>
              <CardDescription>
                Herstel naar standaard instellingen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Herstel standaard
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>
                        Alle synchronisatie-instellingen voor {platformName} worden teruggezet naar de standaard. Dit omvat:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>Product sync regels</li>
                        <li>Voorraad sync instellingen</li>
                        <li>Bestel mapping</li>
                        <li>Conflict strategieën</li>
                      </ul>
                      <p className="font-medium">
                        Deze actie kan niet ongedaan worden gemaakt.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={resetToDefaults}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ja, reset alles
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
