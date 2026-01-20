import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Layers, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { useVolumeDiscounts, useDeleteVolumeDiscount, useUpdateVolumeDiscount } from '@/hooks/useVolumeDiscounts';
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
import { VolumeDiscountFormDialog } from '@/components/admin/promotions/VolumeDiscountFormDialog';
import type { VolumeDiscount } from '@/types/promotions';

export default function VolumeDiscounts() {
  const { data: discounts = [], isLoading } = useVolumeDiscounts();
  const deleteDiscount = useDeleteVolumeDiscount();
  const updateDiscount = useUpdateVolumeDiscount();
  const [editDiscount, setEditDiscount] = useState<VolumeDiscount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = (discount: VolumeDiscount) => {
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

  const appliesToLabels: Record<string, string> = {
    all: 'Alles',
    product: 'Product',
    category: 'Categorie',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staffelkortingen</h1>
          <p className="text-muted-foreground">
            Geef korting op basis van bestelwaarde of aantal
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Staffel
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
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Geen staffelkortingen</h3>
            <p className="text-muted-foreground mb-4">
              Maak je eerste staffelkorting aan
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Staffel Aanmaken
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
                  <div className="flex gap-2">
                    <Badge variant={discount.is_active ? 'default' : 'secondary'}>
                      {discount.is_active ? 'Actief' : 'Inactief'}
                    </Badge>
                    <Badge variant="outline">
                      {appliesToLabels[discount.applies_to] || discount.applies_to}
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
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Staffels:</span>
                  <div className="space-y-1">
                    {discount.tiers?.slice(0, 3).map((tier, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>≥ {tier.min_quantity} stuks</span>
                        <span className="font-medium">
                          {tier.discount_type === 'percentage'
                            ? `${tier.discount_value}%`
                            : `€${tier.discount_value}`}
                        </span>
                      </div>
                    ))}
                    {(discount.tiers?.length || 0) > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{(discount.tiers?.length || 0) - 3} meer...
                      </span>
                    )}
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

      <VolumeDiscountFormDialog
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
            <AlertDialogTitle>Staffelkorting verwijderen?</AlertDialogTitle>
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
