import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VatRate, VatRateFormData, VatCategory } from "@/types/vatRate";

const formSchema = z.object({
  country_code: z.string().min(2, "Land is verplicht"),
  rate: z.coerce.number().min(0, "Tarief moet 0 of hoger zijn").max(100, "Tarief mag niet hoger zijn dan 100"),
  category: z.enum(["standard", "reduced", "super_reduced", "zero", "exempt"]),
  name_nl: z.string().min(1, "Nederlandse naam is verplicht"),
  name_en: z.string().min(1, "Engelse naam is verplicht"),
  name_fr: z.string().optional().default(""),
  name_de: z.string().optional().default(""),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface VatRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vatRate?: VatRate | null;
  countryCode: string;
  onSubmit: (data: VatRateFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const CATEGORIES: { value: VatCategory; labelKey: string }[] = [
  { value: "standard", labelKey: "vat_rates.standard" },
  { value: "reduced", labelKey: "vat_rates.reduced" },
  { value: "super_reduced", labelKey: "vat_rates.super_reduced" },
  { value: "zero", labelKey: "vat_rates.zero" },
  { value: "exempt", labelKey: "vat_rates.exempt" },
];

export function VatRateDialog({
  open,
  onOpenChange,
  vatRate,
  countryCode,
  onSubmit,
  isSubmitting,
}: VatRateDialogProps) {
  const { t } = useTranslation();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      country_code: countryCode,
      rate: 21,
      category: "standard",
      name_nl: "",
      name_en: "",
      name_fr: "",
      name_de: "",
      is_default: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (vatRate) {
      form.reset({
        country_code: vatRate.country_code,
        rate: vatRate.rate,
        category: vatRate.category,
        name_nl: vatRate.name_nl || "",
        name_en: vatRate.name_en || "",
        name_fr: vatRate.name_fr || "",
        name_de: vatRate.name_de || "",
        is_default: vatRate.is_default,
        is_active: vatRate.is_active,
      });
    } else {
      form.reset({
        country_code: countryCode,
        rate: 21,
        category: "standard",
        name_nl: "",
        name_en: "",
        name_fr: "",
        name_de: "",
        is_default: false,
        is_active: true,
      });
    }
  }, [vatRate, countryCode, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data as VatRateFormData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {vatRate ? t("vat_rates.edit", "BTW-tarief bewerken") : t("vat_rates.add_new", "Nieuw BTW-tarief")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("vat_rates.rate")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" step="0.01" min="0" max="100" {...field} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("vat_rates.category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {t(cat.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name_nl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naam (NL)</FormLabel>
                    <FormControl>
                      <Input placeholder="bijv. Standaard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (EN)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Standard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name_fr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom (FR)</FormLabel>
                    <FormControl>
                      <Input placeholder="ex. Standard" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name_de"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (DE)</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Standard" {...field} />
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
                      <FormLabel>{t("common.status")}</FormLabel>
                      <FormDescription>
                        {t("vat_rates.active_description", "Actief tarief kan worden geselecteerd")}
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
                      <FormLabel>{t("vat_rates.is_default")}</FormLabel>
                      <FormDescription>
                        {t("vat_rates.default_description", "Automatisch toegepast bij nieuwe producten")}
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
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.loading") : vatRate ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
