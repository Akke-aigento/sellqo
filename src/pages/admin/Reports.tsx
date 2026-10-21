import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getReportPresetRange, type ReportPresetKey } from '@/lib/reportDateRanges';
import {
  TrendingUp,
  CreditCard,
  Clock,
  Building2,
  AlertTriangle,
  Zap,
  Package as PackageIcon,
  Loader2,
  FileCode,
  FileCheck,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlobalDateRangePicker, DateRange } from '@/components/admin/reports/GlobalDateRangePicker';
import { ReportCard } from '@/components/admin/reports/ReportCard';
import { OPEN_INVOICE_STATUSES } from '@/lib/invoiceStatuses';
import {
  useAgingExport,
  useVatExport,
  useRevenueExport,
} from '@/hooks/useReportExports';

// NIGHT-QF-3: zelfde berekening als de picker (src/lib/reportDateRanges.ts).
const QUICK_PRESETS: ReportPresetKey[] = ['this_quarter', 'last_quarter', 'this_year', 'last_year'];

const Reports = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [dateRange, setDateRange] = useState<DateRange>(() => getReportPresetRange(QUICK_PRESETS[0]));

  const { exportAgingReport, isExporting: isExportingAging } = useAgingExport();
  const { exportVatReport, exportIcListing, exportQBundle, exportIntervatBundle, isExporting: isExportingVat, isBundling } = useVatExport();
  const { exportRevenueReport, isExporting: isExportingRevenue } = useRevenueExport();

  const { data: counts } = useQuery({
    queryKey: ['report-counts', currentTenant?.id, dateRange],
    queryFn: async () => {
      if (!currentTenant) return null;
      const [invoices, openInvoices] = await Promise.all([
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('issue_date', dateRange.from.toISOString())
          .lte('issue_date', dateRange.to.toISOString()),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .in('status', OPEN_INVOICE_STATUSES),
      ]);
      return {
        invoices: invoices.count || 0,
        openInvoices: openInvoices.count || 0,
      };
    },
    enabled: !!currentTenant,
  });

  const triggerQBundle = () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Selecteer eerst een periode');
      return;
    }
    exportQBundle(dateRange);
  };

  const triggerIntervat = () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error('Selecteer eerst een periode');
      return;
    }
    exportIntervatBundle(dateRange);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-muted-foreground">
            Genereer en download fiscale rapporten en aangiftes voor uw boekhouder
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-2">
          <Zap className="h-3 w-3" />
          Rapportage Hub
        </Badge>
      </div>

      {/* Quick Actions Bar */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Snelle Acties
          </CardTitle>
          <CardDescription>
            Eén klik voor uw boekhouder of voor INTERVAT upload
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={isBundling}
              onClick={triggerQBundle}
            >
              {isBundling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PackageIcon className="h-4 w-4 mr-2" />
              )}
              {isBundling ? 'Pakket samenstellen…' : 'Fiscaal Pakket Downloaden'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={isBundling}
              onClick={triggerIntervat}
            >
              {isBundling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 mr-2" />
              )}
              INTERVAT Upload-pakket
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Global Date Range Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Rapportage Periode
          </CardTitle>
          <CardDescription>
            Selecteer de periode voor alle rapporten op deze pagina
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDateRange(getReportPresetRange(key))}
              >
                {t(`admin.reports.globalDateRangePicker.presets.${key}`)}
              </Button>
            ))}
          </div>
          <GlobalDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </CardContent>
      </Card>

      {/* Report Categories */}
      <Tabs defaultValue="aangiftes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="aangiftes" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Aangiftes
          </TabsTrigger>
          <TabsTrigger value="boekhouding" className="gap-2">
            <Calculator className="h-4 w-4" />
            Boekhouding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aangiftes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard
              title="BTW-aangifte"
              description="Volledige periodieke aangifte (vakken 00-88, IC, export)"
              icon={<CreditCard className="h-5 w-5" />}
              formats={['xlsx', 'pdf', 'csv', 'intervat-xml', 'json']}
              onExport={(format) => exportVatReport(dateRange, format)}
              isLoading={isExportingVat}
            />
            <ReportCard
              title="IC-Listing"
              description="Intracommunautaire leveringen per klant (formulier 723)"
              icon={<Building2 className="h-5 w-5" />}
              formats={['xlsx', 'csv', 'intervat-xml', 'json']}
              onExport={(format) => exportIcListing(dateRange, format)}
              isLoading={isExportingVat}
            />
          </div>
        </TabsContent>

        <TabsContent value="boekhouding" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard
              title="Omzetrapport"
              description="Totale omzet per periode met BTW en netto"
              icon={<TrendingUp className="h-5 w-5" />}
              formats={['xlsx', 'csv']}
              onExport={(format) => exportRevenueReport(dateRange, format, 'month')}
              isLoading={isExportingRevenue}
            />
            <ReportCard
              title="Openstaande Facturen Aging"
              description="Debiteurenoverzicht per verouderingsbucket"
              icon={<AlertTriangle className="h-5 w-5" />}
              recordCount={counts?.openInvoices}
              formats={['xlsx', 'csv']}
              onExport={(format) => exportAgingReport(format)}
              isLoading={isExportingAging}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;