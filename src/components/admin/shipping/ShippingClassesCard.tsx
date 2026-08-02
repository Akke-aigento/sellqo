import { useState } from "react";
import { Plus, Pencil, Trash2, Layers, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/PermissionGate";
import { useShippingClasses } from "@/hooks/useShippingClasses";
import { ShippingClassDialog } from "./ShippingClassDialog";
import { ShippingClassProductsDialog } from "./ShippingClassProductsDialog";
import type { ShippingClassWithCounts } from "@/types/shipping";

/**
 * SHIP-CLASS-2 — beheer van verzendklassen boven de verzendmethodes.
 */
export function ShippingClassesCard() {
  const {
    shippingClasses,
    isLoading,
    createShippingClass,
    updateShippingClass,
    deleteShippingClass,
    isSaving,
  } = useShippingClasses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingClassWithCounts | null>(null);
  const [productsFor, setProductsFor] = useState<ShippingClassWithCounts | null>(
    null,
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Verzendklassen
          </CardTitle>
          <CardDescription>
            Groepeer producten die een eigen leveringsmethode nodig hebben.
          </CardDescription>
        </div>
        <PermissionGate action="write" resource="settings_general">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Verzendklasse toevoegen
          </Button>
        </PermissionGate>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : shippingClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nog geen verzendklassen. Zonder klassen geldt elke verzendmethode
            voor alle producten.
          </p>
        ) : (
          <div className="space-y-2">
            {shippingClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{cls.name}</p>
                  {cls.description && (
                    <p className="text-sm text-muted-foreground">
                      {cls.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-xs">
                      {cls.product_count} product(en)
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {cls.method_count} verzendmethode(s)
                    </Badge>
                  </div>
                </div>
                <PermissionGate action="write" resource="settings_general">
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProductsFor(cls)}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Producten koppelen
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(cls);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteShippingClass(cls.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </PermissionGate>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ShippingClassDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shippingClass={editing}
        isSubmitting={isSaving}
        onSubmit={async (data) =>
          editing
            ? updateShippingClass({ id: editing.id, data })
            : createShippingClass(data)
        }
      />

      <ShippingClassProductsDialog
        open={!!productsFor}
        onOpenChange={(o) => !o && setProductsFor(null)}
        shippingClassId={productsFor?.id ?? null}
        shippingClassName={productsFor?.name}
      />
    </Card>
  );
}