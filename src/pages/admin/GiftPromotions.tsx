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

const triggerLabels: Record<string, string> = {
  cart_total: 'Bestelwaarde',
  order_total: 'Bestelwaarde',
  product_quantity: 'Aantal producten',
  quantity: 'Aantal producten',
  specific_products: 'Specifieke producten',
  category: 'Categorie',
};

export default function GiftPromotions() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cadeaus bij Aankoop</h1>
          <p className="text-muted-foreground">
            Gratis producten bij bepaalde bestellingen
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Gift Actie
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
            <h3 className="text-lg font-medium">Geen gift acties</h3>
            <p className="text-muted-foreground mb-4">
              Maak je eerste cadeau actie aan
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Gift Actie Aanmaken
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
                      {promo.is_active ? 'Actief' : 'Inactief'}
                    </Badge>
                    {promo.is_stackable && (
                      <Badge variant="outline">Stapelbaar</Badge>
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
                      Bewerken
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(promo.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
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
                    <span className="text-muted-foreground">Trigger:</span>
                    <span>{triggerLabels[promo.trigger_type] || promo.trigger_type}</span>
                  </div>
                  {promo.trigger_value && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waarde:</span>
                      <span>
                        {promo.trigger_type === 'cart_total' || promo.trigger_type === 'order_total'
                          ? `≥ €${promo.trigger_value}`
                          : `≥ ${promo.trigger_value}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cadeau:</span>
                    <span>{promo.gift_quantity}x product</span>
                  </div>
                  {promo.stock_limit && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Voorraad:</span>
                      <span>
                        {promo.stock_used}/{promo.stock_limit}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Actief</span>
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
            <AlertDialogTitle>Gift actie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
