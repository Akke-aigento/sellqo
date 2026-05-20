import { useEffect, useState } from 'react';
import { FileCheck, CheckCircle2, AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { RegimeResolution, VatRegimeCode } from '@/types/accounting';

interface VatRegimeRow {
  code: VatRegimeCode;
  description_nl: string | null;
  output_vat_box: string | null;
  invoice_text_nl: string | null;
  applies_vat: boolean;
  reverse_charge: boolean;
}

interface Props {
  resolution: RegimeResolution | null;
  loading: boolean;
  error: string | null;
  overrideRegime: VatRegimeCode | null;
  onOverrideChange: (regime: VatRegimeCode | null) => void;
}

const NONE = '__none__';

function regimeColor(code: VatRegimeCode | undefined): string {
  if (!code) return 'bg-muted text-muted-foreground';
  if (code === 'oss_b2c_eu') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
  if (code === 'export_outside_eu' || code === 'marketplace_deemed_supplier') {
    return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200';
  }
  // IC + domestic = green
  return 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200';
}

function rateLabel(code: VatRegimeCode | undefined, rate: number): string {
  if (!code) return '—';
  if (code === 'export_outside_eu') return '0% (export)';
  if (code === 'ic_supply_goods' || code === 'ic_supply_services' || code === 'reverse_charge_construction') {
    return '0% (verlegging)';
  }
  if (code === 'marketplace_deemed_supplier') return '0% (marketplace)';
  if (code === 'exempt_article_44') return '0% (vrijgesteld art. 44)';
  return `${rate}% BTW`;
}

export function VatRegimeIndicator({
  resolution, loading, error, overrideRegime, onOverrideChange,
}: Props) {
  const [regimes, setRegimes] = useState<VatRegimeRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('vat_regimes')
      .select('code, description_nl, output_vat_box, invoice_text_nl, applies_vat, reverse_charge')
      .then(({ data }) => {
        if (!active || !data) return;
        setRegimes(data as VatRegimeRow[]);
      });
    return () => { active = false; };
  }, []);

  const regimeCode = resolution?.invoice_level.vat_regime;
  const regimeRow = regimes.find((r) => r.code === regimeCode);
  const description = regimeRow?.description_nl || (regimeCode ?? 'Nog niet bepaald');
  const boxCode = resolution?.per_line[0]?.vat_box_code ?? regimeRow?.output_vat_box ?? null;
  const rate = resolution?.per_line[0]?.vat_rate ?? 0;
  const viesAt = resolution?.invoice_level.vat_number_validated_at;
  const invoiceText = resolution?.per_line[0]?.invoice_text_required;
  const reportingCountry = resolution?.invoice_level.reporting_country;
  const crossBorderNoOss = !!resolution?.warnings.some((w) =>
    w.startsWith('Cross-border EU B2C zonder OSS'),
  );
  let displayLabel = description;
  if (regimeCode === 'oss_b2c_eu' && reportingCountry) {
    let countryName = reportingCountry;
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      countryName = dn.of(reportingCountry) || reportingCountry;
    } catch { /* ignore */ }
    displayLabel = `OSS ${countryName} — ${rate}%`;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="h-4 w-4" />
          Belastingregime
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <span className="text-sm text-muted-foreground">Bepalen...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Kon regime niet bepalen — manual override mogelijk</AlertDescription>
          </Alert>
        ) : !resolution ? (
          <div className="text-sm text-muted-foreground">
            Selecteer een klant en voeg minstens één regel toe om het regime te bepalen.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('font-medium', regimeColor(regimeCode))}>{displayLabel}</Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {boxCode ? `Vak ${boxCode}` : '—'}
              </Badge>
              <span className="text-sm font-medium ml-1">{rateLabel(regimeCode, rate)}</span>
              {overrideRegime && (
                <Badge className="bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                  Manueel overschreven — controleer voor verzending
                </Badge>
              )}
            </div>

            {crossBorderNoOss && regimeCode === 'domestic_standard' && (
              <p className="text-xs text-muted-foreground">
                Cross-border verkoop zonder OSS — verifieer drempel
              </p>
            )}

            {viesAt && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                VIES-gevalideerd op {new Date(viesAt).toLocaleString('nl-BE')}
              </div>
            )}

            {invoiceText && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Deze tekst wordt automatisch op de factuur geplaatst:<br />
                  <span className="italic">«{invoiceText}»</span>
                </AlertDescription>
              </Alert>
            )}

            {resolution.warnings.map((w, i) => (
              <Alert key={i} className="border-orange-300 bg-orange-50 dark:bg-orange-950/40">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-900 dark:text-orange-200">{w}</AlertDescription>
              </Alert>
            ))}
          </>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            Manual override
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Select
              value={overrideRegime ?? NONE}
              onValueChange={(val) => onOverrideChange(val === NONE ? null : (val as VatRegimeCode))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Geen override — automatisch bepalen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Geen override — automatisch bepalen</SelectItem>
                {regimes.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.description_nl || r.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {overrideRegime && (
              <p className="text-xs text-muted-foreground mt-2">
                Wordt vastgelegd in invoice-metadata (wie/wanneer) bij opslaan.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}