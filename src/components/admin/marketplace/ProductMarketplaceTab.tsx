import { useState } from 'react';
import { Sparkles, ShoppingBag, Package, RefreshCw, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMarketplaceListing, type OptimizedContent, type BolOfferData } from '@/hooks/useMarketplaceListing';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
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
  const { optimizeContent, isOptimizing, saveOptimizedContent, createBolOffer, updateBolOffer } = useMarketplaceListing();

  const bolConnection = getConnectionByType('bol_com');
  const hasBolConnection = !!bolConnection;

  // Bol.com state
  const [bolEnabled, setBolEnabled] = useState(product.bol_listing_status !== 'not_listed');
  const [bolEan, setBolEan] = useState(product.bol_ean || product.barcode || '');
  const [bolDeliveryCode, setBolDeliveryCode] = useState(product.bol_delivery_code || '24uurs-21');
  const [bolCondition, setBolCondition] = useState(product.bol_condition || 'NEW');
  const [bolOptimizedTitle, setBolOptimizedTitle] = useState(product.bol_optimized_title || '');
  const [bolBullets, setBolBullets] = useState<string[]>(product.bol_bullets || []);

  const handleOptimizeBol = async () => {
    const content = await optimizeContent(product, 'bol_com');
    if (content) {
      setBolOptimizedTitle(content.title);
      setBolBullets(content.bullets);
      // Auto-save
      saveOptimizedContent.mutate({
        productId: product.id,
        marketplace: 'bol_com',
        content,
      });
    }
  };

  const handlePublishToBol = async () => {
    if (!bolEan) {
      return;
    }

    const offerData: BolOfferData = {
      ean: bolEan,
      condition: bolCondition as BolOfferData['condition'],
      price: product.price,
      stock: product.stock,
      delivery_code: bolDeliveryCode,
      fulfilment_method: 'FBR',
      title: bolOptimizedTitle || product.name,
    };

    await createBolOffer.mutateAsync({ product, offerData });
    onRefresh?.();
  };

  const handleSyncBol = async () => {
    await updateBolOffer.mutateAsync({
      product,
      updateType: 'all',
      updateData: {
        price: product.price,
        stock: product.stock,
        delivery_code: bolDeliveryCode,
      },
    });
    onRefresh?.();
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'listed':
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Actief</Badge>;
      case 'pending':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Wordt verwerkt</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Fout</Badge>;
      default:
        return <Badge variant="outline">Niet gepubliceerd</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Bol.com Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
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
                onCheckedChange={setBolEnabled}
                disabled={!hasBolConnection}
              />
            </div>
          </div>
        </CardHeader>

        {bolEnabled && hasBolConnection && (
          <CardContent className="space-y-6">
            {/* Error message if any */}
            {product.bol_listing_error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{product.bol_listing_error}</p>
              </div>
            )}

            {/* EAN & Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bol-ean">EAN Code *</Label>
                <Input
                  id="bol-ean"
                  value={bolEan}
                  onChange={(e) => setBolEan(e.target.value)}
                  placeholder="8719274850014"
                />
                <p className="text-xs text-muted-foreground">Verplicht voor Bol.com</p>
              </div>
              <div className="space-y-2">
                <Label>Levertijd</Label>
                <Select value={bolDeliveryCode} onValueChange={setBolDeliveryCode}>
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
                <Select value={bolCondition} onValueChange={setBolCondition}>
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
                    onChange={(e) => setBolOptimizedTitle(e.target.value)}
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
                        setBolBullets(newBullets.filter(Boolean));
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
                {product.bol_listing_status === 'listed' && (
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
                {product.bol_listing_status !== 'listed' && (
                  <Button
                    onClick={handlePublishToBol}
                    disabled={!bolEan || createBolOffer.isPending}
                  >
                    {createBolOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Publiceer naar Bol.com
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

      {/* Amazon Section (placeholder) */}
      <Card className="opacity-60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Amazon</CardTitle>
                <CardDescription>Binnenkort beschikbaar</CardDescription>
              </div>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
