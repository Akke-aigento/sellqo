import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Search, Tag } from 'lucide-react';
import { DiscountCodeCard } from '@/components/admin/DiscountCodeCard';
import { DiscountCodeDialog } from '@/components/admin/DiscountCodeDialog';
import {
  useDiscountCodes,
  useCreateDiscountCode,
  useUpdateDiscountCode,
  useDeleteDiscountCode,
} from '@/hooks/useDiscountCodes';
import type { DiscountCode, DiscountCodeFormData } from '@/types/discount';

type StatusFilter = 'all' | 'active' | 'inactive' | 'expired';

export default function Discounts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: discountCodes = [], isLoading } = useDiscountCodes({
    search: search || undefined,
    status: statusFilter,
  });

  const createMutation = useCreateDiscountCode();
  const updateMutation = useUpdateDiscountCode();
  const deleteMutation = useDeleteDiscountCode();

  const handleOpenCreate = () => {
    setEditingCode(null);
    setDialogOpen(true);
  };

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setDialogOpen(true);
  };

  const handleSave = (data: DiscountCodeFormData) => {
    if (editingCode) {
      updateMutation.mutate(
        { id: editingCode.id, formData: data },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(data, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kortingscodes</h1>
          <p className="text-muted-foreground">
            Beheer kortingscodes voor je klanten
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe code
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoeken op code of beschrijving..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="inactive">Inactief</SelectItem>
            <SelectItem value="expired">Verlopen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Laden...
        </div>
      ) : discountCodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Tag className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-1">Geen kortingscodes</h3>
          <p className="text-muted-foreground mb-4">
            {search || statusFilter !== 'all'
              ? 'Geen codes gevonden met deze filters'
              : 'Maak je eerste kortingscode aan'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe code
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {discountCodes.map((code) => (
            <DiscountCodeCard
              key={code.id}
              discountCode={code}
              onEdit={handleEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <DiscountCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        discountCode={editingCode}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kortingscode verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze kortingscode wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
