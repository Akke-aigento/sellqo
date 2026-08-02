import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type {
  ShippingClassFormData,
  ShippingClassWithCounts,
} from "@/types/shipping";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shippingClass?: ShippingClassWithCounts | null;
  onSubmit: (data: ShippingClassFormData) => Promise<unknown>;
  isSubmitting?: boolean;
}

export function ShippingClassDialog({
  open,
  onOpenChange,
  shippingClass,
  onSubmit,
  isSubmitting,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName(shippingClass?.name ?? "");
    setDescription(shippingClass?.description ?? "");
    setSortOrder(shippingClass?.sort_order ?? 0);
  }, [open, shippingClass]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit({ name, description, sort_order: sortOrder });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shippingClass ? "Verzendklasse bewerken" : "Nieuwe verzendklasse"}
          </DialogTitle>
          <DialogDescription>
            Een verzendklasse groepeert producten die dezelfde levering nodig
            hebben, bijvoorbeeld "boxspring" voor vrachtwagenlevering.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Naam</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. boxspring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Waarvoor gebruik je deze klasse?"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sorteervolgorde</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
            {isSubmitting
              ? "Opslaan..."
              : shippingClass
                ? "Bijwerken"
                : "Toevoegen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}