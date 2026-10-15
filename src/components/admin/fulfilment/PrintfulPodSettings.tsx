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
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useCan } from '@/hooks/useCan';
import { usePrintfulConnection } from '@/hooks/usePrintfulConnection';
import { useTenantPrintfulSettings } from '@/hooks/useTenantPrintfulSettings';
import { PrintfulVariantMapping } from './PrintfulVariantMapping';
import { PrintfulImportDialog } from './PrintfulImportDialog';

interface Props {
  tenantId: string;
}

export function PrintfulPodSettings({ tenantId }: Props) {
  const { t } = useTranslation();
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
  const [autoConfirm, setAutoConfirm] = useState(false);

  useEffect(() => {
    if (settings) {
      setSyncEnabled(settings.printful_sync_enabled);
      setAutoConfirm(settings.auto_confirm);
    }
  }, [settings]);

  useEffect(() => {
    if (status.data?.store_id) setStoreId(status.data.store_id);
  }, [status.data?.store_id]);

  const configured = !!status.data?.configured;
  const lastOk = status.data?.last_test_ok;

  // BLOG-FIX-1: de schakelaar "automatisch doorsturen" (auto_forward_orders) is weg —
  // geen enkele backend las hem. De kolom blijft staan; doorsturen gebeurt per bestelling.
  const handleToggle = (key: 'printful_sync_enabled' | 'auto_confirm', value: boolean) => {
    if (key === 'printful_sync_enabled') setSyncEnabled(value);
    if (key === 'auto_confirm') setAutoConfirm(value);
    upsert.mutate({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.printful.connection_title')}</CardTitle>
          <CardDescription>
            <Trans i18nKey="admin.printful.connection_description" components={{ strong: <strong /> }} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configured && (
            <div className="flex items-center gap-2 text-sm">
              {lastOk === false ? (
                <><XCircle className="w-4 h-4 text-destructive" /> {t('admin.printful.last_test_failed')}</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /> {t('admin.printful.connected')}
                  {status.data?.connected_store_name ? ` · ${status.data.connected_store_name}` : ''}</>
              )}
            </div>
          )}
          {configured && status.data?.webhook_registered && (
            <p className="text-xs text-muted-foreground">{t('admin.printful.shipping_updates_active')}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="pf-token">{t('admin.printful.token_label')}</Label>
            <Input
              id="pf-token"
              type="password"
              autoComplete="off"
              placeholder={configured ? t('admin.printful.token_placeholder_saved') : t('admin.printful.token_placeholder')}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={!canWrite}
            />
            <p className="text-xs text-muted-foreground">
              {t('admin.printful.token_hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pf-store">{t('admin.printful.store_id_label')}</Label>
            <Input
              id="pf-store"
              placeholder={t('admin.printful.store_id_placeholder')}
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
              {t('admin.printful.test_connection')}
            </Button>
            <Button
              onClick={() => save.mutate({ token, storeId: storeId || undefined })}
              disabled={!canWrite || save.isPending || token.trim().length < 10}
            >
              {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('admin.printful.save')}
            </Button>
            {configured && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDisconnect(true)}
                disabled={!canWrite}
              >
                {t('admin.printful.disconnect')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.printful.settings')}</CardTitle>
          <CardDescription>{t('admin.printful.settings_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>{t('admin.printful.sync_enabled_label')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.printful.sync_enabled_hint')}</p>
            </div>
            <Switch
              checked={syncEnabled}
              onCheckedChange={(v) => handleToggle('printful_sync_enabled', v)}
              disabled={!canWrite || !configured}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label>{t('admin.printful.auto_confirm_label')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.printful.auto_confirm_hint')}</p>
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
            <CardTitle className="text-base">{t('admin.printful.import_title')}</CardTitle>
            <CardDescription>{t('admin.printful.import_description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              {t('admin.printful.import_button')}
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
            <AlertDialogTitle>{t('admin.printful.disconnect_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.printful.disconnect_confirm_description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.printful.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { disconnect.mutate(); setToken(''); setConfirmDisconnect(false); }}
            >
              {t('admin.printful.disconnect_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}