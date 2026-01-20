import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupplierMutations } from "@/hooks/useSuppliers";
import type { Supplier, SupplierFormData } from "@/types/supplier";
import { Building2, Mail, Phone, Globe, MapPin, CreditCard, User } from "lucide-react";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: SupplierFormDialogProps) {
  const { createSupplier, updateSupplier } = useSupplierMutations();
  const [activeTab, setActiveTab] = useState("general");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      website: "",
      street: "",
      city: "",
      postal_code: "",
      country: "NL",
      vat_number: "",
      chamber_of_commerce: "",
      iban: "",
      bic: "",
      payment_terms_days: 30,
      contact_person: "",
      notes: "",
      is_active: true,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        email: supplier.email || "",
        phone: supplier.phone || "",
        website: supplier.website || "",
        street: supplier.street || "",
        city: supplier.city || "",
        postal_code: supplier.postal_code || "",
        country: supplier.country || "NL",
        vat_number: supplier.vat_number || "",
        chamber_of_commerce: supplier.chamber_of_commerce || "",
        iban: supplier.iban || "",
        bic: supplier.bic || "",
        payment_terms_days: supplier.payment_terms_days || 30,
        contact_person: supplier.contact_person || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active,
      });
    } else {
      reset({
        name: "",
        email: "",
        phone: "",
        website: "",
        street: "",
        city: "",
        postal_code: "",
        country: "NL",
        vat_number: "",
        chamber_of_commerce: "",
        iban: "",
        bic: "",
        payment_terms_days: 30,
        contact_person: "",
        notes: "",
        is_active: true,
      });
    }
    setActiveTab("general");
  }, [supplier, reset, open]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      if (supplier) {
        await updateSupplier.mutateAsync({ id: supplier.id, data });
      } else {
        await createSupplier.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Leverancier bewerken" : "Nieuwe leverancier"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Algemeen</TabsTrigger>
              <TabsTrigger value="address">Adres</TabsTrigger>
              <TabsTrigger value="financial">Financieel</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Actief</Label>
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={(checked) => setValue("is_active", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    <Building2 className="inline h-4 w-4 mr-1" />
                    Bedrijfsnaam *
                  </Label>
                  <Input
                    id="name"
                    {...register("name", { required: "Naam is verplicht" })}
                    placeholder="Leverancier B.V."
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <Mail className="inline h-4 w-4 mr-1" />
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="info@leverancier.nl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-4 w-4 mr-1" />
                      Telefoon
                    </Label>
                    <Input
                      id="phone"
                      {...register("phone")}
                      placeholder="+31 20 123 4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">
                      <Globe className="inline h-4 w-4 mr-1" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      {...register("website")}
                      placeholder="https://www.leverancier.nl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_person">
                      <User className="inline h-4 w-4 mr-1" />
                      Contactpersoon
                    </Label>
                    <Input
                      id="contact_person"
                      {...register("contact_person")}
                      placeholder="Jan Jansen"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notities</Label>
                  <Textarea
                    id="notes"
                    {...register("notes")}
                    placeholder="Interne notities over deze leverancier..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="street">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Straat en huisnummer
                </Label>
                <Input
                  id="street"
                  {...register("street")}
                  placeholder="Hoofdstraat 123"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postcode</Label>
                  <Input
                    id="postal_code"
                    {...register("postal_code")}
                    placeholder="1234 AB"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Plaats</Label>
                  <Input
                    id="city"
                    {...register("city")}
                    placeholder="Amsterdam"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  {...register("country")}
                  placeholder="NL"
                />
              </div>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vat_number">
                    <CreditCard className="inline h-4 w-4 mr-1" />
                    BTW-nummer
                  </Label>
                  <Input
                    id="vat_number"
                    {...register("vat_number")}
                    placeholder="NL123456789B01"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chamber_of_commerce">KVK-nummer</Label>
                  <Input
                    id="chamber_of_commerce"
                    {...register("chamber_of_commerce")}
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    {...register("iban")}
                    placeholder="NL12ABCD0123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bic">BIC</Label>
                  <Input
                    id="bic"
                    {...register("bic")}
                    placeholder="ABCDNL2A"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms_days">Betalingstermijn (dagen)</Label>
                <Input
                  id="payment_terms_days"
                  type="number"
                  {...register("payment_terms_days", { valueAsNumber: true })}
                  placeholder="30"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={createSupplier.isPending || updateSupplier.isPending}
            >
              {supplier ? "Opslaan" : "Aanmaken"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
