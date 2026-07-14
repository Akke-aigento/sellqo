import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { useCan } from '@/hooks/useCan';
import { useTenantOdooSettings } from '@/hooks/useTenantOdooSettings';

interface Props {
  tenantId: string;
}

export function OdooB2CAggregationSettings({ tenantId }: Props) {
  const canWrite = useCan('write', 'integrations');
  const { settings, isLoading, upsert } = useTenantOdooSettings(tenantId);

  const [aggregate, setAggregate] = useState(false);
  const [name, setName] = useState('Diverse particulieren');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [journalName, setJournalName] = useState('');

  useEffect(() => {
    if (settings) {
      setAggregate(settings.aggregate_b2c_customers);
      setName(settings.b2c_dummy_partner_name || 'Diverse particulieren');
      setSyncEnabled(settings.odoo_sync_enabled ?? false);
      setJournalName(settings.odoo_journal_name || '');
    }
  }, [settings]);

  const dirty =
    !!settings &&
    (aggregate !== settings.aggregate_b2c_customers ||
      name.trim() !== (settings.b2c_dummy_partner_name || 'Diverse particulieren').trim() ||
      syncEnabled !== (settings.odoo_sync_enabled ?? false) ||
      journalName.trim() !== (settings.odoo_journal_name || '').trim());

  const handleSave = () => {
    upsert.mutate({
      aggregate_b2c_customers: aggregate,
      b2c_dummy_partner_name: name.trim() || 'Diverse particulieren',
      odoo_sync_enabled: syncEnabled,
      odoo_journal_name: journalName.trim() || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>B2C-klanten aggregeren in Odoo</CardTitle>
        <CardDescription>
          Marketing-klanten blijven individueel in SellQo. Alleen Odoo krijgt één
          verzamelklant voor consumer-verkopen — handig voor jouw boekhouder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          <div>
            <Label htmlFor="odoo-sync-enabled">Odoo-facturatiesync inschakelen</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Zet deze tenant op de urenlijkse sync-runner. Uit = deze tenant komt nooit in Odoo.
            </p>
          </div>
          <Switch
            id="odoo-sync-enabled"
            checked={syncEnabled}
            disabled={!canWrite || isLoading}
            onCheckedChange={setSyncEnabled}
          />
        </div>

        <div>
          <Label htmlFor="odoo-journal-name">Odoo verkoopdagboek (naam)</Label>
          <Input
            id="odoo-journal-name"
            className="mt-1"
            value={journalName}
            disabled={!canWrite || !syncEnabled || isLoading}
            onChange={(e) => setJournalName(e.target.value)}
            placeholder="Verkoopdagboek Nomadix"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Exacte naam van het sales-journal in Odoo. Wordt bij elke sync opgezocht.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="aggregate-b2c">B2C-klanten aggregeren naar één Odoo-klant</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Zakelijke (B2B) klanten worden altijd individueel naar Odoo gesynct.
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
            <span>
              Gekoppeld aan Odoo res.partner ID <code>{settings.b2c_dummy_partner_odoo_id}</code>.
              De naam hier wijzigen creëert pas een nieuwe partner als de cache wordt geleegd.
            </span>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!canWrite || !dirty || upsert.isPending}>
            {upsert.isPending ? 'Opslaan…' : 'Opslaan'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}