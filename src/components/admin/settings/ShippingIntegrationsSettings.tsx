import { useState } from 'react';
import { Plus, Settings2, Trash2, ExternalLink, CheckCircle, XCircle, Loader2, TestTube, Power } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShippingIntegrations } from '@/hooks/useShippingIntegrations';
import { SHIPPING_PROVIDERS, type ShippingProvider, type ShippingIntegration } from '@/types/shippingIntegration';

export function ShippingIntegrationsSettings() {
  const {
    integrations,
    isLoading,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
    toggleActive,
    isCreating,
    isUpdating,
    isTesting,
  } = useShippingIntegrations();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<ShippingIntegration | null>(null);

  // Form state
  const [provider, setProvider] = useState<ShippingProvider>('sendcloud');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setProvider('sendcloud');
    setDisplayName('');
    setApiKey('');
    setApiSecret('');
    setIsDefault(false);
  };

  const handleAdd = async () => {
    await createIntegration({
      provider,
      display_name: displayName || SHIPPING_PROVIDERS.find(p => p.id === provider)?.name || provider,
      api_key: apiKey || undefined,
      api_secret: apiSecret || undefined,
      is_active: true,
      is_default: isDefault,
    });
    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = (integration: ShippingIntegration) => {
    setSelectedIntegration(integration);
    setDisplayName(integration.display_name);
    setApiKey(integration.api_key || '');
    setApiSecret(integration.api_secret || '');
    setIsDefault(integration.is_default);
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!selectedIntegration) return;
    
    await updateIntegration({
      id: selectedIntegration.id,
      display_name: displayName,
      api_key: apiKey || undefined,
      api_secret: apiSecret || undefined,
      is_default: isDefault,
    });
    setShowEditDialog(false);
    setSelectedIntegration(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!selectedIntegration) return;
    await deleteIntegration(selectedIntegration.id);
    setShowDeleteDialog(false);
    setSelectedIntegration(null);
  };

  const handleTest = async (id: string) => {
    await testConnection(id);
  };

  const providerInfo = SHIPPING_PROVIDERS.find(p => p.id === provider);
  const connectedProviders = integrations.map(i => i.provider);
  const availableProviders = SHIPPING_PROVIDERS.filter(p => !connectedProviders.includes(p.id));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Verzendintegraties
            </CardTitle>
            <CardDescription>
              Koppel externe verzendplatforms voor automatische labels en tracking
            </CardDescription>
          </div>
          {availableProviders.length > 0 && (
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Toevoegen
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {integrations.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nog geen verzendintegraties gekoppeld. Voeg een provider toe om automatisch verzendlabels te genereren.
              </AlertDescription>
            </Alert>
          ) : (
            integrations.map((integration) => {
              const info = SHIPPING_PROVIDERS.find(p => p.id === integration.provider);
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${integration.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Settings2 className={`h-5 w-5 ${integration.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{integration.display_name}</span>
                        {integration.is_default && (
                          <Badge variant="secondary" className="text-xs">Standaard</Badge>
                        )}
                        {integration.is_active ? (
                          <Badge variant="default" className="text-xs bg-green-600">Actief</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inactief</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {info?.description}
                      </div>
                      {info?.websiteUrl && (
                        <a
                          href={info.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          {info.websiteUrl.replace('https://', '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.is_active}
                      onCheckedChange={(checked) => toggleActive({ id: integration.id, isActive: checked })}
                    />
                    {integration.provider !== 'manual' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(integration.id)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(integration)}
                    >
                      Bewerken
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {/* Available providers to add */}
          {integrations.length > 0 && availableProviders.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Beschikbare providers</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableProviders.map((providerInfo) => (
                  <button
                    key={providerInfo.id}
                    onClick={() => {
                      setProvider(providerInfo.id);
                      setDisplayName(providerInfo.name);
                      setShowAddDialog(true);
                    }}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{providerInfo.name}</div>
                      <div className="text-xs text-muted-foreground">{providerInfo.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verzendintegratie toevoegen</DialogTitle>
            <DialogDescription>
              Koppel een externe verzendprovider voor automatische labels
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => {
                setProvider(v as ShippingProvider);
                setDisplayName(SHIPPING_PROVIDERS.find(p => p.id === v)?.name || v);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {providerInfo && (
                <p className="text-sm text-muted-foreground">{providerInfo.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Weergavenaam</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Bijv. Sendcloud Productie"
              />
            </div>

            {providerInfo?.requiresApiKey && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Voer je API key in"
                />
              </div>
            )}

            {providerInfo?.requiresApiSecret && (
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Voer je API secret in"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">Standaard provider</Label>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleAdd} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integratie bewerken</DialogTitle>
            <DialogDescription>
              Pas de instellingen van {selectedIntegration?.display_name} aan
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Weergavenaam</Label>
              <Input
                id="editDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {selectedIntegration && SHIPPING_PROVIDERS.find(p => p.id === selectedIntegration.provider)?.requiresApiKey && (
              <div className="space-y-2">
                <Label htmlFor="editApiKey">API Key</Label>
                <Input
                  id="editApiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Laat leeg om niet te wijzigen"
                />
              </div>
            )}

            {selectedIntegration && SHIPPING_PROVIDERS.find(p => p.id === selectedIntegration.provider)?.requiresApiSecret && (
              <div className="space-y-2">
                <Label htmlFor="editApiSecret">API Secret</Label>
                <Input
                  id="editApiSecret"
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Laat leeg om niet te wijzigen"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="editIsDefault">Standaard provider</Label>
              <Switch
                id="editIsDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Integratie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedIntegration?.display_name} wilt verwijderen? 
              Bestaande labels blijven bewaard, maar je kunt geen nieuwe labels meer genereren via deze provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
