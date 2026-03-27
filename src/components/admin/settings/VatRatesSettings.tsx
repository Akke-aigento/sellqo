import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Check, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useVatRates } from "@/hooks/useVatRates";
import { useTenant } from "@/hooks/useTenant";
import { useIsMobile } from "@/hooks/use-mobile";
import { VatRateDialog } from "@/components/admin/VatRateDialog";
import type { VatRate, VatRateFormData } from "@/types/vatRate";

const COUNTRIES = [
  { code: "BE", name: "België" },
  { code: "NL", name: "Nederland" },
  { code: "DE", name: "Duitsland" },
  { code: "FR", name: "Frankrijk" },
];

export function VatRatesSettings() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const isMobile = useIsMobile();
  const [selectedCountry, setSelectedCountry] = useState<string>(
    currentTenant?.country || "BE"
  );
  
  const {
    vatRates,
    isLoading,
    createVatRate,
    updateVatRate,
    deleteVatRate,
    isCreating,
    isUpdating,
  } = useVatRates(selectedCountry);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<VatRate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rateToDelete, setRateToDelete] = useState<VatRate | null>(null);

  const handleCreate = () => {
    setEditingRate(null);
    setDialogOpen(true);
  };

  const handleEdit = (rate: VatRate) => {
    setEditingRate(rate);
    setDialogOpen(true);
  };

  const handleDelete = (rate: VatRate) => {
    // Don't allow deleting global rates (tenant_id is null)
    if (!rate.tenant_id) {
      return;
    }
    setRateToDelete(rate);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (rateToDelete) {
      await deleteVatRate(rateToDelete.id);
      setDeleteDialogOpen(false);
      setRateToDelete(null);
    }
  };

  const handleSubmit = async (data: VatRateFormData) => {
    if (editingRate) {
      await updateVatRate({ id: editingRate.id, data });
    } else {
      await createVatRate({ ...data, country_code: selectedCountry });
    }
  };

  const getLocalizedName = (rate: VatRate): string => {
    const lang = i18n.language;
    switch (lang) {
      case "nl":
        return rate.name_nl || rate.name_en || "";
      case "en":
        return rate.name_en || rate.name_nl || "";
      case "de":
        return rate.name_de || rate.name_en || "";
      case "fr":
        return rate.name_fr || rate.name_en || "";
      default:
        return rate.name_en || rate.name_nl || "";
    }
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      standard: "default",
      reduced: "secondary",
      super_reduced: "secondary",
      zero: "outline",
      exempt: "outline",
    };
    return (
      <Badge variant={variants[category] || "secondary"}>
        {t(`vat_rates.${category}`)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <CardTitle>{t("vat_rates.title")}</CardTitle>
            <CardDescription>
              {t("vat_rates.description", "Beheer BTW-tarieven per land voor correcte facturatie")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="flex-1 sm:w-[180px]">
                <SelectValue placeholder={t("vat_rates.country")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} size="sm" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              {t("vat_rates.add")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : vatRates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              {t("vat_rates.no_rates", "Geen BTW-tarieven gevonden voor dit land")}
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("vat_rates.add")}
            </Button>
          </div>
        ) : isMobile ? (
          /* Mobile: Card-based list */
          <div className="space-y-3">
            {vatRates.map((rate) => (
              <div key={rate.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{getLocalizedName(rate)}</p>
                    {!rate.tenant_id && (
                      <Badge variant="outline" className="text-xs">Standaard</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold">{rate.rate}%</span>
                    {getCategoryBadge(rate.category)}
                    {rate.is_default && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
                {rate.tenant_id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(rate)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(rate)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Table */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("vat_rates.rate")}</TableHead>
                <TableHead>{t("vat_rates.category")}</TableHead>
                <TableHead>{t("vat_rates.is_default")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vatRates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">
                    {getLocalizedName(rate)}
                    {!rate.tenant_id && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Standaard
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{rate.rate}%</TableCell>
                  <TableCell>{getCategoryBadge(rate.category)}</TableCell>
                  <TableCell>
                    {rate.is_default && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </TableCell>
                  <TableCell>
                    {rate.tenant_id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(rate)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(rate)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <VatRateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vatRate={editingRate}
        countryCode={selectedCountry}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vat_rates.delete_title", "BTW-tarief verwijderen?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vat_rates.delete_description", "Weet je zeker dat je dit BTW-tarief wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
