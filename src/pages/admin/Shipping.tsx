import { useState } from "react";
import {
  Plus,
  Truck,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShippingMethodDialog } from "@/components/admin/ShippingMethodDialog";
import { ShippingIntegrationsSettings } from "@/components/admin/settings/ShippingIntegrationsSettings";
import { useShippingMethods } from "@/hooks/useShippingMethods";
import type { ShippingMethod, ShippingMethodFormData } from "@/types/shipping";

export default function ShippingPage() {
  const {
    shippingMethods,
    isLoading,
    createShippingMethod,
    updateShippingMethod,
    deleteShippingMethod,
    toggleActive,
    isCreating,
    isUpdating,
  } = useShippingMethods();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<ShippingMethod | null>(null);

  const handleCreate = () => {
    setEditingMethod(null);
    setDialogOpen(true);
  };

  const handleEdit = (method: ShippingMethod) => {
    setEditingMethod(method);
    setDialogOpen(true);
  };

  const handleDelete = (method: ShippingMethod) => {
    setMethodToDelete(method);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (methodToDelete) {
      await deleteShippingMethod(methodToDelete.id);
      setDeleteDialogOpen(false);
      setMethodToDelete(null);
    }
  };

  const handleSubmit = async (data: ShippingMethodFormData) => {
    if (editingMethod) {
      await updateShippingMethod({ id: editingMethod.id, data });
    } else {
      await createShippingMethod(data);
    }
  };

  const handleToggleActive = async (method: ShippingMethod) => {
    await toggleActive({ id: method.id, is_active: !method.is_active });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDeliveryTime = (min: number | null, max: number | null) => {
    if (!min && !max) return "-";
    if (min === max) return `${min} dag${min === 1 ? "" : "en"}`;
    return `${min || 1}-${max || 3} dagen`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verzending</h1>
          <p className="text-muted-foreground">
            Beheer verzendmethodes en tarieven
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Verzendmethode toevoegen
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Actieve methodes
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shippingMethods.filter((m) => m.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              van {shippingMethods.length} totaal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Standaard methode
            </CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shippingMethods.find((m) => m.is_default)?.name || "Geen"}
            </div>
            <p className="text-xs text-muted-foreground">
              Automatisch geselecteerd
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gratis verzending
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shippingMethods.filter((m) => m.free_above).length}
            </div>
            <p className="text-xs text-muted-foreground">
              methodes met gratis drempel
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verzendmethodes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : shippingMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">
                Geen verzendmethodes
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Voeg een verzendmethode toe om te beginnen.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Verzendmethode toevoegen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Prijs</TableHead>
                  <TableHead>Gratis boven</TableHead>
                  <TableHead>Levertijd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actief</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingMethods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.name}</span>
                        {method.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Standaard
                          </Badge>
                        )}
                      </div>
                      {method.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {method.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{formatPrice(method.price)}</TableCell>
                    <TableCell>
                      {method.free_above
                        ? formatPrice(method.free_above)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {formatDeliveryTime(
                        method.estimated_days_min,
                        method.estimated_days_max
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={method.is_active ? "default" : "secondary"}
                      >
                        {method.is_active ? "Actief" : "Inactief"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={method.is_active}
                        onCheckedChange={() => handleToggleActive(method)}
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
                          <DropdownMenuItem onClick={() => handleEdit(method)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(method)}
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
          )}
        </CardContent>
      </Card>

      {/* Shipping Integrations Section */}
      <ShippingIntegrationsSettings />

      <ShippingMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        method={editingMethod}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verzendmethode verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{methodToDelete?.name}" wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
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
    </div>
  );
}
