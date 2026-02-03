import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Upload, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  FileSpreadsheet,
  Package,
  ShoppingCart,
  Users,
  Percent,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { 
  parseShopifyProducts, 
  parseShopifyOrders, 
  parseShopifyCustomers,
  parseShopifyDiscounts,
  validateProducts,
  validateOrders,
  validateCustomers,
  type ParsedProduct,
  type ParsedOrder,
  type ParsedCustomer,
  type ParsedDiscount,
} from '@/lib/shopifyImportParsers';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

type ImportType = 'products' | 'orders' | 'customers' | 'discounts';

interface ImportResult {
  type: ImportType;
  success: number;
  failed: number;
  errors: string[];
}

export function ShopifyManualImport() {
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState<ImportType>('products');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  
  // Preview data
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [orders, setOrders] = useState<ParsedOrder[]>([]);
  const [customers, setCustomers] = useState<ParsedCustomer[]>([]);
  const [discounts, setDiscounts] = useState<ParsedDiscount[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleFileDrop = useCallback((acceptedFiles: File[], type: ImportType) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvString = e.target?.result as string;
      setParseErrors([]);
      
      try {
        switch (type) {
          case 'products': {
            const parsed = parseShopifyProducts(csvString);
            const { valid, errors } = validateProducts(parsed);
            setProducts(valid);
            setParseErrors(errors);
            break;
          }
          case 'orders': {
            const parsed = parseShopifyOrders(csvString);
            const { valid, errors } = validateOrders(parsed);
            setOrders(valid);
            setParseErrors(errors);
            break;
          }
          case 'customers': {
            const parsed = parseShopifyCustomers(csvString);
            const { valid, errors } = validateCustomers(parsed);
            setCustomers(valid);
            setParseErrors(errors);
            break;
          }
          case 'discounts': {
            const parsed = parseShopifyDiscounts(csvString);
            setDiscounts(parsed);
            break;
          }
        }
      } catch (error) {
        setParseErrors(['Kon CSV niet verwerken. Controleer het bestandsformaat.']);
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps: getProductsRootProps, getInputProps: getProductsInputProps, isDragActive: isProductsDragActive } = useDropzone({
    onDrop: (files) => handleFileDrop(files, 'products'),
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const { getRootProps: getOrdersRootProps, getInputProps: getOrdersInputProps, isDragActive: isOrdersDragActive } = useDropzone({
    onDrop: (files) => handleFileDrop(files, 'orders'),
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const { getRootProps: getCustomersRootProps, getInputProps: getCustomersInputProps, isDragActive: isCustomersDragActive } = useDropzone({
    onDrop: (files) => handleFileDrop(files, 'customers'),
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const { getRootProps: getDiscountsRootProps, getInputProps: getDiscountsInputProps, isDragActive: isDiscountsDragActive } = useDropzone({
    onDrop: (files) => handleFileDrop(files, 'discounts'),
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const clearData = () => {
    setProducts([]);
    setOrders([]);
    setCustomers([]);
    setDiscounts([]);
    setParseErrors([]);
    setResults(null);
  };

  const handleImport = async () => {
    if (!currentTenant?.id) return;
    
    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;

    try {
      switch (activeTab) {
        case 'products': {
          for (let i = 0; i < products.length; i++) {
            const product = products[i];
            setProgress(Math.round(((i + 1) / products.length) * 100));
            
            try {
              // Generate slug from title
              const slug = product.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') + '-' + Date.now();
              
              const { error } = await supabase.from('products').insert([{
                tenant_id: currentTenant.id,
                name: product.title,
                slug,
                description: product.description,
                sku: product.sku || null,
                barcode: product.barcode,
                price: product.price,
                compare_at_price: product.compare_at_price,
                cost_price: product.cost_price,
                stock: product.stock,
                weight: product.weight,
                tags: product.tags,
                images: product.images,
                is_active: true,
                track_inventory: true,
              }]);
              
              if (error) throw error;
              success++;
            } catch (error) {
              failed++;
              errors.push(`Product "${product.title}": ${error instanceof Error ? error.message : 'Onbekende fout'}`);
            }
          }
          break;
        }
        
        case 'customers': {
          for (let i = 0; i < customers.length; i++) {
            const customer = customers[i];
            setProgress(Math.round(((i + 1) / customers.length) * 100));
            
            try {
              // Check of klant al bestaat op basis van email
              const { data: existing } = await supabase
                .from('customers')
                .select('id')
                .eq('tenant_id', currentTenant.id)
                .eq('email', customer.email)
                .maybeSingle();
              
              const customerData = {
                tenant_id: currentTenant.id,
                email: customer.email,
                first_name: customer.first_name,
                last_name: customer.last_name,
                company_name: customer.company,
                phone: customer.phone,
                // Billing adres velden
                billing_street: customer.address1,
                billing_city: customer.city,
                billing_postal_code: customer.zip,
                billing_country: customer.country || 'NL',
                // Shipping adres (kopie van billing)
                shipping_street: customer.address1,
                shipping_city: customer.city,
                shipping_postal_code: customer.zip,
                shipping_country: customer.country || 'NL',
                // Marketing voorkeuren
                email_subscribed: customer.accepts_marketing,
                total_spent: customer.total_spent,
                total_orders: customer.orders_count,
                // Externe ID voor Shopify tracking
                external_id: customer.email,
              };
              
              if (existing?.id) {
                // Update bestaande klant
                const { error } = await supabase
                  .from('customers')
                  .update(customerData)
                  .eq('id', existing.id);
                
                if (error) throw error;
              } else {
                // Insert nieuwe klant
                const { error } = await supabase
                  .from('customers')
                  .insert([customerData]);
                
                if (error) throw error;
              }
              success++;
            } catch (error: unknown) {
              failed++;
              const errorMessage = error instanceof Error 
                ? error.message 
                : (error as { message?: string })?.message || 'Database fout';
              errors.push(`Klant "${customer.email}": ${errorMessage}`);
            }
          }
          break;
        }
        
        case 'discounts': {
          for (let i = 0; i < discounts.length; i++) {
            const discount = discounts[i];
            setProgress(Math.round(((i + 1) / discounts.length) * 100));
            
            try {
              // Use discount_codes table instead
              const { error } = await supabase.from('discount_codes').insert([{
                tenant_id: currentTenant.id,
                code: discount.code,
                discount_type: discount.type,
                discount_value: discount.value,
                usage_count: discount.usage_count,
                usage_limit: discount.usage_limit,
                minimum_order_amount: discount.minimum_amount,
                valid_from: discount.starts_at,
                valid_until: discount.ends_at,
                is_active: discount.is_active,
              }]);
              
              if (error) throw error;
              success++;
            } catch (error) {
              failed++;
              errors.push(`Korting "${discount.code}": ${error instanceof Error ? error.message : 'Onbekende fout'}`);
            }
          }
          break;
        }
        
        case 'orders': {
          // Orders are more complex - we'll just show a notice for now
          toast.info('Order import vereist koppeling met bestaande klanten en producten. Gebruik de Instant Connect optie voor automatische order sync.');
          break;
        }
      }
      
      setResults({ type: activeTab, success, failed, errors });
      
      if (success > 0) {
        toast.success(`${success} ${activeTab === 'products' ? 'producten' : activeTab === 'customers' ? 'klanten' : 'kortingen'} geïmporteerd!`);
      }
    } catch (error) {
      toast.error('Import mislukt: ' + (error instanceof Error ? error.message : 'Onbekende fout'));
    }
    
    setImporting(false);
  };

  const getPreviewData = () => {
    switch (activeTab) {
      case 'products': return products;
      case 'orders': return orders;
      case 'customers': return customers;
      case 'discounts': return discounts;
      default: return [];
    }
  };

  const previewData = getPreviewData();

  return (
    <div className="space-y-6">
      <Alert variant="destructive" className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
        <AlertTriangle className="w-4 h-4 text-orange-600" />
        <AlertTitle className="text-orange-900 dark:text-orange-100">Eenmalige Import</AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          Dit is een eenmalige import zonder automatische synchronisatie. 
          Wijzigingen in Shopify worden niet automatisch bijgewerkt.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ImportType); clearData(); }}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="products" className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Producten</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-1">
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Orders</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Klanten</span>
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex items-center gap-1">
            <Percent className="w-4 h-4" />
            <span className="hidden sm:inline">Kortingen</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <ExportInstructions type="products" />
          <DropZone
            getRootProps={getProductsRootProps}
            getInputProps={getProductsInputProps}
            isDragActive={isProductsDragActive}
            icon={<Package className="w-8 h-8" />}
            label="Producten CSV"
          />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <ExportInstructions type="orders" />
          <DropZone
            getRootProps={getOrdersRootProps}
            getInputProps={getOrdersInputProps}
            isDragActive={isOrdersDragActive}
            icon={<ShoppingCart className="w-8 h-8" />}
            label="Orders CSV"
          />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <ExportInstructions type="customers" />
          <DropZone
            getRootProps={getCustomersRootProps}
            getInputProps={getCustomersInputProps}
            isDragActive={isCustomersDragActive}
            icon={<Users className="w-8 h-8" />}
            label="Klanten CSV"
          />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <ExportInstructions type="discounts" />
          <DropZone
            getRootProps={getDiscountsRootProps}
            getInputProps={getDiscountsInputProps}
            isDragActive={isDiscountsDragActive}
            icon={<Percent className="w-8 h-8" />}
            label="Kortingen CSV"
          />
        </TabsContent>
      </Tabs>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Validatie fouten</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 text-sm max-h-32 overflow-y-auto">
              {parseErrors.slice(0, 10).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {parseErrors.length > 10 && (
                <li>...en {parseErrors.length - 10} meer</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {previewData.length > 0 && (
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="font-medium">{previewData.length} items gevonden</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearData}>
              <X className="w-4 h-4 mr-1" />
              Wissen
            </Button>
          </div>
          
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {activeTab === 'products' && (
                    <>
                      <TableHead>Titel</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Prijs</TableHead>
                      <TableHead>Voorraad</TableHead>
                    </>
                  )}
                  {activeTab === 'customers' && (
                    <>
                      <TableHead>Email</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Stad</TableHead>
                      <TableHead>Orders</TableHead>
                    </>
                  )}
                  {activeTab === 'orders' && (
                    <>
                      <TableHead>Order #</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Totaal</TableHead>
                      <TableHead>Status</TableHead>
                    </>
                  )}
                  {activeTab === 'discounts' && (
                    <>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Waarde</TableHead>
                      <TableHead>Gebruikt</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(previewData as (ParsedProduct | ParsedCustomer | ParsedOrder | ParsedDiscount)[]).slice(0, 5).map((item, i) => (
                  <TableRow key={i}>
                    {activeTab === 'products' && (
                      <>
                        <TableCell className="font-medium">{(item as ParsedProduct).title}</TableCell>
                        <TableCell>{(item as ParsedProduct).sku || '-'}</TableCell>
                        <TableCell>€{(item as ParsedProduct).price.toFixed(2)}</TableCell>
                        <TableCell>{(item as ParsedProduct).stock}</TableCell>
                      </>
                    )}
                    {activeTab === 'customers' && (
                      <>
                        <TableCell className="font-medium">{(item as ParsedCustomer).email}</TableCell>
                        <TableCell>{(item as ParsedCustomer).first_name} {(item as ParsedCustomer).last_name}</TableCell>
                        <TableCell>{(item as ParsedCustomer).city || '-'}</TableCell>
                        <TableCell>{(item as ParsedCustomer).orders_count}</TableCell>
                      </>
                    )}
                    {activeTab === 'orders' && (
                      <>
                        <TableCell className="font-medium">{(item as ParsedOrder).order_number}</TableCell>
                        <TableCell>{(item as ParsedOrder).email}</TableCell>
                        <TableCell>€{(item as ParsedOrder).total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{(item as ParsedOrder).financial_status}</Badge>
                        </TableCell>
                      </>
                    )}
                    {activeTab === 'discounts' && (
                      <>
                        <TableCell className="font-medium">{(item as ParsedDiscount).code}</TableCell>
                        <TableCell>{(item as ParsedDiscount).type}</TableCell>
                        <TableCell>
                          {(item as ParsedDiscount).type === 'percentage' 
                            ? `${(item as ParsedDiscount).value}%` 
                            : `€${(item as ParsedDiscount).value}`}
                        </TableCell>
                        <TableCell>{(item as ParsedDiscount).usage_count}x</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Import progress */}
      {importing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-center text-muted-foreground">
            Importeren... {progress}%
          </p>
        </div>
      )}

      {/* Results */}
      {results && (
        <Alert variant={results.failed === 0 ? 'default' : 'destructive'}>
          <CheckCircle2 className="w-4 h-4" />
          <AlertTitle>Import voltooid</AlertTitle>
          <AlertDescription>
            {results.success} succesvol, {results.failed} mislukt
            {results.errors.length > 0 && (
              <ul className="list-disc list-inside mt-2 text-sm max-h-24 overflow-y-auto">
                {results.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Import button */}
      {previewData.length > 0 && activeTab !== 'orders' && (
        <Button 
          onClick={handleImport} 
          disabled={importing || previewData.length === 0}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importeren...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Importeer {previewData.length} {activeTab === 'products' ? 'producten' : activeTab === 'customers' ? 'klanten' : 'kortingen'}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function ExportInstructions({ type }: { type: ImportType }) {
  const instructions: Record<ImportType, { path: string; url: string }> = {
    products: { 
      path: 'Products → Export', 
      url: 'https://admin.shopify.com/store/YOUR-STORE/products?selectedView=all' 
    },
    orders: { 
      path: 'Orders → Export', 
      url: 'https://admin.shopify.com/store/YOUR-STORE/orders' 
    },
    customers: { 
      path: 'Customers → Export', 
      url: 'https://admin.shopify.com/store/YOUR-STORE/customers' 
    },
    discounts: { 
      path: 'Discounts → Export', 
      url: 'https://admin.shopify.com/store/YOUR-STORE/discounts' 
    },
  };

  const info = instructions[type];

  return (
    <div className="text-sm text-muted-foreground">
      <p className="mb-1">
        Exporteer uit Shopify Admin:{' '}
        <span className="font-medium text-foreground">{info.path}</span>
      </p>
      <a 
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1"
      >
        Open Shopify Admin
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

interface DropZoneProps {
  getRootProps: () => Record<string, unknown>;
  getInputProps: () => Record<string, unknown>;
  isDragActive: boolean;
  icon: React.ReactNode;
  label: string;
}

function DropZone({ getRootProps, getInputProps, isDragActive, icon, label }: DropZoneProps) {
  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {icon}
        <p className="font-medium">{label}</p>
        <p className="text-sm">
          {isDragActive ? 'Drop hier...' : 'Sleep een CSV bestand hierheen of klik om te selecteren'}
        </p>
      </div>
    </div>
  );
}
