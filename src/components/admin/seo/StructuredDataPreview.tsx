import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Code, 
  Copy, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  ExternalLink,
  ShoppingBag,
  Building2,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import {
  generateProductJsonLd,
  generateOrganizationJsonLd,
  generateBreadcrumbJsonLd,
  validateProductJsonLd,
  renderJsonLd,
  type ProductStructuredData,
  type BusinessStructuredData,
  type BreadcrumbItem,
} from '@/lib/structuredData';
import { useTranslation } from 'react-i18next';

interface StructuredDataPreviewProps {
  products?: ProductStructuredData[];
  business?: BusinessStructuredData;
  breadcrumbs?: BreadcrumbItem[];
  baseUrl: string;
}

export function StructuredDataPreview({
  products = [],
  business,
  breadcrumbs = [],
  baseUrl,
}: StructuredDataPreviewProps) {
  const { t } = useTranslation();
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(
    products[0]?.id || null
  );

  const copyToClipboard = async (data: object, type: string) => {
    try {
      const script = `<script type="application/ld+json">\n${renderJsonLd(data)}\n</script>`;
      await navigator.clipboard.writeText(script);
      setCopiedType(type);
      toast.success('JSON-LD gekopieerd naar klembord');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const selectedProductData = products.find(p => p.id === selectedProduct);
  const productJsonLd = selectedProductData 
    ? generateProductJsonLd(selectedProductData, baseUrl) 
    : null;
  const validation = productJsonLd ? validateProductJsonLd(productJsonLd) : null;

  const organizationJsonLd = business 
    ? generateOrganizationJsonLd(business) 
    : null;

  const breadcrumbJsonLd = breadcrumbs.length > 0 
    ? generateBreadcrumbJsonLd(breadcrumbs) 
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          {t('admin.seo.structuredDataPreview.structured_data_json_ld')}
        </CardTitle>
        <CardDescription>
          {t('admin.seo.structuredDataPreview.gestructureerde_data_helpt_zoekmachines_je_content')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="product">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="product" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t('admin.stockReport.colName')}
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t('admin.seo.structuredDataPreview.organisatie')}
            </TabsTrigger>
            <TabsTrigger value="breadcrumb" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              {t('admin.seo.structuredDataPreview.breadcrumb')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="product" className="space-y-4 mt-4">
            {products.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('admin.seo.structuredDataPreview.geen_producten')}</AlertTitle>
                <AlertDescription>
                  {t('admin.seo.structuredDataPreview.voeg_producten_toe_om_structured_data')}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Product selector */}
                <div className="flex flex-wrap gap-2">
                  {products.slice(0, 5).map((product) => (
                    <Button
                      key={product.id}
                      variant={selectedProduct === product.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProduct(product.id)}
                    >
                      {product.name.slice(0, 20)}
                      {product.name.length > 20 && '...'}
                    </Button>
                  ))}
                  {products.length > 5 && (
                    <Badge variant="secondary">+{products.length - 5} meer</Badge>
                  )}
                </div>

                {/* Validation */}
                {validation && (
                  <div className="space-y-2">
                    {validation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t('admin.seo.structuredDataPreview.fouten_gevonden')}</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside mt-1">
                            {validation.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {validation.warnings.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{t('admin.adsAiRules.aanbevelingen')}</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc list-inside mt-1">
                            {validation.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* JSON-LD Preview */}
                {productJsonLd && (
                  <div className="relative">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyToClipboard(productJsonLd, 'product')}
                      >
                        {copiedType === 'product' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="h-[300px] rounded-md border bg-muted p-4">
                      <pre className="text-xs">
                        <code>{renderJsonLd(productJsonLd)}</code>
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open('https://search.google.com/test/rich-results', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('admin.seo.structuredDataPreview.test_in_google_rich_results')}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="organization" className="space-y-4 mt-4">
            {!organizationJsonLd ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('admin.seo.structuredDataPreview.geen_bedrijfsgegevens')}</AlertTitle>
                <AlertDescription>
                  {t('admin.seo.structuredDataPreview.configureer_je_bedrijfsgegevens_in_instellingen_om')}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(organizationJsonLd, 'organization')}
                  >
                    {copiedType === 'organization' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[300px] rounded-md border bg-muted p-4">
                  <pre className="text-xs">
                    <code>{renderJsonLd(organizationJsonLd)}</code>
                  </pre>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="breadcrumb" className="space-y-4 mt-4">
            {!breadcrumbJsonLd ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('admin.seo.structuredDataPreview.geen_breadcrumbs')}</AlertTitle>
                <AlertDescription>
                  {t('admin.seo.structuredDataPreview.breadcrumb_structured_data_wordt_automatisch_gegenereerd')}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(breadcrumbJsonLd, 'breadcrumb')}
                  >
                    {copiedType === 'breadcrumb' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <ScrollArea className="h-[200px] rounded-md border bg-muted p-4">
                  <pre className="text-xs">
                    <code>{renderJsonLd(breadcrumbJsonLd)}</code>
                  </pre>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
