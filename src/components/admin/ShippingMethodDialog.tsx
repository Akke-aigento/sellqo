import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Package } from "lucide-react";
import { useShippingClasses } from "@/hooks/useShippingClasses";
import { ShippingClassProductsDialog } from "@/components/admin/shipping/ShippingClassProductsDialog";
import type { ShippingMethod } from "@/types/shipping";
import {
  ALL_SHIPPING_COUNTRIES,
  REGION_PRESETS,
  summarizeCountries,
} from "@/lib/shippingRegions";

const NO_CLASS = "__none__";

const formSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Prijs moet 0 of hoger zijn"),
  free_above: z.coerce.number().nullable().optional(),
  estimated_days_min: z.coerce.number().min(1).optional(),
  estimated_days_max: z.coerce.number().min(1).optional(),
  is_active: z.boolean(),
  is_default: z.boolean(),
  shipping_class_id: z.string().optional().nullable(),
  countries: z.array(z.string()).optional().nullable(),
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
      shipping_class_id: null,
      countries: [],
    },
  });

  const { shippingClasses } = useShippingClasses();
  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const selectedClassId = form.watch("shipping_class_id");
  const selectedClass = shippingClasses.find((c) => c.id === selectedClassId);

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
        shipping_class_id: method.shipping_class_id || null,
        countries: method.countries ?? [],
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
        shipping_class_id: null,
        countries: [],
      });
    }
  }, [method, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {method ? "Verzendmethode bewerken" : "Nieuwe verzendmethode"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                name="countries"
                render={({ field }) => {
                  const selected: string[] = field.value ?? [];
                  const toggle = (code: string) =>
                    field.onChange(
                      selected.includes(code)
                        ? selected.filter((c) => c !== code)
                        : [...selected, code],
                    );
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> Verzendlanden
                      </FormLabel>
                      <FormDescription>
                        Kies naar welke landen deze methode geldt. Niets aanvinken =
                        alle landen. Klanten zien in de checkout enkel landen waar
                        een verzendmethode voor bestaat.
                      </FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {REGION_PRESETS.map((preset) => (
                          <Button
                            key={preset.key}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              field.onChange([
                                ...new Set([...selected, ...preset.codes]),
                              ])
                            }
                          >
                            + {preset.label}
                          </Button>
                        ))}
                        {selected.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => field.onChange([])}
                          >
                            Wissen
                          </Button>
                        )}
                      </div>
                      <Badge variant="secondary" className="w-fit">
                        {summarizeCountries(selected)}
                      </Badge>
                      <Input
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                        placeholder="Zoek land (bv. Oekraïne of UA)"
                      />
                      <div className="max-h-44 space-y-1 overflow-y-auto overscroll-contain rounded-md border p-2">
                        {ALL_SHIPPING_COUNTRIES.filter((c) => {
                          const q = countryQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.code.toLowerCase().includes(q)
                          );
                        }).map((c) => (
                          <label
                            key={c.code}
                            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={selected.includes(c.code)}
                              onCheckedChange={() => toggle(c.code)}
                            />
                            <span>{c.name}</span>
                            <span className="text-muted-foreground">{c.code}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="shipping_class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verzendklasse</FormLabel>
                    <Select
                      value={field.value ?? NO_CLASS}
                      onValueChange={(v) =>
                        field.onChange(v === NO_CLASS ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Kies een verzendklasse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CLASS}>
                          Geen (geldt voor alle producten)
                        </SelectItem>
                        {shippingClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name} ({cls.product_count} product(en))
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Kies "Geen" als deze methode voor alle producten geldt. Met
                      een klasse is deze methode alleen beschikbaar wanneer er
                      een product uit die klasse in de winkelwagen zit.
                    </FormDescription>
                    {selectedClassId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProductsDialogOpen(true)}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Producten koppelen
                      </Button>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
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

        <ShippingClassProductsDialog
          open={productsDialogOpen}
          onOpenChange={setProductsDialogOpen}
          shippingClassId={selectedClassId ?? null}
          shippingClassName={selectedClass?.name}
        />
      </DialogContent>
    </Dialog>
  );
}
