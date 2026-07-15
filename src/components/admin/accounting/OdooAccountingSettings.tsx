import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useCan } from '@/hooks/useCan';
import { useTenantOdooSettings } from '@/hooks/useTenantOdooSettings';
import { useOdooConnection } from '@/hooks/useOdooConnection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DEFAULT_CHANNEL_LABELS: Record<string, string> = {
  bol_com: 'Bol.com verkopen',
  webshop: 'Webshop verkopen',
  amazon: 'Amazon verkopen',
  ebay: 'eBay verkopen',
  subscription: 'Abonnementen',
  manual: 'Handmatige verkopen',
};
const KNOWN_MARKETPLACES = new Set(['bol_com', 'amazon', 'ebay']);

interface Props {
  tenantId: string;
}

export function OdooAccountingSettings({ tenantId }: Props) {
  const canWrite = useCan('write', 'integrations');
  const { settings, isLoading, upsert } = useTenantOdooSettings(tenantId);
  const { status, save, test, journals } = useOdooConnection(tenantId);
  const { t } = useTranslation();

  const [aggregate, setAggregate] = useState(false);
  const [name, setName] = useState('Diverse particulieren');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [journalId, setJournalId] = useState<string>('');
  const [peppolSendEnabled, setPeppolSendEnabled] = useState(true);
  const [autoPost, setAutoPost] = useState(true);

  const [url, setUrl] = useState('');
  const [db, setDb] = useState('');
  const [login, setLogin] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Channel aliases (per-channel B2C display names in Odoo).
  const [channelAliases, setChannelAliases] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings?.channel_aliases && typeof settings.channel_aliases === 'object') {
      setChannelAliases({ ...settings.channel_aliases });
    }
  }, [settings?.channel_aliases]);

  // Distinct sales channels seen in this tenant's orders — mirrors the
  // resolution used in the Odoo sync edge function.
  const orderChannels = useQuery({
    queryKey: ['odoo-order-channels', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('marketplace_source, sales_channel')
        .eq('tenant_id', tenantId)
        .limit(2000);
      const set = new Set<string>();
      for (const r of (data || []) as Array<{ marketplace_source: string | null; sales_channel: string | null }>) {
        const ms = r.marketplace_source;
        if (ms && KNOWN_MARKETPLACES.has(ms)) set.add(ms);
        else if (r.sales_channel) set.add(r.sales_channel);
        else set.add('webshop');
      }
      return Array.from(set);
    },
  });

  const channelList = (() => {
    const s = new Set<string>(orderChannels.data || []);
    s.add('subscription');
    s.add('manual');
    // Preserve a stable ordering: marketplaces first, then webshop/sub/manual.
    const order = ['bol_com', 'amazon', 'ebay', 'webshop', 'subscription', 'manual'];
    const extras = Array.from(s).filter(c => !order.includes(c)).sort();
    return [...order.filter(c => s.has(c)), ...extras];
  })();

  const aliasesDirty = (() => {
    const stored = (settings?.channel_aliases || {}) as Record<string, string>;
    const keys = new Set([...Object.keys(stored), ...Object.keys(channelAliases)]);
    for (const k of keys) {
      const a = (channelAliases[k] ?? '').trim();
      const b = (stored[k] ?? '').trim();
      if (a !== b) return true;
    }
    return false;
  })();

  const handleSaveAliases = () => {
    // Persist only non-empty custom aliases; empty inputs fall back to defaults.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(channelAliases)) {
      const s = (v ?? '').trim();
      if (s) cleaned[k] = s;
    }
    // channel_aliases is stored as jsonb; cast satisfies the generated Json type.
    upsert.mutate({ channel_aliases: cleaned as unknown as Record<string, string> });
  };

  useEffect(() => {
    if (settings) {
      setAggregate(settings.aggregate_b2c_customers);
      setName(settings.b2c_dummy_partner_name || 'Diverse particulieren');
      setSyncEnabled(settings.odoo_sync_enabled ?? false);
      setJournalId(settings.odoo_journal_id || '');
      setPeppolSendEnabled(settings.peppol_send_enabled ?? true);
      setAutoPost(settings.odoo_auto_post ?? true);
    }
  }, [settings]);

  useEffect(() => {
    if (status.data?.configured) {
      setUrl(status.data.odoo_url || '');
      setDb(status.data.odoo_db || '');
      setLogin(status.data.odoo_login || '');
    }
  }, [status.data]);

  const selectedJournal = journals.data?.find(j => String(j.id) === journalId);
  const configured = !!status.data?.configured;

  // Compare against stored row when present, otherwise against defaults so the
  // first-ever save (no row yet) is not permanently blocked.
  const baseline = {
    aggregate: settings?.aggregate_b2c_customers ?? false,
    name: (settings?.b2c_dummy_partner_name || 'Diverse particulieren').trim(),
    syncEnabled: settings?.odoo_sync_enabled ?? false,
    journalId: settings?.odoo_journal_id || '',
    peppolSendEnabled: settings?.peppol_send_enabled ?? true,
    autoPost: settings?.odoo_auto_post ?? true,
  };
  const dirty =
    !isLoading &&
    (aggregate !== baseline.aggregate ||
      name.trim() !== baseline.name ||
      syncEnabled !== baseline.syncEnabled ||
      journalId !== baseline.journalId ||
      peppolSendEnabled !== baseline.peppolSendEnabled ||
      autoPost !== baseline.autoPost);

  const handleSave = () => {
    const j = journals.data?.find(x => String(x.id) === journalId);
    upsert.mutate({
      aggregate_b2c_customers: aggregate,
      b2c_dummy_partner_name: name.trim() || 'Diverse particulieren',
      odoo_sync_enabled: syncEnabled,
      odoo_journal_id: j ? String(j.id) : null,
      odoo_journal_name: j?.name ?? null,
      peppol_send_enabled: peppolSendEnabled,
      odoo_auto_post: autoPost,
    });
  };

  // Documents needing Peppol attention (pending / manual_action)
  const attention = useQuery({
    queryKey: ['peppol-attention', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [inv, cn] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, peppol_status')
          .eq('tenant_id', tenantId)
          .in('peppol_status', ['pending', 'manual_action']),
        supabase
          .from('credit_notes')
          .select('id, credit_note_number, peppol_status')
          .eq('tenant_id', tenantId)
          .in('peppol_status', ['pending', 'manual_action']),
      ]);
      return {
        invoices: inv.data || [],
        creditNotes: cn.data || [],
      };
    },
  });
  const attentionCount = (attention.data?.invoices.length || 0) + (attention.data?.creditNotes.length || 0);

  const handleSaveConnection = () => {
    save.mutate({ odoo_url: url, odoo_db: db, odoo_login: login, odoo_api_key: apiKey || undefined });
    setApiKey('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Odoo-verbinding</CardTitle>
          <CardDescription>
            Verbind deze tenant met jouw eigen Odoo. De API-key wordt versleuteld opgeslagen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="odoo-url">Odoo URL</Label>
              <Input id="odoo-url" className="mt-1" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://bedrijf.odoo.com" disabled={!canWrite || save.isPending} />
            </div>
            <div>
              <Label htmlFor="odoo-db">Database</Label>
              <Input id="odoo-db" className="mt-1" value={db} onChange={e => setDb(e.target.value)}
                placeholder="bedrijf" disabled={!canWrite || save.isPending} />
            </div>
            <div>
              <Label htmlFor="odoo-login">Login (e-mail)</Label>
              <Input id="odoo-login" className="mt-1" value={login} onChange={e => setLogin(e.target.value)}
                placeholder="admin@bedrijf.be" disabled={!canWrite || save.isPending} />
            </div>
            <div>
              <Label htmlFor="odoo-key">
                API-key
                {status.data?.has_key ? (
                  <span className="ml-2 text-xs text-muted-foreground">•••• geconfigureerd</span>
                ) : null}
              </Label>
              <Input id="odoo-key" className="mt-1" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={status.data?.has_key ? 'Laat leeg om bestaande te behouden' : ''}
                disabled={!canWrite || save.isPending} autoComplete="new-password" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleSaveConnection}
              disabled={!canWrite || save.isPending || !url || !db || !login || (!apiKey && !status.data?.has_key)}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verbinding opslaan & testen
            </Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={!configured || test.isPending}>
              {test.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Test verbinding
            </Button>
            {status.data?.last_test_at ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {status.data.last_test_ok ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    OK · Odoo {status.data.connected_version ?? '?'}</>
                ) : (
                  <><XCircle className="h-3.5 w-3.5 text-red-600" />
                    Laatste test mislukt</>
                )}
                <span>· {new Date(status.data.last_test_at).toLocaleString()}</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Odoo synchronisatie</CardTitle>
          <CardDescription>
            Kies het verkoopdagboek en zet automatische facturensync aan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 pb-4 border-b">
            <div>
              <Label htmlFor="odoo-sync-enabled">Odoo-facturatiesync inschakelen</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Uurlijkse runner post nieuwe facturen en creditnota's naar jouw Odoo.
              </p>
            </div>
            <Switch
              id="odoo-sync-enabled"
              checked={syncEnabled}
              disabled={!canWrite || isLoading || !configured}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          <div>
            <Label htmlFor="odoo-journal">Verkoopdagboek</Label>
            <Select value={journalId} onValueChange={setJournalId}
              disabled={!canWrite || !configured || !syncEnabled || journals.isLoading}>
              <SelectTrigger id="odoo-journal" className="mt-1">
                <SelectValue placeholder={configured ? 'Kies een dagboek…' : 'Configureer eerst de verbinding'} />
              </SelectTrigger>
              <SelectContent>
                {(journals.data || []).map(j => (
                  <SelectItem key={j.id} value={String(j.id)} disabled={j.claimed_by_other_tenant}>
                    {j.name}{j.code ? ` (${j.code})` : ''}{j.claimed_by_other_tenant ? ' — in gebruik' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedJournal?.claimed_by_other_tenant ? (
              <p className="text-xs text-red-600 mt-1">
                Dit dagboek is al in gebruik door een andere tenant in dezelfde Odoo.
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="aggregate-b2c">B2C-klanten aggregeren naar één Odoo-klant</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Zakelijke (B2B) klanten worden altijd individueel gesynct.
              </p>
            </div>
            <Switch
              id="aggregate-b2c"
              checked={aggregate}
              disabled={!canWrite || isLoading}
              onCheckedChange={setAggregate}
            />
          </div>

          <div>
            <Label htmlFor="dummy-name">Naam van verzamelklant</Label>
            <Input
              id="dummy-name"
              className="mt-1"
              value={name}
              disabled={!canWrite || !aggregate || isLoading}
              onChange={(e) => setName(e.target.value)}
              placeholder="Diverse particulieren"
            />
          </div>

          {settings?.b2c_dummy_partner_odoo_id ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Gekoppeld aan Odoo res.partner ID <code>{settings.b2c_dummy_partner_odoo_id}</code>.</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <div>
              <Label htmlFor="peppol-send">Peppol verzenden via Odoo</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Wanneer aan, verstuurt Odoo automatisch de Peppol e-factuur na een succesvolle sync. Uit = alleen archiveren in Odoo.
              </p>
            </div>
            <Switch
              id="peppol-send"
              checked={peppolSendEnabled}
              disabled={!canWrite || isLoading || !syncEnabled}
              onCheckedChange={setPeppolSendEnabled}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}
              disabled={!canWrite || !dirty || upsert.isPending || (syncEnabled && !journalId) || !!selectedJournal?.claimed_by_other_tenant}>
              {upsert.isPending ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {attentionCount > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Peppol-aandacht ({attentionCount})
            </CardTitle>
            <CardDescription>
              Deze documenten wachten op verzending of vereisen een handmatige actie in Peppol/Odoo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {attention.data?.invoices.map(i => (
              <div key={i.id} className="flex items-center justify-between border-b py-1 last:border-b-0">
                <Link to={`/admin/invoices/${i.id}`} className="hover:underline">
                  Factuur {i.invoice_number}
                </Link>
                <span className="text-xs text-amber-700">
                  {i.peppol_status === 'manual_action' ? 'Handmatig verzenden' : 'In wachtrij'}
                </span>
              </div>
            ))}
            {attention.data?.creditNotes.map(c => (
              <div key={c.id} className="flex items-center justify-between border-b py-1 last:border-b-0">
                <span>Creditnota {c.credit_note_number}</span>
                <span className="text-xs text-amber-700">
                  {c.peppol_status === 'manual_action' ? 'Handmatig verzenden' : 'In wachtrij'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {configured && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.odooChannels.title', 'Kanaal-weergave in Odoo')}</CardTitle>
            <CardDescription>
              {t(
                'admin.odooChannels.description',
                'Deze namen verschijnen in Odoo als verzamelklant voor B2C-verkopen en als referentie op elke boeking. Hernoemen na de eerste sync wijzigt bestaande Odoo-klanten niet.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 text-xs uppercase tracking-wide text-muted-foreground pb-1 border-b">
              <div>{t('admin.odooChannels.columnChannel', 'Kanaal')}</div>
              <div>{t('admin.odooChannels.columnDisplay', 'Weergavenaam in Odoo')}</div>
            </div>
            {channelList.map(ch => {
              const placeholder = DEFAULT_CHANNEL_LABELS[ch] ?? ch;
              return (
                <div key={ch} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 items-center">
                  <Label htmlFor={`ch-${ch}`} className="text-sm">
                    {t(`admin.odooChannels.channels.${ch}`, ch)}
                  </Label>
                  <Input
                    id={`ch-${ch}`}
                    value={channelAliases[ch] ?? ''}
                    onChange={e => setChannelAliases(prev => ({ ...prev, [ch]: e.target.value }))}
                    placeholder={placeholder}
                    disabled={!canWrite || upsert.isPending}
                  />
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveAliases}
                disabled={!canWrite || !aliasesDirty || upsert.isPending}
              >
                {upsert.isPending
                  ? t('admin.odooChannels.saving', 'Opslaan…')
                  : t('admin.odooChannels.save', 'Weergavenamen opslaan')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}