import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Users, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { useCustomerGroups, useDeleteCustomerGroup, useUpdateCustomerGroup } from '@/hooks/useCustomerGroups';
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
import { CustomerGroupFormDialog } from '@/components/admin/promotions/CustomerGroupFormDialog';
import type { CustomerGroup } from '@/types/promotions';
import { useTranslation } from 'react-i18next';

export default function CustomerGroups() {
  const { t } = useTranslation();
  const { data: groups = [], isLoading } = useCustomerGroups();
  const deleteGroup = useDeleteCustomerGroup();
  const updateGroup = useUpdateCustomerGroup();
  const [editGroup, setEditGroup] = useState<CustomerGroup | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = (group: CustomerGroup) => {
    updateGroup.mutate({
      id: group.id,
      formData: { is_active: !group.is_active },
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteGroup.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.customerGroups.klantengroepen')}</h1>
          <p className="text-muted-foreground">
            {t('admin.customerGroups.speciale_prijzen_en_kortingen_voor_klantgroepen')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.customerGroups.nieuwe_groep')}
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
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('admin.customerGroups.geen_klantengroepen')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('admin.customerGroups.maak_je_eerste_klantengroep_aan')}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('admin.customerGroups.groep_aanmaken')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant={group.is_active ? 'default' : 'secondary'}>
                      {group.is_active ? t('admin.marketing.aBTestingPanel.actief') : t('admin.products.inactief')}
                    </Badge>
                    <Badge variant="outline">{group.code}</Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditGroup(group)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(group.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {group.description || 'Geen beschrijving'}
                </p>
                <div className="space-y-2 text-sm">
                  {group.discount_value && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.customerGroups.standaard_korting')}</span>
                      <span className="font-medium">
                        {group.discount_type === 'percentage'
                          ? `${group.discount_value}%`
                          : `€${group.discount_value.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  {group.min_order_amount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('admin.customerGroups.min_bestelling')}</span>
                      <span>€{group.min_order_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.customerGroups.btw_vrijgesteld')}</span>
                    <span>{group.tax_exempt ? 'Ja' : 'Nee'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('admin.customerGroups.prioriteit')}</span>
                    <span>{group.priority}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{t('admin.marketing.aBTestingPanel.actief')}</span>
                  <Switch
                    checked={group.is_active}
                    onCheckedChange={() => handleToggleActive(group)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerGroupFormDialog
        open={showCreate || !!editGroup}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditGroup(null);
          }
        }}
        group={editGroup}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.customerGroups.klantengroep_verwijderen')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.customerGroups.deze_actie_kan_niet_ongedaan_worden')}
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
