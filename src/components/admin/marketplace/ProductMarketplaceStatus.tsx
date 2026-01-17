import { useState } from 'react';
import { ShoppingBag, Package, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductMarketplaceMappings } from '@/types/product';

interface ProductMarketplaceStatusProps {
  product: Product;
  onUpdate?: () => void;
}

export function ProductMarketplaceStatus({ product, onUpdate }: ProductMarketplaceStatusProps) {
  const mappings = (product.marketplace_mappings || {}) as ProductMarketplaceMappings;
  const hasBol = !!product.bol_ean || !!mappings.bol_com;
  const hasAmazon = !!product.amazon_asin || !!mappings.amazon;

  if (!hasBol && !hasAmazon) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {hasBol && (
        <Badge variant="outline" className="gap-1 text-xs">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          Bol
        </Badge>
      )}
      {hasAmazon && (
        <Badge variant="outline" className="gap-1 text-xs bg-orange-50">
          <div className="w-2 h-2 bg-orange-500 rounded-full" />
          Amazon
        </Badge>
      )}
    </div>
  );
}

interface ProductMarketplaceLinkDialogProps {
  product: Product;
  onSuccess?: () => void;
}

export function ProductMarketplaceLinkDialog({ product, onSuccess }: ProductMarketplaceLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [bolEan, setBolEan] = useState(product.bol_ean || '');
  const [amazonAsin, setAmazonAsin] = useState(product.amazon_asin || '');
  const [syncInventory, setSyncInventory] = useState(product.sync_inventory ?? true);
  const [saving, setSaving] = useState(false);

  const mappings = (product.marketplace_mappings || {}) as ProductMarketplaceMappings;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          bol_ean: bolEan || null,
          amazon_asin: amazonAsin || null,
          sync_inventory: syncInventory
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Marktplaats koppelingen opgeslagen');
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Kon koppelingen niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Link2 className="h-4 w-4" />
          Koppelen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marktplaats Koppelingen</DialogTitle>
          <DialogDescription>
            Koppel dit product aan externe marktplaatsen voor automatische synchronisatie
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Bol.com */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Bol.com</h4>
                <p className="text-sm text-muted-foreground">
                  {bolEan ? 'Gekoppeld' : 'Niet gekoppeld'}
                </p>
              </div>
            </div>
            <div className="ml-13 space-y-2">
              <Label htmlFor="bol-ean">EAN Code</Label>
              <Input
                id="bol-ean"
                placeholder="Bijv: 8719274850014"
                value={bolEan}
                onChange={(e) => setBolEan(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                De unieke EAN/barcode van dit product op Bol.com
              </p>
            </div>
          </div>

          {/* Amazon */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium">Amazon</h4>
                <p className="text-sm text-muted-foreground">
                  {amazonAsin ? 'Gekoppeld' : 'Niet gekoppeld'}
                </p>
              </div>
            </div>
            <div className="ml-13 space-y-2">
              <Label htmlFor="amazon-asin">ASIN</Label>
              <Input
                id="amazon-asin"
                placeholder="Bijv: B07XYZABC1"
                value={amazonAsin}
                onChange={(e) => setAmazonAsin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                De unieke ASIN van dit product op Amazon
              </p>
            </div>
          </div>

          {/* Sync settings */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Voorraad automatisch synchroniseren</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Voorraad wordt automatisch bijgewerkt op gekoppelde marktplaatsen
                </p>
              </div>
              <Switch
                checked={syncInventory}
                onCheckedChange={setSyncInventory}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
