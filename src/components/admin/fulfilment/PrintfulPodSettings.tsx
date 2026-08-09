import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, Download, Info, Loader2, XCircle } from 'lucide-react';
import { useCan } from '@/hooks/useCan';
import { usePrintfulConnection } from '@/hooks/usePrintfulConnection';
import { useTenantPrintfulSettings } from '@/hooks/useTenantPrintfulSettings';
import { PrintfulVariantMapping } from './PrintfulVariantMapping';
import { PrintfulImportDialog } from './PrintfulImportDialog';

interface Props {
  tenantId: string;
}

export function PrintfulPodSettings({ tenantId }: Props) {
  const canWrite = useCan('write', 'integrations');
  const { status, test, save, disconnect } = usePrintfulConnection(tenantId);
  const { settings, upsert } = useTenantPrintfulSettings(tenantId);

  // The token is only ever held in local state until it is saved; it is never
  // returned by the backend and never re-displayed afterwards.
  const [token, setToken] = useState('');
  const [storeId, setStoreId] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [syncEnabled, setSyncEnabled] = useState(false);
  const [autoForward, setAutoForward] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);

  useEffect(() => {
    if (settings) {
      setSyncEnabled(settings.printful_sync_enabled);
      setAutoForward(settings.auto_forward_orders);
      setAutoConfirm(settings.auto_confirm);
    }
  }, [settings]);

  useEffect(() => {
    if (status.data?.store_id) setStoreId(status.data.store_id);
  }, [status.data?.store_id]);

  const configured = !!status.data?.configured;
  const lastOk = status.data?.last_test_ok;

  const handleToggle = (key: 'printful_sync_enabled' | 'auto_forward_orders' | 'auto_confirm', value: boolean) => {
    if (key === 'printful_sync_enabled') setSyncEnabled(value);
    if (key === 'auto_forward_orders') setAutoForward(value);
    if (key === 'auto_confirm') setAutoConfirm(value);
    upsert.mutate({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verbinding</CardTitle>
          <CardDescription>
            Maak een private token aan in het Printful Developer Portal met de scopes <strong>orders</strong>,{' '}
            <strong>sync_products</strong> en <strong>webhooks</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configured && (
            <div className="flex items-center gap-2 text-sm">
              {lastOk === false ? (
                <><XCircle className="w-4 h-4 text-destructive" /> Laatste test mislukt</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /> Verbonden
                  {status.data?.connected_store_name ? ` · ${status.data.connected_store_name}` : ''}</>
              )}
            </div>
          )}
          {configured && status.data?.webhook_registered && (
            <p className="text-xs text-muted-foreground">Verzendupdates: actief</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pf-token">Private token</Label>
            <Input
              id="pf-token"
              type="password"
              autoComplete="off"
              placeholder={configured ? 'Opgeslagen — vul in om te vervangen' : 'Printful private token'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={!canWrite}
            />
            <p className="text-xs text-muted-foreground">
              Het token wordt versleuteld opgeslagen en nooit meer teruggetoond.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pf-store">Store-ID (optioneel)</Label>
            <Input
              id="pf-store"
              placeholder="Alleen nodig bij account-level tokens"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              disabled={!canWrite}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => test.mutate({ token: token || undefined, storeId: storeId || undefined })}
              disabled={test.isPending || (!token && !configured)}
            >
              {test.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test verbinding
            </Button>
            <Button
              onClick={() => save.mutate({ token, storeId: storeId || undefined })}
              disabled={!canWrite || save.isPending || token.trim().length < 10}
            >
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
            {configured && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDisconnect(true)}
                disabled={!canWrite}
              >
                Verbinding verbreken
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instellingen</CardTitle>
          <CardDescription>Bepaal hoe SellQo met je Printful-winkel samenwerkt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Printful-koppeling actief</Label>
              <p className="text-xs text-muted-foreground">Zet de koppeling aan of uit zonder je token te verwijderen.</p>
            </div>
            <Switch
              checked={syncEnabled}
              onCheckedChange={(v) => handleToggle('printful_sync_enabled', v)}
              disabled={!canWrite || !configured}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Bestellingen automatisch doorsturen</Label>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Actief vanaf de order-forwarding release.
              </p>
            </div>
            <Switch
              checked={autoForward}
              onCheckedChange={(v) => handleToggle('auto_forward_orders', v)}
              disabled={!canWrite || !configured}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>Bestellingen direct bevestigen bij Printful</Label>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Actief vanaf de order-forwarding release. Uit = order als concept aanmaken.
              </p>
            </div>
            <Switch
              checked={autoConfirm}
              onCheckedChange={(v) => handleToggle('auto_confirm', v)}
              disabled={!canWrite || !configured}
            />
          </div>
        </CardContent>
      </Card>

      {configured && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Producten importeren</CardTitle>
            <CardDescription>
              Neem je Printful-ontwerpen over als SellQo-producten met varianten, beelden en automatische
              variant-koppeling. Je bekijkt eerst een voorbeeld en bepaalt zelf de prijzen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Producten importeren uit Printful
            </Button>
          </CardContent>
        </Card>
      )}

      {configured && <PrintfulVariantMapping tenantId={tenantId} />}

      {configured && canWrite && (
        <PrintfulImportDialog tenantId={tenantId} open={importOpen} onOpenChange={setImportOpen} />
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Printful-verbinding verbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Het opgeslagen token wordt verwijderd en de koppeling wordt uitgezet. Je variant-koppelingen blijven
              bewaard, zodat een nieuwe verbinding direct weer werkt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { disconnect.mutate(); setToken(''); setConfirmDisconnect(false); }}
            >
              Verbreek verbinding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}