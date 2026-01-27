import { useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Platform = 'bol_com' | 'amazon' | 'ebay' | 'shopify' | 'woocommerce';

interface ChangedField {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

interface ListingUpdateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  productName: string;
  changedFields: ChangedField[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const PLATFORM_NAMES: Record<Platform, string> = {
  bol_com: 'Bol.com',
  amazon: 'Amazon',
  ebay: 'eBay',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  bol_com: 'bg-blue-100 text-blue-700',
  amazon: 'bg-orange-100 text-orange-700',
  ebay: 'bg-red-100 text-red-700',
  shopify: 'bg-green-100 text-green-700',
  woocommerce: 'bg-purple-100 text-purple-700',
};

export function ListingUpdateConfirmDialog({
  open,
  onOpenChange,
  platform,
  productName,
  changedFields,
  onConfirm,
  onCancel,
}: ListingUpdateConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const platformName = PLATFORM_NAMES[platform];
  const platformColor = PLATFORM_COLORS[platform];

  const handleConfirm = async () => {
    if (!understood) return;
    
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
      setUnderstood(false);
    }
  };

  const handleCancel = () => {
    setUnderstood(false);
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Live Listing Bijwerken?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Je staat op het punt om wijzigingen door te voeren naar een{' '}
                <strong>actieve listing</strong> op{' '}
                <Badge variant="outline" className={platformColor}>
                  {platformName}
                </Badge>
              </p>
              
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium text-foreground mb-2">
                  Product: {productName}
                </p>
                
                {changedFields.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      De volgende velden worden bijgewerkt:
                    </p>
                    <ul className="space-y-1">
                      {changedFields.slice(0, 5).map((field) => (
                        <li key={field.field} className="text-xs">
                          <span className="font-medium">{field.label}:</span>{' '}
                          <span className="line-through text-muted-foreground">
                            {field.oldValue.substring(0, 30)}
                            {field.oldValue.length > 30 && '...'}
                          </span>{' '}
                          →{' '}
                          <span className="text-primary">
                            {field.newValue.substring(0, 30)}
                            {field.newValue.length > 30 && '...'}
                          </span>
                        </li>
                      ))}
                      {changedFields.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          ... en {changedFields.length - 5} andere veld(en)
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Let op:</strong> Deze wijzigingen zijn direct zichtbaar voor klanten 
                  op {platformName}. Zorg dat de content correct is voordat je doorgaat.
                </p>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understood"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked === true)}
                />
                <Label
                  htmlFor="understood"
                  className="text-sm font-normal leading-relaxed cursor-pointer"
                >
                  Ik begrijp dat deze wijzigingen direct naar mijn live {platformName} listing 
                  worden gepusht en zichtbaar zijn voor klanten.
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!understood || isConfirming}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Bijwerken...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ja, Bijwerken
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
