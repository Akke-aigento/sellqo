import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ShoppingBag, Package, RefreshCw, Loader2, Check, AlertCircle, ExternalLink, Save, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMarketplaceListing, type OptimizedContent, type BolOfferData } from '@/hooks/useMarketplaceListing';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { getEANValidationStatus } from '@/lib/eanValidation';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types/product';

interface ProductMarketplaceTabProps {
  product: Product;
  onRefresh?: () => void;
}

const BOL_DELIVERY_CODES = [
  { value: '24uurs-21', label: '24 uur (besteld voor 21:00)' },
  { value: '24uurs-23', label: '24 uur (besteld voor 23:00)' },
  { value: '1-2d', label: '1-2 werkdagen' },
  { value: '2-3d', label: '2-3 werkdagen' },
  { value: '3-5d', label: '3-5 werkdagen' },
  { value: '4-8d', label: '4-8 werkdagen' },
  { value: '1-8d', label: '1-8 werkdagen' },
];

const BOL_CONDITIONS = [
  { value: 'NEW', label: 'Nieuw' },
  { value: 'AS_NEW', label: 'Als nieuw' },
  { value: 'GOOD', label: 'Goed' },
  { value: 'REASONABLE', label: 'Redelijk' },
  { value: 'MODERATE', label: 'Matig' },
];

