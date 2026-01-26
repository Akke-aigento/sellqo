import { useState, useCallback } from 'react';
import { Package, ArrowRight, ArrowLeft, Upload, X, Loader2, Eye } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { OnboardingTooltip } from '../OnboardingTooltip';
import { OnboardingData } from '@/hooks/useOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface FirstProductStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  tenantId: string | null;
  isLoading: boolean;
}

export function FirstProductStep({
  data,
  updateData,
  onNext,
  onPrev,
  tenantId,
  isLoading,
}: FirstProductStepProps) {
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !tenantId) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/products/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      updateData({ productImageUrl: publicUrl.publicUrl });
    } catch (error: any) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [tenantId, updateData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeImage = () => {
    updateData({ productImageUrl: null });
  };

  const canContinue = data.productName.trim().length >= 2 && data.productPrice > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canContinue) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Voeg je eerste product toe</h2>
        <p className="text-muted-foreground">
          Begin met je populairste product. Je kunt later eenvoudig meer toevoegen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="productName">Productnaam *</Label>
              <OnboardingTooltip
                title="Productnaam"
                content="Kies een duidelijke naam die je product beschrijft. Dit is wat klanten zien in je webshop."
              />
            </div>
            <Input
              id="productName"
              value={data.productName}
              onChange={(e) => updateData({ productName: e.target.value })}
              placeholder="Bijv. Handgemaakte kaars - Vanille"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="productPrice">Prijs *</Label>
              <OnboardingTooltip
                title="Prijs"
                content="De verkoopprijs inclusief BTW. Je kunt dit later aanpassen en ook kortingsprijzen instellen."
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="productPrice"
                type="number"
                step="0.01"
                min="0"
                value={data.productPrice || ''}
                onChange={(e) => updateData({ productPrice: parseFloat(e.target.value) || 0 })}
                placeholder="24.95"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="productDescription">Beschrijving</Label>
              <OnboardingTooltip
                title="Beschrijving"
                content="Een korte beschrijving helpt klanten begrijpen wat ze kopen. Optioneel voor nu."
              />
            </div>
            <Textarea
              id="productDescription"
              value={data.productDescription}
              onChange={(e) => updateData({ productDescription: e.target.value })}
              placeholder="Beschrijf je product in een paar zinnen..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Productafbeelding</Label>
              <OnboardingTooltip
                title="Productafbeelding"
                content="Een goede foto verkoopt! Gebruik een heldere afbeelding op een neutrale achtergrond."
              />
            </div>
            
            {data.productImageUrl ? (
              <div className="relative w-32 h-32">
                <img
                  src={data.productImageUrl}
                  alt="Product"
                  className="w-full h-full object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={removeImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                  isDragActive && 'border-primary bg-primary/5',
                  !isDragActive && 'border-muted-foreground/25 hover:border-primary/50'
                )}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Sleep of klik om te uploaden
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Label>Preview</Label>
          </div>
          <Card className="overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center">
              {data.productImageUrl ? (
                <img
                  src={data.productImageUrl}
                  alt={data.productName || 'Product'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground/40" />
              )}
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold truncate">
                {data.productName || 'Productnaam'}
              </h3>
              {data.productDescription && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {data.productDescription}
                </p>
              )}
              <p className="text-lg font-bold text-primary">
                {data.productPrice > 0 ? formatCurrency(data.productPrice) : '€ 0,00'}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className="flex-1"
          disabled={isLoading}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Vorige
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!canContinue || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Bezig...
            </>
          ) : (
            <>
              Volgende stap
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
