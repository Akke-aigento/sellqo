import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCalculateVatReturn, useGenerateICListing, useSaveVatReturn, VatReturnPeriodType } from '@/hooks/useVatReturns';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];
const quarters = [
  { value: '1', label: 'Q1 (jan-mrt)' },
  { value: '2', label: 'Q2 (apr-jun)' },
  { value: '3', label: 'Q3 (jul-sep)' },
  { value: '4', label: 'Q4 (okt-dec)' },
];
const months = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maart' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Augustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export function VatExportCard() {
  const { t } = useTranslation();
  const [periodType, setPeriodType] = useState<VatReturnPeriodType>('quarterly');
  const [year, setYear] = useState(currentYear.toString());
  const [period, setPeriod] = useState('1');

  const calculateVat = useCalculateVatReturn();
  const generateIC = useGenerateICListing();
  const saveVatReturn = useSaveVatReturn();

  const handleCalculate = () => {
    calculateVat.mutate({
      periodType,
      year: parseInt(year),
      period: parseInt(period),
    });
  };

  const handleDownloadCSV = () => {
    if (!calculateVat.data) return;

    const data = calculateVat.data;
    const rows = [
      ['Type', 'Omschrijving', 'Grondslag', 'BTW-tarief', 'BTW-bedrag'],
      ...data.domesticSales.byRate.map(r => [
        'BINNENLAND',
        `Verkopen ${r.rate}%`,
        r.taxableAmount.toFixed(2),
        r.rate.toFixed(2),
        r.vatAmount.toFixed(2),
      ]),
      ['IC', 'Intracommunautaire leveringen', data.intraCommunitySupplies.toFixed(2), '0.00', '0.00'],
      ['EXPORT', 'Export buiten EU', data.exports.toFixed(2), '0.00', '0.00'],
      ['TOTAAL', 'Te betalen BTW', '', '', data.vatDue.toFixed(2)],
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btw-aangifte-${year}-${periodType === 'quarterly' ? 'Q' : 'M'}${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Save to database
    saveVatReturn.mutate({
      periodType,
      year: parseInt(year),
      period: parseInt(period),
      calculation: data,
    });
  };

  const handleDownloadIC = async () => {
    const data = await generateIC.mutateAsync({
      year: parseInt(year),
      quarter: parseInt(period),
    });

    const rows = [
      ['Landcode', 'BTW-nummer', 'Bedrag'],
      ...data.map(e => [e.countryCode, e.customerVatNumber, e.amount.toFixed(2)]),
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ic-listing-${year}-Q${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vat_export.title')}</CardTitle>
        <CardDescription>{t('vat_export.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Period Type */}
        <div className="space-y-3">
          <Label>{t('vat_export.period_type')}</Label>
          <RadioGroup
            value={periodType}
            onValueChange={(v) => {
              setPeriodType(v as VatReturnPeriodType);
              setPeriod('1');
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly">{t('vat_export.monthly')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="quarterly" id="quarterly" />
              <Label htmlFor="quarterly">{t('vat_export.quarterly')}</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Year & Period */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('vat_export.year')}</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{periodType === 'quarterly' ? t('vat_export.quarter') : t('vat_export.month')}</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(periodType === 'quarterly' ? quarters : months).map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleCalculate} disabled={calculateVat.isPending}>
          {calculateVat.isPending ? t('common.loading') : t('vat_export.calculate')}
        </Button>

        {/* Preview */}
        {calculateVat.data && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium">{t('vat_export.preview')}</h4>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h5 className="font-medium text-sm">{t('vat_export.domestic_sales')}</h5>
                {calculateVat.data.domesticSales.byRate.map(r => (
                  <div key={r.rate} className="flex justify-between text-sm">
                    <span>{r.rate}% BTW: {formatCurrency(r.taxableAmount)}</span>
                    <span>→ BTW {formatCurrency(r.vatAmount)}</span>
                  </div>
                ))}
                
                <Separator className="my-2" />
                
                <div className="flex justify-between text-sm">
                  <span>{t('vat_export.intra_community')}</span>
                  <span>{formatCurrency(calculateVat.data.intraCommunitySupplies)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('vat_export.exports_outside_eu')}</span>
                  <span>{formatCurrency(calculateVat.data.exports)}</span>
                </div>
                
                <Separator className="my-2" />
                
                <div className="flex justify-between font-semibold">
                  <span>{t('vat_export.vat_due')}</span>
                  <span>{formatCurrency(calculateVat.data.vatDue)}</span>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  {t('vat_export.invoice_count')}: {calculateVat.data.invoiceCount} | 
                  {t('vat_export.creditnote_count')}: {calculateVat.data.creditNoteCount}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleDownloadCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t('vat_export.download')} CSV
                </Button>
                {periodType === 'quarterly' && (
                  <Button variant="outline" onClick={handleDownloadIC} disabled={generateIC.isPending}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('vat_export.ic_listing')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
