import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ShippingMethod } from "@/types/shipping";

const formSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Prijs moet 0 of hoger zijn"),
  free_above: z.coerce.number().nullable().optional(),
  estimated_days_min: z.coerce.number().min(1).optional(),
  estimated_days_max: z.coerce.number().min(1).optional(),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface ShippingMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?: ShippingMethod | null;
  onSubmit: (data: FormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function ShippingMethodDialog({
  open,
  onOpenChange,
  method,
  onSubmit,
  isSubmitting,
}: ShippingMethodDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      free_above: null,
      estimated_days_min: 1,
      estimated_days_max: 3,
      is_active: true,
      is_default: false,
    },
  });

  useEffect(() => {
    if (method) {
      form.reset({
        name: method.name,
        description: method.description || "",
        price: method.price,
        free_above: method.free_above,
        estimated_days_min: method.estimated_days_min || 1,
        estimated_days_max: method.estimated_days_max || 3,
        is_active: method.is_active,
        is_default: method.is_default,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        price: 0,
        free_above: null,
        estimated_days_min: 1,
        estimated_days_max: 3,
        is_active: true,
        is_default: false,
      });
    }
  }, [method, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {method ? "Verzendmethode bewerken" : "Nieuwe verzendmethode"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input placeholder="Standaard verzending" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschrijf de verzendmethode..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prijs (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="free_above"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gratis boven (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Optioneel"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Laat leeg voor geen gratis verzending
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimated_days_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. dagen</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_days_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. dagen</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Actief</FormLabel>
                      <FormDescription>
                        Toon deze verzendmethode aan klanten
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Standaard</FormLabel>
                      <FormDescription>
                        Gebruik als standaard verzendmethode
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Opslaan..." : method ? "Bijwerken" : "Toevoegen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
