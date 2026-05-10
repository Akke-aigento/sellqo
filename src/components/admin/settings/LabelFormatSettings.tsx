import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Building2, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import type { MarketplaceSettings } from '@/types/marketplace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

type LabelFormat = 'a6' | '4x6_thermal' | 'a5' | 'a4_original' | 'brother_62mm';

const FORMAT_OPTIONS: Array<{ value: LabelFormat; label: string; hint: string }> = [
  { value: 'a6', label: 'A6 — 105 × 148 mm', hint: 'Standaard labelprinter (aanbevolen)' },
  { value: '4x6_thermal', label: '4 × 6 inch thermal', hint: 'Zebra, Dymo, Rollo' },
  { value: 'brother_62mm', label: 'Brother QL 62 mm', hint: 'Brother QL labelprinters' },
  { value: 'a5', label: 'A5 — 148 × 210 mm', hint: 'Halve A4-pagina' },
  { value: 'a4_original', label: 'A4 origineel (geen crop)', hint: 'Gewone laser-/inkjet-printer' },
];

const LEGACY_MAP: Record<string, LabelFormat> = {
  a6_cropped: 'a6',
  a4_original: 'a4_original',
};

export function LabelFormatSettings() {
  const { user, userRole, isPlatformAdmin } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const { connections, updateConnection } = useMarketplaceConnections();

  const canEditTenant = isPlatformAdmin || userRole === 'tenant_admin';

  // Pick first bol_com connection (tenant-default lives there for backwards compat with edge function)
  const bolConnection = useMemo(
    () => connections.find((c) => c.marketplace_type === 'bol_com'),
    [connections]
  );

  const tenantSettings: Partial<MarketplaceSettings> =
    (bolConnection?.settings as Partial<MarketplaceSettings> | undefined) ?? {};
  const initialFormats: LabelFormat[] = useMemo(() => {
    const fromArray = (tenantSettings.vvbLabelFormats as LabelFormat[] | undefined) ?? [];
    if (fromArray.length > 0) return fromArray;
    const legacy = tenantSettings.vvbLabelFormat as string | undefined;
    if (legacy && LEGACY_MAP[legacy]) return [LEGACY_MAP[legacy]];
    if (tenantSettings.vvbLabelFormatDefault) return [tenantSettings.vvbLabelFormatDefault as LabelFormat];
    return ['a6'];
  }, [tenantSettings]);

  const initialDefault: LabelFormat =
    (tenantSettings.vvbLabelFormatDefault as LabelFormat | undefined) ?? initialFormats[0] ?? 'a6';

  const [enabledFormats, setEnabledFormats] = useState<LabelFormat[]>(initialFormats);
  const [defaultFormat, setDefaultFormat] = useState<LabelFormat>(initialDefault);
  const [savingTenant, setSavingTenant] = useState(false);

  useEffect(() => {
    setEnabledFormats(initialFormats);
    setDefaultFormat(initialDefault);
  }, [bolConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-user preference
  const { data: userPref, isLoading: loadingPref } = useQuery({
    queryKey: ['user-label-preference', user?.id, currentTenant?.id],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('user_label_preferences')
        .select('preferred_format')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to load user label preference:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !!currentTenant?.id,
  });

  const [userPreferred, setUserPreferred] = useState<LabelFormat | 'tenant_default'>('tenant_default');
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (userPref?.preferred_format) {
      setUserPreferred(userPref.preferred_format as LabelFormat);
    } else {
      setUserPreferred('tenant_default');
    }
  }, [userPref]);

  const toggleFormat = (fmt: LabelFormat, checked: boolean) => {
    if (checked) {
      setEnabledFormats((prev) => Array.from(new Set([...prev, fmt])));
    } else {
      // Cannot uncheck the last format
      if (enabledFormats.length <= 1) {
        toast.error('Minstens één labelformaat moet beschikbaar blijven');
        return;
      }
      setEnabledFormats((prev) => {
        const next = prev.filter((f) => f !== fmt);
        // If the default got removed, fall back to first remaining
        if (defaultFormat === fmt && next.length > 0) {
          setDefaultFormat(next[0]);
        }
        return next;
      });
    }
  };

  const handleSaveTenant = async () => {
    if (!bolConnection) {
      toast.error('Verbind eerst een Bol.com account om labelformaten in te stellen');
      return;
    }
    if (enabledFormats.length === 0) {
      toast.error('Kies minstens één labelformaat');
      return;
    }
    const finalDefault = enabledFormats.includes(defaultFormat) ? defaultFormat : enabledFormats[0];
    setSavingTenant(true);
    try {
      await updateConnection.mutateAsync({
        id: bolConnection.id,
        updates: {
          settings: {
            ...tenantSettings,
            vvbLabelFormats: enabledFormats,
            vvbLabelFormatDefault: finalDefault,
            // legacy key for backwards compatibility
            vvbLabelFormat:
              finalDefault === 'a4_original'
                ? 'a4_original'
                : finalDefault === 'a6'
                ? 'a6_cropped'
                : finalDefault,
          } as MarketplaceSettings,
        },
      });
      toast.success('Bedrijfsinstellingen voor labelformaten opgeslagen');
    } catch (e) {
      console.error(e);
      toast.error('Opslaan mislukt');
    } finally {
      setSavingTenant(false);
    }
  };

  const handleSaveUser = async () => {
    if (!user?.id || !currentTenant?.id) return;
    setSavingUser(true);
    try {
      if (userPreferred === 'tenant_default') {
        const { error } = await supabase
          .from('user_label_preferences')
          .delete()
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_label_preferences')
          .upsert(
            {
              user_id: user.id,
              tenant_id: currentTenant.id,
              preferred_format: userPreferred,
            },
            { onConflict: 'user_id,tenant_id' }
          );
        if (error) throw error;
      }
      await queryClient.invalidateQueries({
        queryKey: ['user-label-preference', user.id, currentTenant.id],
      });
      toast.success('Persoonlijke voorkeur opgeslagen');
    } catch (e) {
      console.error(e);
      toast.error('Opslaan mislukt');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Verzendlabel formaat
        </CardTitle>
        <CardDescription>
          Beheer welke labelformaten beschikbaar zijn en welke standaard wordt gekozen bij het printen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* TENANT BLOCK */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Bedrijfsinstellingen</h3>
          </div>

          {!bolConnection ? (
            <Alert>
              <AlertDescription>
                Verbind eerst een Bol.com account onder <strong>Marketplaces</strong> om
                bedrijfsbrede labelformaten te kunnen instellen.
              </AlertDescription>
            </Alert>
          ) : !canEditTenant ? (
            <Alert>
              <AlertDescription>
                Alleen een tenant-beheerder kan de beschikbare labelformaten voor het hele bedrijf
                aanpassen. Je kunt hieronder wel je persoonlijke voorkeur instellen.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Beschikbare labelformaten</Label>
                <p className="text-sm text-muted-foreground">
                  Vink aan welke formaten je teamleden kunnen kiezen bij het printen van een label.
                </p>
                <div className="space-y-2 pt-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        id={`fmt-${opt.value}`}
                        checked={enabledFormats.includes(opt.value)}
                        onCheckedChange={(c) => toggleFormat(opt.value, c === true)}
                      />
                      <Label htmlFor={`fmt-${opt.value}`} className="flex-1 cursor-pointer">
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-sm text-muted-foreground">{opt.hint}</div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Standaard formaat (bedrijf)</Label>
                <Select
                  value={defaultFormat}
                  onValueChange={(v) => setDefaultFormat(v as LabelFormat)}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledFormats.map((fmt) => {
                      const opt = FORMAT_OPTIONS.find((o) => o.value === fmt);
                      return (
                        <SelectItem key={fmt} value={fmt}>
                          {opt?.label ?? fmt}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Wordt gebruikt als een gebruiker geen persoonlijke voorkeur heeft ingesteld.
                </p>
              </div>

              <Button onClick={handleSaveTenant} disabled={savingTenant}>
                {savingTenant && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Bedrijfsinstellingen opslaan
              </Button>
            </>
          )}
        </section>

        {/* USER BLOCK */}
        <section className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Mijn persoonlijke voorkeur</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Handig wanneer je team verschillende printers gebruikt. Jouw keuze wordt automatisch
            voorgesteld als jij een label print — je kan dit per print nog aanpassen.
          </p>

          <div className="space-y-2">
            <Label>Mijn standaard formaat</Label>
            <Select
              value={userPreferred}
              onValueChange={(v) => setUserPreferred(v as LabelFormat | 'tenant_default')}
              disabled={loadingPref}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant_default">
                  Bedrijfs-standaard gebruiken
                </SelectItem>
                {(enabledFormats.length > 0 ? enabledFormats : FORMAT_OPTIONS.map((o) => o.value)).map(
                  (fmt) => {
                    const opt = FORMAT_OPTIONS.find((o) => o.value === fmt);
                    return (
                      <SelectItem key={fmt} value={fmt}>
                        {opt?.label ?? fmt}
                      </SelectItem>
                    );
                  }
                )}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveUser} disabled={savingUser || loadingPref} variant="secondary">
            {savingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Mijn voorkeur opslaan
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}