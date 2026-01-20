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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automatische Kortingen</h1>
          <p className="text-muted-foreground">
            Kortingen die automatisch toegepast worden bij checkout
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Korting
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
            <h3 className="text-lg font-medium">Geen automatische kortingen</h3>
            <p className="text-muted-foreground mb-4">
              Maak je eerste automatische korting aan
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Korting Aanmaken
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
                      {discount.is_active ? 'Actief' : 'Inactief'}
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
                      Bewerken
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(discount.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
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
                    <span className="text-muted-foreground">Trigger:</span>
                    <span>{triggerLabels[discount.trigger_type] || discount.trigger_type}</span>
                  </div>
                  {discount.trigger_value && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waarde:</span>
                      <span>
                        {discount.trigger_type === 'cart_total'
                          ? `€${discount.trigger_value}`
                          : discount.trigger_value}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Korting:</span>
                    <span className="font-medium">
                      {discount.discount_type === 'percentage'
                        ? `${discount.discount_value}%`
                        : discount.discount_type === 'fixed_amount'
                        ? `€${discount.discount_value?.toFixed(2)}`
                        : discountLabels[discount.discount_type]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gebruik:</span>
                    <span>{discount.usage_count}x</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Actief</span>
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
            <AlertDialogTitle>Automatische korting verwijderen?</AlertDialogTitle>
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