export function ProductMarketplaceTab({ product, onRefresh }: ProductMarketplaceTabProps) {
  const { getConnectionByType } = useMarketplaceConnections();
  const { 
    optimizeContent, 
    isOptimizing, 
    saveOptimizedContent, 
    saveMarketplaceSettings,
    createBolOffer, 
    updateBolOffer,
    checkBolProcessStatus,
    isCheckingStatus,
  } = useMarketplaceListing();
  const { toast } = useToast();

  const bolConnection = getConnectionByType('bol_com');
  const hasBolConnection = !!bolConnection;

  // Bol.com state - initialized from product
  const [bolEnabled, setBolEnabled] = useState(product.bol_listing_status !== 'not_listed');
  const [bolEan, setBolEan] = useState(product.bol_ean || product.barcode || '');
  const [bolDeliveryCode, setBolDeliveryCode] = useState(product.bol_delivery_code || '24uurs-21');
  const [bolCondition, setBolCondition] = useState(product.bol_condition || 'NEW');
  const [bolOptimizedTitle, setBolOptimizedTitle] = useState(product.bol_optimized_title || '');
  const [bolBullets, setBolBullets] = useState<string[]>(product.bol_bullets || []);
  
  // Track if settings have changed
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // EAN validation
  const eanValidation = getEANValidationStatus(bolEan);

  // Update local state when product changes
  useEffect(() => {
    setBolEnabled(product.bol_listing_status !== 'not_listed');
    setBolEan(product.bol_ean || product.barcode || '');
    setBolDeliveryCode(product.bol_delivery_code || '24uurs-21');
    setBolCondition(product.bol_condition || 'NEW');
    setBolOptimizedTitle(product.bol_optimized_title || '');
    setBolBullets(product.bol_bullets || []);
    setHasUnsavedChanges(false);
  }, [product]);

  // Track changes
  const handleFieldChange = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveSettings = async () => {
    try {
      await saveMarketplaceSettings.mutateAsync({
        productId: product.id,
        settings: {
          bol_ean: bolEan,
          bol_delivery_code: bolDeliveryCode,
          bol_condition: bolCondition,
          bol_optimized_title: bolOptimizedTitle,
          bol_bullets: bolBullets.filter(Boolean),
        },
      });
      setHasUnsavedChanges(false);
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleOptimizeBol = async () => {
    const content = await optimizeContent(product, 'bol_com');
    if (content) {
      setBolOptimizedTitle(content.title);
      setBolBullets(content.bullets);
      setHasUnsavedChanges(true);
      
      // Auto-save optimized content
      saveOptimizedContent.mutate({
        productId: product.id,
        marketplace: 'bol_com',
        content,
      });
    }
  };

  const handlePublishToBol = async () => {
    // Validate EAN
    if (!eanValidation.isValid) {
      toast({
        title: 'Ongeldige EAN',
        description: eanValidation.message,
        variant: 'destructive',
      });
      return;
    }

    // Warn about zero stock
    if ((product.stock ?? 0) === 0) {
      toast({
        title: 'Waarschuwing',
        description: 'Je publiceert met 0 voorraad. Het product wordt direct als uitverkocht getoond.',
        variant: 'default',
      });
    }

    const offerData: BolOfferData = {
      ean: bolEan.replace(/\s/g, ''),
      condition: bolCondition as BolOfferData['condition'],
      price: product.price,
      stock: product.stock ?? 0,
      delivery_code: bolDeliveryCode,
      fulfilment_method: 'FBR',
      title: bolOptimizedTitle || product.name,
    };

    try {
      await createBolOffer.mutateAsync({ product, offerData });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCheckStatus = async () => {
    const result = await checkBolProcessStatus(product);
    if (result.success) {
      onRefresh?.();
    }
  };

  const handleSyncBol = async () => {
    try {
      await updateBolOffer.mutateAsync({
        product,
        updateType: 'all',
        updateData: {
          price: product.price,
          stock: product.stock ?? 0,
          delivery_code: bolDeliveryCode,
        },
      });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'listed':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Actief
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
            <Clock className="h-3 w-3 mr-1" /> Wordt verwerkt
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Fout
          </Badge>
        );
      default:
        return <Badge variant="outline">Niet gepubliceerd</Badge>;
    }
  };

  const isListed = product.bol_listing_status === 'listed';
  const isPending = product.bol_listing_status === 'pending';
  const hasError = product.bol_listing_status === 'error';

  return (
    <div className="space-y-6">
      {/* Bol.com Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Bol.com</CardTitle>
                <CardDescription>
                  {hasBolConnection ? 'Verbonden' : 'Niet verbonden - Ga naar Connect om te koppelen'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(product.bol_listing_status)}
              <Switch
                checked={bolEnabled}
                onCheckedChange={(checked) => handleFieldChange(setBolEnabled, checked)}
                disabled={!hasBolConnection}
              />
            </div>
          </div>
        </CardHeader>

        {bolEnabled && hasBolConnection && (
          <CardContent className="space-y-6">
            {/* Unsaved changes alert */}
            {hasUnsavedChanges && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je hebt onopgeslagen wijzigingen</span>
                  <Button 
                    size="sm" 
                    onClick={handleSaveSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Opslaan
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message if any */}
            {hasError && product.bol_listing_error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{product.bol_listing_error}</AlertDescription>
              </Alert>
            )}

            {/* Pending status - show check button */}
            {isPending && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je aanbieding wordt verwerkt door Bol.com</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Status controleren
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* EAN & Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bol-ean">EAN Code *</Label>
                <div className="relative">
                  <Input
                    id="bol-ean"
                    value={bolEan}
                    onChange={(e) => handleFieldChange(setBolEan, e.target.value)}
                    placeholder="8719274850014"
                    className={`pr-10 ${
                      bolEan 
                        ? eanValidation.isValid 
                          ? 'border-green-500 focus-visible:ring-green-500' 
                          : 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    disabled={isListed}
                  />
                  {bolEan && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {eanValidation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                <p className={`text-xs ${bolEan && !eanValidation.isValid ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {bolEan ? eanValidation.message : 'Verplicht voor Bol.com (EAN-13)'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Levertijd</Label>
                <Select 
                  value={bolDeliveryCode} 
                  onValueChange={(value) => handleFieldChange(setBolDeliveryCode, value)}
                  disabled={isListed && !hasUnsavedChanges}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOL_DELIVERY_CODES.map((code) => (
                      <SelectItem key={code.value} value={code.value}>
                        {code.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conditie</Label>
                <Select 
                  value={bolCondition} 
                  onValueChange={(value) => handleFieldChange(setBolCondition, value)}
                  disabled={isListed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOL_CONDITIONS.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* AI Optimization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Content Optimalisatie</h4>
                  <p className="text-sm text-muted-foreground">
                    Laat AI je productcontent optimaliseren voor Bol.com
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleOptimizeBol}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Optimaliseer met AI
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Geoptimaliseerde titel</Label>
                  <Input
                    value={bolOptimizedTitle}
                    onChange={(e) => handleFieldChange(setBolOptimizedTitle, e.target.value)}
                    placeholder="AI-geoptimaliseerde titel voor Bol.com"
                    maxLength={150}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bolOptimizedTitle.length}/150 tekens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bullet points (max 5)</Label>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Input
                      key={index}
                      value={bolBullets[index] || ''}
                      onChange={(e) => {
                        const newBullets = [...bolBullets];
                        newBullets[index] = e.target.value;
                        handleFieldChange(setBolBullets, newBullets.filter((b, i) => b || i < index));
                      }}
                      placeholder={`Bullet point ${index + 1}`}
                      maxLength={150}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {product.bol_last_synced_at && (
                  <span>
                    Laatst gesynchroniseerd:{' '}
                    {new Date(product.bol_last_synced_at).toLocaleString('nl-NL')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {/* Save button */}
                {hasUnsavedChanges && (
                  <Button
                    variant="outline"
                    onClick={handleSaveSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Opslaan
                  </Button>
                )}
                
                {/* Sync button for listed products */}
                {isListed && (
                  <Button
                    variant="outline"
                    onClick={handleSyncBol}
                    disabled={updateBolOffer.isPending}
                  >
                    {updateBolOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Synchroniseren
                  </Button>
                )}
                
                {/* Publish button for non-listed products */}
                {!isListed && !isPending && (
                  <Button
                    onClick={handlePublishToBol}
                    disabled={!eanValidation.isValid || createBolOffer.isPending}
                  >
                    {createBolOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Publiceer naar Bol.com
                  </Button>
                )}

                {/* Check status button for pending */}
                {isPending && (
                  <Button
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Status controleren
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {!hasBolConnection && (
          <CardContent>
            <div className="text-center py-6">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Verbind eerst je Bol.com Retailer account om producten te kunnen publiceren
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/connect">Naar Connect</a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Amazon Section */}
      <Card className={!getConnectionByType('amazon') ? 'opacity-60' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Amazon</CardTitle>
                <CardDescription>
                  {getConnectionByType('amazon') ? 'Verbonden' : 'Niet verbonden - Ga naar Connect om te koppelen'}
                </CardDescription>
              </div>
            </div>
            {!getConnectionByType('amazon') ? (
              <Badge variant="secondary">Niet verbonden</Badge>
            ) : (
              <Badge className="bg-green-500">Verbonden</Badge>
            )}
          </div>
        </CardHeader>
        {!getConnectionByType('amazon') && (
          <CardContent>
            <div className="text-center py-6">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Verbind eerst je Amazon Seller Central account om producten te kunnen publiceren
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/connect">Naar Connect</a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
