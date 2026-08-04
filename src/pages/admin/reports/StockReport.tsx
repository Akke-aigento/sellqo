import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { nl as nlLocale } from 'date-fns/locale';
import { AlertTriangle, Calendar as CalendarIcon, Download, FileSpreadsheet, History, Loader2, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';
import { useCategories } from '@/hooks/useCategories';
import { useStockReport, isToday, type StockReportRow } from '@/hooks/useStockReport';
import { StockLedgerDialog } from '@/components/admin/products/StockLedgerDialog';
import { PageMeta } from '@/components/seo/PageMeta';

const money = (v: number) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(v || 0);

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'shop';

const StockReport = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { categories } = useCategories();

  const [date, setDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [hideZero, setHideZero] = useState(true);
  const [ledgerRow, setLedgerRow] = useState<StockReportRow | null>(null);

  const { data, isLoading } = useStockReport(date);
  const rows = data?.rows ?? [];
  const reconstruction = data?.isReconstruction ?? !isToday(date);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideZero && r.stock === 0) return false;
      if (categoryId !== 'all' && !r.category_ids.includes(categoryId)) return false;
      if (q) {
        const hay = `${r.name} ${r.variant_title ?? ''} ${r.sku ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, categoryId, hideZero]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          stock: acc.stock + r.stock,
          stockValue: acc.stockValue + r.stock_value,
          salesValue: acc.salesValue + r.sales_value,
        }),
        { stock: 0, stockValue: 0, salesValue: 0 },
      ),
    [filtered],
  );

  const dateStr = format(date, 'yyyy-MM-dd');
  const fileBase = `voorraad_${slug(currentTenant?.name ?? '')}_${dateStr}`;

  const buildMatrix = (): (string | number)[][] => {
    const head: (string | number)[][] = [
      [t('admin.stockReport.exportTenant'), currentTenant?.name ?? ''],
      [t('admin.stockReport.exportDate'), dateStr],
      [t('admin.stockReport.exportGeneratedAt'), new Date().toISOString()],
    ];
    if (reconstruction) head.push([t('admin.stockReport.exportNotice'), t('admin.stockReport.reconstructionNotice')]);
    head.push([]);
    head.push([
      t('admin.stockReport.colSku'),
      t('admin.stockReport.colName'),
      t('admin.stockReport.colVariant'),
      t('admin.stockReport.colStock'),
      t('admin.stockReport.colCostPrice'),
      t('admin.stockReport.colStockValue'),
      t('admin.stockReport.colSalesPrice'),
      t('admin.stockReport.colSalesValue'),
    ]);
    for (const r of filtered) {
      head.push([
        r.sku ?? '',
        r.name,
        r.variant_title ?? '',
        r.stock,
        r.cost_price,
        r.stock_value,
        r.sales_price,
        r.sales_value,
      ]);
    }
    head.push([
      t('admin.stockReport.totals'),
      '',
      '',
      totals.stock,
      '',
      totals.stockValue,
      '',
      totals.salesValue,
    ]);
    return head;
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const csv = buildMatrix()
      .map((row) =>
        row
          .map((cell) => {
            const s = typeof cell === 'number' ? String(cell) : (cell ?? '');
            return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(';'),
      )
      .join('\n');
    download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), `${fileBase}.csv`);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.aoa_to_sheet(buildMatrix());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Voorraad');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase}.xlsx`);
  };

  const renderRow = (r: StockReportRow) => (
    <TableRow key={r.key}>
      <TableCell className="font-mono text-xs">{r.sku ?? '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{r.name}</span>
          {r.negative && (
            <span title={t('admin.stockReport.negativeWarning')}>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{r.variant_title ?? '—'}</TableCell>
      <TableCell className="text-right">{r.stock}</TableCell>
      <TableCell className="text-right">{money(r.cost_price)}</TableCell>
      <TableCell className="text-right font-medium">{money(r.stock_value)}</TableCell>
      <TableCell className="text-right">{money(r.sales_price)}</TableCell>
      <TableCell className="text-right">{money(r.sales_value)}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={t('admin.stockLedger.openHistory')}
          onClick={() => setLedgerRow(r)}
        >
          <History className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <PageMeta title={t('admin.stockReport.title')} description={t('admin.stockReport.subtitle')} path="/admin/reports/stock" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.stockReport.title')}</h1>
          <p className="text-muted-foreground">{t('admin.stockReport.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('justify-start text-left font-normal')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'd MMMM yyyy', { locale: nlLocale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) setDate(d);
                  setCalendarOpen(false);
                }}
                disabled={(d) => d > new Date()}
                locale={nlLocale}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            {t('admin.stockReport.exportCsv')}
          </Button>
          <Button variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {t('admin.stockReport.exportXlsx')}
          </Button>
        </div>
      </div>

      {reconstruction && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            {t('admin.stockReport.reconstructionNotice')}
            {data?.usedPoApproximation ? ` ${t('admin.stockReport.poApproximation')}` : ''}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('admin.stockReport.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t('admin.stockReport.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="md:w-64">
              <SelectValue placeholder={t('admin.stockReport.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.stockReport.allCategories')}</SelectItem>
              {(categories ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="hide-zero" checked={hideZero} onCheckedChange={setHideZero} />
            <Label htmlFor="hide-zero">{t('admin.stockReport.hideZeroStock')}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">{t('admin.stockReport.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.stockReport.colSku')}</TableHead>
                    <TableHead>{t('admin.stockReport.colName')}</TableHead>
                    <TableHead>{t('admin.stockReport.colVariant')}</TableHead>
                    <TableHead className="text-right">{t('admin.stockReport.colStock')}</TableHead>
                    <TableHead className="text-right">{t('admin.stockReport.colCostPrice')}</TableHead>
                    <TableHead className="text-right">{t('admin.stockReport.colStockValue')}</TableHead>
                    <TableHead className="text-right">{t('admin.stockReport.colSalesPrice')}</TableHead>
                    <TableHead className="text-right">{t('admin.stockReport.colSalesValue')}</TableHead>
                    <TableHead className="text-right sr-only">{t('admin.stockLedger.openHistory')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(renderRow)}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>{t('admin.stockReport.totals')}</TableCell>
                    <TableCell className="text-right">{totals.stock}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{money(totals.stockValue)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{money(totals.salesValue)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <StockLedgerDialog
        open={ledgerRow !== null}
        onOpenChange={(o) => { if (!o) setLedgerRow(null); }}
        productId={ledgerRow?.product_id ?? null}
        variantId={ledgerRow?.variant_id ?? null}
        title={ledgerRow ? [ledgerRow.name, ledgerRow.variant_title].filter(Boolean).join(' — ') : undefined}
      />
    </div>
  );
};

export default StockReport;
