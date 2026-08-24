import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Gift, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { useGiftPromotions, useDeleteGiftPromotion, useUpdateGiftPromotion } from '@/hooks/useGiftPromotions';
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
import { GiftPromotionFormDialog } from '@/components/admin/promotions/GiftPromotionFormDialog';
import type { GiftPromotion } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

const triggerLabels: Record<string, string> = {
  cart_total: 'Bestelwaarde',
  order_total: 'Bestelwaarde',
  product_quantity: 'Aantal producten',
  quantity: 'Aantal producten',
  specific_products: 'Specifieke producten',
  category: 'Categorie',
};

export default function GiftPromotions() {
  const { t } = useTranslation();
  const { data: promotions = [], isLoading } = useGiftPromotions();
  const deletePromotion = useDeleteGiftPromotion();
  const updatePromotion = useUpdateGiftPromotion();
  const [editPromotion, setEditPromotion] = useState<GiftPromotion | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = (promo: GiftPromotion) => {
    updatePromotion.mutate({
      id: promo.id,
      formData: { is_active: !promo.is_active },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deletePromotion.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.giftPromotions.cadeaus_bij_aankoop')}</h1>
          <p className="text-muted-foreground">
            {t('admin.giftPromotions.gratis_producten_bij_bepaalde_bestellingen')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.giftPromotions.nieuwe_gift_actie')}
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
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('admin.giftPromotions.geen_gift_acties')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('admin.giftPromotions.maak_je_eerste_cadeau_actie_aan')}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.giftPromotions.gift_actie_aanmaken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promotions.map((promo) => (
            <Card key={promo.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{promo.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                      {promo.is_active ? t('admin.marketing.aBTestingPanel.actief') : t('admin.products.inactief')}
                    </Badge>
                    {promo.is_stackable && (
                      <Badge variant="outline">{t('admin.promotions.giftPromotionFormDialog.stapelbaar')}</Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditPromotion(promo)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(promo.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {promo.description || 'Geen beschrijving'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.autoDiscounts.trigger')}</span>
                    <span>{triggerLabels[promo.trigger_type] || promo.trigger_type}</span>
                  </div>
                  {promo.trigger_value && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.autoDiscounts.waarde')}</span>
                      <span>
                        {promo.trigger_type === 'cart_total' || promo.trigger_type === 'order_total'
                          ? `≥ €${promo.trigger_value}`
                          : `≥ ${promo.trigger_value}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.giftPromotions.cadeau')}</span>
                    <span>{promo.gift_quantity}x product</span>
                  </div>
                  {promo.stock_limit && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.giftPromotions.voorraad')}</span>
                      <span>
                        {promo.stock_used}/{promo.stock_limit}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{t('admin.marketing.aBTestingPanel.actief')}</span>
                  <Switch
                    checked={promo.is_active}
                    onCheckedChange={() => handleToggleActive(promo)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GiftPromotionFormDialog
        open={showCreate || !!editPromotion}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditPromotion(null);
          }
        }}
        promotion={editPromotion}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.giftPromotions.gift_actie_verwijderen')}</AlertDialogTitle>
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
