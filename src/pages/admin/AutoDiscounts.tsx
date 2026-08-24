import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Zap, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { useAutoDiscounts, useDeleteAutoDiscount, useUpdateAutoDiscount } from '@/hooks/useAutoDiscounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { AutoDiscountFormDialog } from '@/components/admin/promotions/AutoDiscountFormDialog';
import type { AutomaticDiscount } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const triggerLabels: Record<string, string> = {
  cart_total: 'Winkelwagen totaal',
  product_quantity: 'Aantal producten',
  specific_products: 'Specifieke producten',
  category: 'Categorie',
  first_order: 'Eerste bestelling',
};

const discountLabels: Record<string, string> = {
  percentage: 'Percentage',
  fixed_amount: 'Vast bedrag',
  free_shipping: 'Gratis verzending',
  free_product: 'Gratis product',
};

export default function AutoDiscounts() {
  const { t } = useTranslation();
  const { data: discounts = [], isLoading } = useAutoDiscounts();
  const deleteDiscount = useDeleteAutoDiscount();
  const updateDiscount = useUpdateAutoDiscount();
  const [editDiscount, setEditDiscount] = useState<AutomaticDiscount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = (discount: AutomaticDiscount) => {
    updateDiscount.mutate({
      id: discount.id,
      formData: { is_active: !discount.is_active },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteDiscount.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.autoDiscounts.automatische_kortingen')}</h1>
          <p className="text-muted-foreground">
            {t('admin.autoDiscounts.kortingen_die_automatisch_toegepast_worden_bij')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.autoDiscounts.nieuwe_korting')}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : discounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('admin.autoDiscounts.geen_automatische_kortingen')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('admin.autoDiscounts.maak_je_eerste_automatische_korting_aan')}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.autoDiscounts.korting_aanmaken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {discounts.map((discount) => (
            <Card key={discount.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{discount.name}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={discount.is_active ? 'default' : 'secondary'}>
                      {discount.is_active ? t('admin.marketing.aBTestingPanel.actief') : t('admin.products.inactief')}
                    </Badge>
                    <Badge variant="outline">
                      Prioriteit: {discount.priority}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditDiscount(discount)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(discount.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {discount.description || 'Geen beschrijving'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.autoDiscounts.trigger')}</span>
                    <span>{triggerLabels[discount.trigger_type] || discount.trigger_type}</span>
                  </div>
                  {discount.trigger_value && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.autoDiscounts.waarde')}</span>
                      <span>
                        {discount.trigger_type === 'cart_total'
                          ? `€${discount.trigger_value}`
                          : discount.trigger_value}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.bundles.korting')}</span>
                    <span className="font-medium">
                      {discount.discount_type === 'percentage'
                        ? `${discount.discount_value}%`
                        : discount.discount_type === 'fixed_amount'
                        ? `€${discount.discount_value?.toFixed(2)}`
                        : discountLabels[discount.discount_type]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.autoDiscounts.gebruik')}</span>
                    <span>{discount.usage_count}x</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{t('admin.marketing.aBTestingPanel.actief')}</span>
                  <Switch
                    checked={discount.is_active}
                    onCheckedChange={() => handleToggleActive(discount)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AutoDiscountFormDialog
        open={showCreate || !!editDiscount}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditDiscount(null);
          }
        }}
        discount={editDiscount}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.autoDiscounts.automatische_korting_verwijderen')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.bundles.deze_actie_kan_niet_ongedaan_worden')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
