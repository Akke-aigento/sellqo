import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { useShippingClassProducts } from "@/hooks/useShippingClasses";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shippingClassId: string | null;
  shippingClassName?: string;
}

/**
 * SHIP-CLASS-2 — producten koppelen aan een verzendklasse.
 */
export function ShippingClassProductsDialog({
  open,
  onOpenChange,
  shippingClassId,
  shippingClassName,
}: Props) {
  const { products, isLoading, saveSelection, isSaving } =
    useShippingClassProducts(shippingClassId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(
        products
          .filter((p) => p.shipping_class_id === shippingClassId)
          .map((p) => p.id),
      ),
    );
  }, [open, products, shippingClassId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    await saveSelection(Array.from(selected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Producten koppelen</DialogTitle>
          <DialogDescription>
            Kies welke producten onder de verzendklasse
            {shippingClassName ? ` "${shippingClassName}"` : ""} vallen.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op naam of SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {selected.size} product(en) geselecteerd
        </p>

        <ScrollArea className="h-[320px] rounded-md border">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Geen producten gevonden.
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => {
                const otherClass =
                  p.shipping_class_id && p.shipping_class_id !== shippingClassId;
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.sku && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.sku}
                        </p>
                      )}
                    </div>
                    {otherClass && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Andere klasse
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !shippingClassId}>
            {isSaving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}