import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth } from 'date-fns';
import { 
  FileText, 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  CreditCard,
  FileSpreadsheet,
  Download,
  Clock,
  Building2,
  User,
  AlertTriangle,
  RefreshCw,
  Zap,
  Factory,
  ClipboardList,
  FileBox,
  Monitor,
  Receipt,
  Banknote,
  Calendar,
  PieChart,
  BarChart3,
  Wallet,
  Warehouse,
  BookOpen,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GlobalDateRangePicker, DateRange } from '@/components/admin/reports/GlobalDateRangePicker';
import { ReportCard } from '@/components/admin/reports/ReportCard';
import { BulkDownloadCard } from '@/components/admin/reports/BulkDownloadCard';
import {
  useInvoiceExport,
  useBulkPdfDownload,
  useOrderExport,
  useCustomerExport,
  useProductExport,
  useCreditNoteExport,
  useSubscriptionExport,
  useAgingExport,
  useVatExport,
  useRevenueExport,
  useSupplierExport,
  usePurchaseOrderExport,
  useSupplierDocumentExport,
  useTopSuppliersExport,
  useBulkSupplierDocumentDownload,
  usePOSSessionExport,
  usePOSTransactionExport,
  usePOSCashMovementExport,
} from '@/hooks/useReportExports';
import {
  useProfitLossExport,
  useVatBreakdownExport,
  useChannelRevenueExport,
  usePaymentReconciliationExport,
  useProductMarginExport,
  useInventoryValuationExport,
  useEnrichedPOSSessionExport,
  useYearEndExport,
  useQuarterlyVatExport,
  useGeneralLedgerExport,
  useDebtorBalanceExport,
  useCreditorBalanceExport,
  useBelgianCustomerListingExport,
  useSalesJournalExport,
  usePurchaseJournalExport,
  useCashflowExport,
  useAccountingSoftwareExport,
} from '@/hooks/useAccountingExports';

