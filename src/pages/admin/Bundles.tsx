import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Package, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { useBundles, useDeleteBundle, useUpdateBundle } from '@/hooks/useBundles';
import { format } from 'date-fns';
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
import { BundleFormDialog } from '@/components/admin/promotions/BundleFormDialog';
import type { ProductBundle } from '@/types/promotions';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

export default function Bundles() {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { data: bundles = [], isLoading } = useBundles();
  const deleteBundle = useDeleteBundle();
  const updateBundle = useUpdateBundle();
  const [editBundle, setEditBundle] = useState<ProductBundle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = (bundle: ProductBundle) => {
    updateBundle.mutate({
      id: bundle.id,
      formData: { is_active: !bundle.is_active },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteBundle.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.bundles.product_bundels')}</h1>
          <p className="text-muted-foreground">
            {t('admin.bundles.maak_bundels_van_producten_met_speciale')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.bundles.nieuwe_bundel')}
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
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('admin.bundles.geen_bundels')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('admin.bundles.maak_je_eerste_product_bundel_aan')}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.bundles.bundel_aanmaken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <Card key={bundle.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{bundle.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={bundle.is_active ? 'default' : 'secondary'}>
                      {bundle.is_active ? t('admin.marketing.aBTestingPanel.actief') : t('admin.products.inactief')}
                    </Badge>
                    <Badge variant="outline">
                      {bundle.bundle_type === 'fixed' ? t('admin.promotions.bundleFormDialog.vaste_bundel') : t('admin.promotions.bundleFormDialog.mix_match')}
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
                    <DropdownMenuItem onClick={() => setEditBundle(bundle)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(bundle.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {bundle.description || 'Geen beschrijving'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.bundles.korting')}</span>
                    <span className="font-medium">
                      {bundle.discount_type === 'percentage'
                        ? `${bundle.discount_value}%`
                        : bundle.discount_type === 'fixed_amount'
                        ? `€${bundle.discount_value?.toFixed(2)}`
                        : `€${bundle.discount_value?.toFixed(2)} vaste prijs`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.bundles.producten')}</span>
                    <span>{bundle.products?.length || 0} items</span>
                  </div>
                  {bundle.valid_until && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.bundles.geldig_tot')}</span>
                      <span>
                        {format(new Date(bundle.valid_until), 'd MMM yyyy', {
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{t('admin.marketing.aBTestingPanel.actief')}</span>
                  <Switch
                    checked={bundle.is_active}
                    onCheckedChange={() => handleToggleActive(bundle)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BundleFormDialog
        open={showCreate || !!editBundle}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditBundle(null);
          }
        }}
        bundle={editBundle}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.bundles.bundel_verwijderen')}</AlertDialogTitle>
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
