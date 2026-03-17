import { useState } from 'react';
import { useIsCompact } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Plus, Search, MoreHorizontal, Edit, Trash2, Gift, ArrowLeft } from 'lucide-react';
import { useBogoPromotions, useUpdateBogoPromotion, useDeleteBogoPromotion } from '@/hooks/useBogoPromotions';
import { BogoPromotionFormDialog } from '@/components/admin/promotions/BogoPromotionFormDialog';
import type { BogoPromotion } from '@/types/promotions';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { NavLink } from 'react-router-dom';

export default function BogoPromotionsPage() {
  const { data: promotions = [], isLoading } = useBogoPromotions();
  const updatePromotion = useUpdateBogoPromotion();
  const deletePromotion = useDeleteBogoPromotion();
  const isCompact = useIsCompact();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<BogoPromotion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<BogoPromotion | null>(null);

  const filteredPromotions = promotions.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleActive = async (promotion: BogoPromotion) => {
    await updatePromotion.mutateAsync({
      id: promotion.id,
      formData: { is_active: !promotion.is_active },
    });
  };

  const handleEdit = (promotion: BogoPromotion) => {
    setEditingPromotion(promotion);
    setDialogOpen(true);
  };

  const handleDelete = (promotion: BogoPromotion) => {
    setPromotionToDelete(promotion);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (promotionToDelete) {
      await deletePromotion.mutateAsync(promotionToDelete.id);
      setDeleteDialogOpen(false);
      setPromotionToDelete(null);
    }
  };

  const getPromotionTypeLabel = (type: string) => {
    switch (type) {
      case 'buy_x_get_y':
        return 'Koop X krijg Y';
      case 'buy_x_get_y_discount':
        return 'Koop X, korting op Y';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <NavLink to="/admin/promotions">
            <ArrowLeft className="h-4 w-4" />
          </NavLink>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">BOGO Acties</h1>
          <p className="text-muted-foreground">
            Koop X krijg Y gratis of met korting
          </p>
        </div>
        <Button onClick={() => { setEditingPromotion(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe BOGO Actie
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek acties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            BOGO Acties ({filteredPromotions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {isLoading ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : filteredPromotions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Geen BOGO acties gevonden
            </p>
          ) : (
            <div className="min-w-[650px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Koop</TableHead>
                  <TableHead>Krijg</TableHead>
                  <TableHead>Korting</TableHead>
                  <TableHead className="hidden md:table-cell">Geldig tot</TableHead>
                  <TableHead>Actief</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromotions.map((promotion) => (
                  <TableRow key={promotion.id}>
                    <TableCell className="font-medium">{promotion.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getPromotionTypeLabel(promotion.promotion_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{promotion.buy_quantity}x</TableCell>
                    <TableCell>{promotion.get_quantity}x</TableCell>
                    <TableCell>
                      {promotion.discount_type === 'percentage'
                        ? `${promotion.discount_value}%`
                        : promotion.discount_value === 100
                        ? 'Gratis'
                        : `€${promotion.discount_value.toFixed(2)}`}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {promotion.valid_until
                        ? format(new Date(promotion.valid_until), 'd MMM yyyy', { locale: nl })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={promotion.is_active}
                        onCheckedChange={() => handleToggleActive(promotion)}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(promotion)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(promotion)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <BogoPromotionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promotion={editingPromotion}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>BOGO actie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{promotionToDelete?.name}" wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
