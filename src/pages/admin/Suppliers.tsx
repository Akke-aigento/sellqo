import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSuppliers, useSupplierMutations, useSupplierStats } from "@/hooks/useSuppliers";
import { useProductSuppliers } from "@/hooks/useProductSuppliers";
import { SupplierFormDialog } from "@/components/admin/suppliers/SupplierFormDialog";
import { SupplierCard } from "@/components/admin/suppliers/SupplierCard";
import { StatsCard } from "@/components/admin/StatsCard";
import type { Supplier } from "@/types/supplier";
import {
  Plus,
  Search,
  Building2,
  CheckCircle,
  FileText,
  ShoppingCart,
} from "lucide-react";

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useSuppliers({
    search: search || undefined,
    isActive: activeFilter === "all" ? undefined : activeFilter === "active",
  });

  const { data: stats } = useSupplierStats();
  const { data: productSuppliers } = useProductSuppliers();
  const { deleteSupplier } = useSupplierMutations();

  // Count products per supplier
  const productCountBySupplier = productSuppliers?.reduce((acc, ps) => {
    acc[ps.supplier_id] = (acc[ps.supplier_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (supplierToDelete) {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  const handleNewSupplier = () => {
    setSelectedSupplier(null);
    setFormDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Leveranciers</h1>
            <p className="text-muted-foreground">
              Beheer je leveranciers en inkoopprijzen
            </p>
          </div>
          <Button onClick={handleNewSupplier}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe leverancier
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Totaal leveranciers"
            value={stats?.totalSuppliers || 0}
            icon={Building2}
          />
          <StatsCard
            title="Actieve leveranciers"
            value={stats?.activeSuppliers || 0}
            icon={CheckCircle}
          />
          <StatsCard
            title="Openstaande facturen"
            value={`€${(stats?.openInvoicesTotal || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
            description={`${stats?.openInvoicesCount || 0} facturen`}
            icon={FileText}
          />
          <StatsCard
            title="Lopende bestellingen"
            value={stats?.pendingOrders || 0}
            icon={ShoppingCart}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op naam, email of contactpersoon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter op status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle leveranciers</SelectItem>
                  <SelectItem value="active">Alleen actief</SelectItem>
                  <SelectItem value="inactive">Alleen inactief</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-10 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={handleEdit}
                onDelete={handleDelete}
                productCount={productCountBySupplier[supplier.id] || 0}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-1">Geen leveranciers gevonden</h3>
              <p className="text-muted-foreground text-center mb-4">
                {search
                  ? "Probeer een andere zoekopdracht"
                  : "Voeg je eerste leverancier toe om te beginnen"}
              </p>
              {!search && (
                <Button onClick={handleNewSupplier}>
                  <Plus className="h-4 w-4 mr-2" />
                  Eerste leverancier toevoegen
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Dialog */}
      <SupplierFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        supplier={selectedSupplier}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leverancier verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{supplierToDelete?.name}" wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
