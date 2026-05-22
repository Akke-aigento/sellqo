import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Network, CheckCircle2, AlertCircle, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const PEPPOL_REGIMES: Array<{ id: string; label: string }> = [
  { id: 'domestic_standard', label: 'Binnenland 21%' },
  { id: 'domestic_reduced_6', label: 'Binnenland 6%' },
  { id: 'domestic_reduced_12', label: 'Binnenland 12%' },
  { id: 'ic_supply_goods', label: 'IC-leveringen goederen' },
  { id: 'ic_supply_services', label: 'IC-diensten' },
  { id: 'ic_triangulation', label: 'IC-driehoeksverkeer' },
  { id: 'reverse_charge_construction', label: 'BTW-verlegd bouw' },
];

export default function PeppolSetup() {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const t = currentTenant as any;
  const isRegistered = Boolean(t?.peppol_legal_entity_id);

  const [autoSend, setAutoSend] = useState<boolean>(Boolean(t?.peppol_auto_send));
  const [autoSendRegimes, setAutoSendRegimes] = useState<string[]>(
    Array.isArray(t?.peppol_auto_send_regimes) ? t.peppol_auto_send_regimes : [],
  );

  const [form, setForm] = useState({
    company_name: t?.billing_company_name || t?.name || '',
    kvk_number: t?.kvk_number || '',
    btw_number: t?.btw_number || '',
    address: t?.address || '',
    postal_code: t?.postal_code || '',
    city: t?.city || '',
    country: t?.country || 'BE',
    contact_email: t?.billing_email || t?.owner_email || '',
  });

  if (!currentTenant) {
    return (
      <div className="container py-10">
        <Alert><AlertDescription>Geen tenant geselecteerd.</AlertDescription></Alert>
      </div>
    );
  }

  const handleRegister = async () => {
    if (!confirmed) {
      toast({ title: 'Bevestiging vereist', description: 'Vink het akkoord aan.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-peppol-legal-entity', {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Registratie mislukt');

      toast({
        title: data.already_registered ? 'Reeds geregistreerd' : 'Geregistreerd bij Peppol',
        description: `Storecove-ID: ${data.storecove_id}`,
      });
      setDialogOpen(false);
      setConfirmed(false);
      await refreshTenants();
    } catch (e: any) {
      toast({
        title: 'Registratie mislukt',
        description: e?.message ?? 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await supabase.from('tenants').update({
        peppol_auto_send: autoSend,
        peppol_auto_send_regimes: autoSendRegimes.length > 0 ? autoSendRegimes : null,
      } as any).eq('id', currentTenant.id);
      if (error) throw error;
      toast({ title: 'Opgeslagen' });
      await refreshTenants();
    } catch (e: any) {
      toast({ title: 'Fout', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleRegime = (id: string) => {
    setAutoSendRegimes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/settings"><ArrowLeft className="h-4 w-4 mr-2" /> Settings</Link>
        </Button>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Peppol Setup</CardTitle>
                <CardDescription>
                  Registreer deze shop bij ons Peppol Access Point (Storecove) om elektronische
                  facturen rechtstreeks te verzenden en te ontvangen.
                </CardDescription>
              </div>
            </div>
            {isRegistered ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Actief
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" /> Niet geconfigureerd
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRegistered ? (
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Storecove Legal Entity ID</div>
                <div className="font-mono">{t.peppol_legal_entity_id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Peppol identifier</div>
                <div className="font-mono">{t.peppol_id ?? '—'}</div>
              </div>
            </div>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  Na registratie kunt u BIS 3.0 e-facturen rechtstreeks via het Peppol-netwerk versturen.
                  Dit is verplicht voor B2B-leveringen in België vanaf 1 januari 2026.
                </AlertDescription>
              </Alert>
              <Button onClick={() => setDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" /> Registreer voor Peppol
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auto-send settings, only relevant once registered */}
      {isRegistered && (
        <Card>
          <CardHeader>
            <CardTitle>Verzendinstellingen</CardTitle>
            <CardDescription>
              Bepaal welke facturen automatisch via Peppol verzonden worden bij uitsturen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Automatisch verzenden bij factuur-verzending</Label>
                <p className="text-sm text-muted-foreground">
                  Bij elke nieuwe factuur naar een B2B-klant wordt deze direct via Peppol verzonden.
                </p>
              </div>
              <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">Fijnafstemming per BTW-regime</Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Vink aan welke regimes mee mogen in de automatische verzending. Laat alles leeg
                  om alle Peppol-relevante regimes te includeren.
                </p>
                {PEPPOL_REGIMES.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={autoSendRegimes.includes(r.id)}
                      onCheckedChange={() => toggleRegime(r.id)}
                    />
                    <span className="text-sm">{r.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto font-mono">{r.id}</span>
                  </label>
                ))}
              </CollapsibleContent>
            </Collapsible>

            <div>
              <Button onClick={handleSavePrefs} disabled={savingPrefs}>
                {savingPrefs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registreer voor Peppol</DialogTitle>
            <DialogDescription>
              Controleer onderstaande gegevens. Deze worden doorgegeven aan Storecove en kunnen
              later alleen door support gewijzigd worden.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Bedrijfsnaam</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} disabled />
            </div>
            <div className="space-y-2">
              <Label>KBO-nummer</Label>
              <Input value={form.kvk_number} disabled />
            </div>
            <div className="space-y-2">
              <Label>BTW-nummer</Label>
              <Input value={form.btw_number} disabled />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Adres</Label>
              <Input value={form.address} disabled />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={form.postal_code} disabled />
            </div>
            <div className="space-y-2">
              <Label>Stad</Label>
              <Input value={form.city} disabled />
            </div>
            <div className="space-y-2">
              <Label>Land</Label>
              <Input value={form.country} disabled />
            </div>
            <div className="space-y-2">
              <Label>Contact e-mail</Label>
              <Input value={form.contact_email} disabled />
            </div>
          </div>

          <Alert>
            <AlertDescription className="text-sm text-muted-foreground">
              Kloppen deze gegevens niet? Pas ze eerst aan onder
              <Link to="/admin/settings" className="underline mx-1">Settings → Bedrijfsgegevens</Link>
              voor u registreert.
            </AlertDescription>
          </Alert>

          <label className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} />
            <span className="text-sm">
              Ik ga akkoord met Peppol-verzending namens mijn organisatie en verklaar dat
              bovenstaande gegevens correct zijn.
            </span>
          </label>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Annuleren
            </Button>
            <Button onClick={handleRegister} disabled={submitting || !confirmed}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registreer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}