const Reports = () => {
  const { currentTenant } = useTenant();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Export hooks
  const { exportInvoices, isExporting: isExportingInvoices } = useInvoiceExport();
  const { downloadInvoicePdfs, downloadInvoiceUbls, isDownloading, progress } = useBulkPdfDownload();
  const { exportOrders, isExporting: isExportingOrders } = useOrderExport();
  const { exportCustomers, exportTopCustomers, isExporting: isExportingCustomers } = useCustomerExport();
  const { exportProducts, exportLowStock, isExporting: isExportingProducts } = useProductExport();
  const { exportCreditNotes, isExporting: isExportingCreditNotes } = useCreditNoteExport();
  const { exportSubscriptions, isExporting: isExportingSubscriptions } = useSubscriptionExport();
  const { exportAgingReport, isExporting: isExportingAging } = useAgingExport();
  const { exportVatReport, exportIcListing, isExporting: isExportingVat } = useVatExport();
  const { exportRevenueReport, isExporting: isExportingRevenue } = useRevenueExport();
  
  // Purchasing export hooks
  const { exportSuppliers, isExporting: isExportingSuppliers } = useSupplierExport();
  const { exportPurchaseOrders, isExporting: isExportingPurchaseOrders } = usePurchaseOrderExport();
  const { exportSupplierDocuments, exportCreditorAging, isExporting: isExportingSupplierDocs } = useSupplierDocumentExport();
  const { exportTopSuppliers, isExporting: isExportingTopSuppliers } = useTopSuppliersExport();
  const { downloadSupplierDocuments, isDownloading: isDownloadingSupplierDocs, progress: supplierDocsProgress } = useBulkSupplierDocumentDownload();

  // POS export hooks
  const { exportSessions, isExporting: isExportingSessions } = usePOSSessionExport();
  const { exportTransactions, exportDailySummary, isExporting: isExportingTransactions } = usePOSTransactionExport();
  const { exportCashMovements, isExporting: isExportingCashMovements } = usePOSCashMovementExport();

  // New accounting export hooks
  const { exportProfitLoss, isExporting: isExportingPL } = useProfitLossExport();
  const { exportVatBreakdown, isExporting: isExportingVatBreakdown } = useVatBreakdownExport();
  const { exportChannelRevenue, isExporting: isExportingChannel } = useChannelRevenueExport();
  const { exportPaymentReconciliation, isExporting: isExportingPayments } = usePaymentReconciliationExport();
  const { exportProductMargin, isExporting: isExportingMargin } = useProductMarginExport();
  const { exportInventoryValuation, isExporting: isExportingInventory } = useInventoryValuationExport();
  const { exportEnrichedSessions, isExporting: isExportingEnrichedSessions } = useEnrichedPOSSessionExport();
  const { exportYearEndPackage, isExporting: isExportingYearEnd } = useYearEndExport();
  const { exportQuarterlyVat, isExporting: isExportingQuarterlyVat } = useQuarterlyVatExport();

  // Fetch counts for display
  const { data: counts } = useQuery({
    queryKey: ['report-counts', currentTenant?.id, dateRange],
    queryFn: async () => {
      if (!currentTenant) return null;

      const [
        invoices, 
        orders, 
        customers, 
        products, 
        creditNotes, 
        subscriptions, 
        openInvoices, 
        invoicesWithPdf,
        suppliers,
        purchaseOrders,
        supplierDocuments,
        openSupplierInvoices,
        posSessions,
        posTransactions,
        posCashMovements
      ] = await Promise.all([
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id),
        supabase
          .from('credit_notes')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'active'),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'sent'),
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .not('pdf_url', 'is', null)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        // Purchasing counts
        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id),
        supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('order_date', dateRange.from.toISOString())
          .lte('order_date', dateRange.to.toISOString()),
        supabase
          .from('supplier_documents')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('document_date', dateRange.from.toISOString())
          .lte('document_date', dateRange.to.toISOString()),
        supabase
          .from('supplier_documents')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .eq('document_type', 'invoice')
          .eq('payment_status', 'pending'),
        // POS counts
        supabase
          .from('pos_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('opened_at', dateRange.from.toISOString())
          .lte('opened_at', dateRange.to.toISOString()),
        supabase
          .from('pos_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('pos_cash_movements')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      return {
        invoices: invoices.count || 0,
        orders: orders.count || 0,
        customers: customers.count || 0,
        products: products.count || 0,
        creditNotes: creditNotes.count || 0,
        subscriptions: subscriptions.count || 0,
        openInvoices: openInvoices.count || 0,
        invoicesWithPdf: invoicesWithPdf.count || 0,
        suppliers: suppliers.count || 0,
        purchaseOrders: purchaseOrders.count || 0,
        supplierDocuments: supplierDocuments.count || 0,
        openSupplierInvoices: openSupplierInvoices.count || 0,
        posSessions: posSessions.count || 0,
        posTransactions: posTransactions.count || 0,
        posCashMovements: posCashMovements.count || 0,
      };
    },
    enabled: !!currentTenant,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rapporten</h1>
          <p className="text-muted-foreground">
            Exporteer alle data voor uw boekhouding in CSV of Excel formaat
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-2">
          <Zap className="h-3 w-3" />
          Rapportage Hub
        </Badge>
      </div>

      {/* Global Date Range Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Rapportage Periode
          </CardTitle>
          <CardDescription>
            Selecteer de periode voor datumafhankelijke rapporten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GlobalDateRangePicker 
            dateRange={dateRange} 
            onDateRangeChange={setDateRange} 
          />
        </CardContent>
      </Card>

      {/* Report Categories */}
      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="financial" className="gap-2">
            <TrendingUp className="h-4 w-4 hidden sm:block" />
            Financieel
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:block" />
            Facturen
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingCart className="h-4 w-4 hidden sm:block" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4 hidden sm:block" />
            Klanten
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4 hidden sm:block" />
            Producten
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <RefreshCw className="h-4 w-4 hidden sm:block" />
            Abonnementen
          </TabsTrigger>
          <TabsTrigger value="purchasing" className="gap-2">
            <Factory className="h-4 w-4 hidden sm:block" />
            Inkoop
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2">
            <Monitor className="h-4 w-4 hidden sm:block" />
            Kassa
          </TabsTrigger>
        </TabsList>

        {/* Financial Reports */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Winst & Verlies"
              description="Omzet minus inkoop minus kosten per maand — het kernrapport voor elke boekhouder"
              icon={<BookOpen className="h-5 w-5" />}
              onExport={(format) => exportProfitLoss(dateRange, format)}
              isLoading={isExportingPL}
            />
            <ReportCard
              title="Omzetrapport"
              description="Totale omzet per periode met BTW en netto"
              icon={<TrendingUp className="h-5 w-5" />}
              onExport={(format) => exportRevenueReport(dateRange, format, 'month')}
              isLoading={isExportingRevenue}
            />
            <ReportCard
              title="Omzet per BTW-tarief"
              description="Uitsplitsing per BTW-tarief (21%, 12%, 6%, 0%) met maatstaf en BTW bedrag"
              icon={<PieChart className="h-5 w-5" />}
              onExport={(format) => exportVatBreakdown(dateRange, format)}
              isLoading={isExportingVatBreakdown}
            />
            <ReportCard
              title="Omzet per Verkoopkanaal"
              description="Webshop vs POS vs Marketplace — omzet, orders, gem. orderbedrag"
              icon={<BarChart3 className="h-5 w-5" />}
              onExport={(format) => exportChannelRevenue(dateRange, format)}
              isLoading={isExportingChannel}
            />
            <ReportCard
              title="Betalingsoverzicht"
              description="Alle ontvangen betalingen — reconciliatie voor bankafschriften"
              icon={<Wallet className="h-5 w-5" />}
              onExport={(format) => exportPaymentReconciliation(dateRange, format)}
              isLoading={isExportingPayments}
            />
            <ReportCard
              title="BTW-aangifte"
              description="Binnenlandse verkopen per tarief, IC en export"
              icon={<CreditCard className="h-5 w-5" />}
              onExport={(format) => exportVatReport(dateRange, format)}
              isLoading={isExportingVat}
            />
            <ReportCard
              title="IC-Listing"
              description="Intracommunautaire leveringen per klant"
              icon={<Building2 className="h-5 w-5" />}
              onExport={(format) => exportIcListing(dateRange, format)}
              isLoading={isExportingVat}
            />
            <ReportCard
              title="Openstaande Facturen (Aging)"
              description="Debiteurenoverzicht per verouderingsbucket"
              icon={<AlertTriangle className="h-5 w-5" />}
              recordCount={counts?.openInvoices}
              onExport={(format) => exportAgingReport(format)}
              isLoading={isExportingAging}
            />
            <ReportCard
              title="Marge-analyse per Product"
              description="Verkoopprijs vs kostprijs, marge (€ en %), gesorteerd op marge%"
              icon={<TrendingUp className="h-5 w-5" />}
              onExport={(format) => exportProductMargin(dateRange, format)}
              isLoading={isExportingMargin}
            />
          </div>
        </TabsContent>

        {/* Invoice Reports */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Factuuroverzicht"
              description="Alle facturen in de geselecteerde periode"
              icon={<FileText className="h-5 w-5" />}
              recordCount={counts?.invoices}
              onExport={(format) => exportInvoices(dateRange, format)}
              isLoading={isExportingInvoices}
            />
            <ReportCard
              title="Creditnota Overzicht"
              description="Alle creditnota's met originele factuur"
              icon={<FileText className="h-5 w-5" />}
              recordCount={counts?.creditNotes}
              onExport={(format) => exportCreditNotes(dateRange, format)}
              isLoading={isExportingCreditNotes}
            />
          </div>

          <Separator />

          <h3 className="text-lg font-medium">Bulk Downloads</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <BulkDownloadCard
              title="Factuur PDF's Downloaden"
              description="Download alle factuur-PDF's als ZIP bestand"
              icon={<Download className="h-5 w-5" />}
              count={counts?.invoicesWithPdf}
              estimatedSize={`~${Math.round((counts?.invoicesWithPdf || 0) * 0.15)} MB`}
              onDownload={() => downloadInvoicePdfs(dateRange)}
              isDownloading={isDownloading}
              progress={progress}
            />
            <BulkDownloadCard
              title="UBL/XML Bestanden"
              description="Download alle UBL bestanden voor Peppol"
              icon={<FileSpreadsheet className="h-5 w-5" />}
              count={counts?.invoicesWithPdf}
              estimatedSize={`~${Math.round((counts?.invoicesWithPdf || 0) * 0.02)} MB`}
              onDownload={() => downloadInvoiceUbls(dateRange)}
              isDownloading={isDownloading}
              progress={progress}
            />
          </div>
        </TabsContent>

        {/* Order Reports */}
        <TabsContent value="orders" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Bestellingen Overzicht"
              description="Alle bestellingen met status en bedragen"
              icon={<ShoppingCart className="h-5 w-5" />}
              recordCount={counts?.orders}
              onExport={(format) => exportOrders(dateRange, format)}
              isLoading={isExportingOrders}
            />
          </div>
        </TabsContent>

        {/* Customer Reports */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Volledig Klantenbestand"
              description="Alle klanten met contactgegevens en statistieken"
              icon={<Users className="h-5 w-5" />}
              recordCount={counts?.customers}
              onExport={(format) => exportCustomers(format, 'all')}
              isLoading={isExportingCustomers}
            />
            <ReportCard
              title="B2B Klanten"
              description="Alleen zakelijke klanten met BTW-nummers"
              icon={<Building2 className="h-5 w-5" />}
              onExport={(format) => exportCustomers(format, 'b2b')}
              isLoading={isExportingCustomers}
            />
            <ReportCard
              title="B2C Klanten"
              description="Particuliere klanten"
              icon={<User className="h-5 w-5" />}
              onExport={(format) => exportCustomers(format, 'b2c')}
              isLoading={isExportingCustomers}
            />
            <ReportCard
              title="Top Klanten"
              description="Gerangschikt op omzet met percentage van totaal"
              icon={<TrendingUp className="h-5 w-5" />}
              onExport={(format) => exportTopCustomers(dateRange, format)}
              isLoading={isExportingCustomers}
            />
          </div>
        </TabsContent>

        {/* Product Reports */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Productcatalogus"
              description="Alle producten met SKU, prijs en voorraad"
              icon={<Package className="h-5 w-5" />}
              recordCount={counts?.products}
              onExport={(format) => exportProducts(format)}
              isLoading={isExportingProducts}
            />
            <ReportCard
              title="Lage Voorraad"
              description="Producten onder minimum voorraadniveau"
              icon={<AlertTriangle className="h-5 w-5" />}
              onExport={(format) => exportLowStock(format)}
              isLoading={isExportingProducts}
            />
            <ReportCard
              title="Voorraadwaardering"
              description="Voorraad × kostprijs per product — balanspost voor de boekhouder"
              icon={<Warehouse className="h-5 w-5" />}
              onExport={(format) => exportInventoryValuation(format)}
              isLoading={isExportingInventory}
            />
          </div>
        </TabsContent>

        {/* Subscription Reports */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Actieve Abonnementen"
              description="Alle lopende subscriptions met MRR"
              icon={<RefreshCw className="h-5 w-5" />}
              recordCount={counts?.subscriptions}
              onExport={(format) => exportSubscriptions(format, 'active')}
              isLoading={isExportingSubscriptions}
            />
            <ReportCard
              title="Alle Abonnementen"
              description="Inclusief beëindigde en gepauzeerde"
              icon={<RefreshCw className="h-5 w-5" />}
              onExport={(format) => exportSubscriptions(format)}
              isLoading={isExportingSubscriptions}
            />
          </div>
        </TabsContent>

        {/* Purchasing Reports */}
        <TabsContent value="purchasing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Leveranciersbestand"
              description="Alle leveranciers met contactgegevens en financiële info"
              icon={<Factory className="h-5 w-5" />}
              recordCount={counts?.suppliers}
              onExport={(format) => exportSuppliers(format)}
              isLoading={isExportingSuppliers}
            />
            <ReportCard
              title="Inkooporders"
              description="Alle inkooporders in de geselecteerde periode"
              icon={<ClipboardList className="h-5 w-5" />}
              recordCount={counts?.purchaseOrders}
              onExport={(format) => exportPurchaseOrders(dateRange, format)}
              isLoading={isExportingPurchaseOrders}
            />
            <ReportCard
              title="Openstaande Crediteuren"
              description="Leveranciersfacturen per verouderingsbucket"
              icon={<AlertTriangle className="h-5 w-5" />}
              recordCount={counts?.openSupplierInvoices}
              onExport={(format) => exportCreditorAging(format)}
              isLoading={isExportingSupplierDocs}
            />
            <ReportCard
              title="Top Leveranciers"
              description="Gerangschikt op inkoopvolume met percentage"
              icon={<TrendingUp className="h-5 w-5" />}
              onExport={(format) => exportTopSuppliers(dateRange, format)}
              isLoading={isExportingTopSuppliers}
            />
            <ReportCard
              title="Leveranciersfacturen"
              description="Alle inkoopfacturen in de periode"
              icon={<FileText className="h-5 w-5" />}
              onExport={(format) => exportSupplierDocuments(dateRange, format)}
              isLoading={isExportingSupplierDocs}
            />
            <ReportCard
              title="Alle Inkoopdocumenten"
              description="Facturen, offertes, pakbonnen en meer"
              icon={<FileBox className="h-5 w-5" />}
              recordCount={counts?.supplierDocuments}
              onExport={(format) => exportSupplierDocuments(dateRange, format)}
              isLoading={isExportingSupplierDocs}
            />
          </div>

          <Separator />

          <h3 className="text-lg font-medium">Bulk Downloads</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <BulkDownloadCard
              title="Leveranciersdocumenten Downloaden"
              description="Download alle inkoopdocumenten als ZIP"
              icon={<Download className="h-5 w-5" />}
              count={counts?.supplierDocuments}
              estimatedSize={`~${Math.round((counts?.supplierDocuments || 0) * 0.15)} MB`}
              onDownload={() => downloadSupplierDocuments(dateRange)}
              isDownloading={isDownloadingSupplierDocs}
              progress={supplierDocsProgress}
            />
          </div>
        </TabsContent>

        {/* POS Reports */}
        <TabsContent value="pos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="Kassa Transacties"
              description="Alle kassaverkopen met betalingsdetails"
              icon={<Receipt className="h-5 w-5" />}
              recordCount={counts?.posTransactions}
              onExport={(format) => exportTransactions(dateRange, format)}
              isLoading={isExportingTransactions}
            />
            <ReportCard
              title="Dagoverzicht"
              description="Omzet per dag met contant/PIN opsplitsing"
              icon={<Calendar className="h-5 w-5" />}
              onExport={(format) => exportDailySummary(dateRange, format)}
              isLoading={isExportingTransactions}
            />
            <ReportCard
              title="Kassasessies"
              description="Alle dagafsluitingen met kascontrole"
              icon={<Monitor className="h-5 w-5" />}
              recordCount={counts?.posSessions}
              onExport={(format) => exportSessions(dateRange, format)}
              isLoading={isExportingSessions}
            />
            <ReportCard
              title="Kasmutaties"
              description="Stortingen en opnames uit de kassa"
              icon={<Banknote className="h-5 w-5" />}
              recordCount={counts?.posCashMovements}
              onExport={(format) => exportCashMovements(dateRange, format)}
              isLoading={isExportingCashMovements}
            />
            <ReportCard
              title="Sessies (Verrijkt)"
              description="Sessies met omzet, transacties, medewerker en sessieduur"
              icon={<BarChart3 className="h-5 w-5" />}
              recordCount={counts?.posSessions}
              onExport={(format) => exportEnrichedSessions(dateRange, format)}
              isLoading={isExportingEnrichedSessions}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Snelle Acties
          </CardTitle>
          <CardDescription>
            Download complete pakketten voor uw boekhouder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              onClick={() => exportYearEndPackage(dateRange)}
              disabled={isExportingYearEnd}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              {isExportingYearEnd ? 'Bezig...' : 'Jaarafsluiting Pakket'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => exportQuarterlyVat()}
              disabled={isExportingQuarterlyVat}
            >
              <PieChart className="h-4 w-4 mr-2" />
              {isExportingQuarterlyVat ? 'Bezig...' : 'BTW Kwartaal Pakket'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                exportInvoices(dateRange, 'xlsx');
                exportCreditNotes(dateRange, 'xlsx');
                exportVatReport(dateRange, 'xlsx');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Fiscaal Pakket
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                exportCustomers('xlsx', 'all');
                exportProducts('xlsx');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Stamgegevens
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                exportSupplierDocuments(dateRange, 'xlsx');
                exportCreditorAging('xlsx');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Crediteuren Pakket
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                exportTransactions(dateRange, 'xlsx');
                exportDailySummary(dateRange, 'xlsx');
                exportSessions(dateRange, 'xlsx');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Kassa Pakket
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;