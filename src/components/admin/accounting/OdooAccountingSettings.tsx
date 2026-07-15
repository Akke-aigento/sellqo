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

interface Props {
  tenantId: string;
}

export function OdooAccountingSettings({ tenantId }: Props) {
  const canWrite = useCan('write', 'integrations');
  const { settings, isLoading, upsert } = useTenantOdooSettings(tenantId);
  const { status, save, test, journals } = useOdooConnection(tenantId);

  const [aggregate, setAggregate] = useState(false);
  const [name, setName] = useState('Diverse particulieren');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [journalId, setJournalId] = useState<string>('');
  const [peppolSendEnabled, setPeppolSendEnabled] = useState(true);

  const [url, setUrl] = useState('');
  const [db, setDb] = useState('');
  const [login, setLogin] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (settings) {
      setAggregate(settings.aggregate_b2c_customers);
      setName(settings.b2c_dummy_partner_name || 'Diverse particulieren');
      setSyncEnabled(settings.odoo_sync_enabled ?? false);
      setJournalId(settings.odoo_journal_id || '');
      setPeppolSendEnabled(settings.peppol_send_enabled ?? true);
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
  };
  const dirty =
    !isLoading &&
    (aggregate !== baseline.aggregate ||
      name.trim() !== baseline.name ||
      syncEnabled !== baseline.syncEnabled ||
      journalId !== baseline.journalId ||
      peppolSendEnabled !== baseline.peppolSendEnabled);

  const handleSave = () => {
    const j = journals.data?.find(x => String(x.id) === journalId);
    upsert.mutate({
      aggregate_b2c_customers: aggregate,
      b2c_dummy_partner_name: name.trim() || 'Diverse particulieren',
      odoo_sync_enabled: syncEnabled,
      odoo_journal_id: j ? String(j.id) : null,
      odoo_journal_name: j?.name ?? null,
      peppol_send_enabled: peppolSendEnabled,
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
    </div>
  );
}