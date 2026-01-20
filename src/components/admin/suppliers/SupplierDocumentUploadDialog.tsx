import { useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupplierDocumentMutations } from "@/hooks/useSupplierDocuments";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import type { SupplierDocumentFormData, SupplierDocumentType } from "@/types/supplier";
import { documentTypeInfo } from "@/types/supplier";
import { Upload, File, X } from "lucide-react";

interface SupplierDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSupplierId?: string;
  defaultPurchaseOrderId?: string;
}

export function SupplierDocumentUploadDialog({
  open,
  onOpenChange,
  defaultSupplierId,
  defaultPurchaseOrderId,
}: SupplierDocumentUploadDialogProps) {
  const { uploadDocument } = useSupplierDocumentMutations();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const { data: purchaseOrders } = usePurchaseOrders();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierDocumentFormData>({
    defaultValues: {
      supplier_id: defaultSupplierId || "",
      purchase_order_id: defaultPurchaseOrderId,
      document_type: "invoice",
      document_number: "",
      document_date: new Date().toISOString().split("T")[0],
      amount: undefined,
      tax_amount: undefined,
      total_amount: undefined,
      due_date: "",
      notes: "",
    },
  });

  const selectedSupplierId = watch("supplier_id");
  const documentType = watch("document_type");

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const onSubmit = async (data: SupplierDocumentFormData) => {
    if (!selectedFile) return;

    try {
      await uploadDocument.mutateAsync({ file: selectedFile, data });
      reset();
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const filteredPurchaseOrders = purchaseOrders?.filter(
    (po) => po.supplier_id === selectedSupplierId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Document uploaden</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* File upload area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <File className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Sleep een bestand hierheen of
                </p>
                <label className="cursor-pointer">
                  <span className="text-primary hover:underline">
                    klik om te selecteren
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                </label>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Leverancier *</Label>
              <Select
                value={selectedSupplierId}
                onValueChange={(value) => setValue("supplier_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type document *</Label>
              <Select
                value={documentType}
                onValueChange={(value) =>
                  setValue("document_type", value as SupplierDocumentType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(documentTypeInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document_number">Documentnummer</Label>
              <Input
                id="document_number"
                {...register("document_number")}
                placeholder="F2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_date">Documentdatum</Label>
              <Input
                id="document_date"
                type="date"
                {...register("document_date")}
              />
            </div>
          </div>

          {selectedSupplierId && filteredPurchaseOrders && filteredPurchaseOrders.length > 0 && (
            <div className="space-y-2">
              <Label>Koppelen aan inkooporder</Label>
              <Select
                value={watch("purchase_order_id") || ""}
                onValueChange={(value) =>
                  setValue("purchase_order_id", value || undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Geen koppeling" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Geen koppeling</SelectItem>
                  {filteredPurchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(documentType === "invoice" || documentType === "credit_note") && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Bedrag excl. BTW</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register("amount", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_amount">BTW</Label>
                  <Input
                    id="tax_amount"
                    type="number"
                    step="0.01"
                    {...register("tax_amount", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_amount">Totaal</Label>
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    {...register("total_amount", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Vervaldatum</Label>
                <Input id="due_date" type="date" {...register("due_date")} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Optionele notities..."
              rows={2}
            />
          </div>

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
              disabled={!selectedFile || !selectedSupplierId || uploadDocument.isPending}
            >
              Uploaden
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
