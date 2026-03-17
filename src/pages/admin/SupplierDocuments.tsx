import { useState } from "react";
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  useSupplierDocuments,
  useSupplierDocumentMutations,
  useSupplierDocumentStats,
} from "@/hooks/useSupplierDocuments";
import { useSuppliers } from "@/hooks/useSuppliers";
import { SupplierDocumentUploadDialog } from "@/components/admin/suppliers/SupplierDocumentUploadDialog";
import { StatsCard } from "@/components/admin/StatsCard";
import type { SupplierDocument, SupplierDocumentType, SupplierPaymentStatus } from "@/types/supplier";
import { documentTypeInfo, paymentStatusInfo } from "@/types/supplier";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Upload,
  FileText,
  MoreVertical,
  ExternalLink,
  Trash2,
  CreditCard,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function SupplierDocuments() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SupplierDocument | null>(null);

  const { data: documents, isLoading } = useSupplierDocuments({
    documentType:
      typeFilter === "all" ? undefined : (typeFilter as SupplierDocumentType),
    paymentStatus:
      statusFilter === "all" ? undefined : (statusFilter as SupplierPaymentStatus),
    supplierId: supplierFilter === "all" ? undefined : supplierFilter,
  });

  const { data: stats } = useSupplierDocumentStats();
  const { data: suppliers } = useSuppliers({ isActive: true });
  const { deleteDocument, markAsPaid } = useSupplierDocumentMutations();

  const handleDelete = (doc: SupplierDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (documentToDelete) {
      await deleteDocument.mutateAsync(documentToDelete.id);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleMarkAsPaid = async (doc: SupplierDocument) => {
    await markAsPaid.mutateAsync({ id: doc.id });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Leveranciersdocumenten</h1>
            <p className="text-muted-foreground">
              Facturen, offertes en andere documenten van leveranciers
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Document uploaden
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Totaal facturen"
            value={stats?.totalInvoices || 0}
            icon={FileText}
          />
          <StatsCard
            title="Openstaand"
            value={`€${(stats?.openInvoicesAmount || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
            icon={CreditCard}
          />
          <StatsCard
            title="Achterstallig"
            value={`€${(stats?.overdueAmount || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
            description={`${stats?.overdueCount || 0} facturen`}
            icon={AlertTriangle}
            className={stats?.overdueCount ? "border-destructive" : ""}
          />
          <StatsCard
            title="Betaald deze maand"
            value={`€${(stats?.paidThisMonth || 0).toLocaleString("nl-NL", {
              minimumFractionDigits: 2,
            })}`}
            icon={CheckCircle}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Type document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle types</SelectItem>
                  {Object.entries(documentTypeInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Betalingsstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  {Object.entries(paymentStatusInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Leverancier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle leveranciers</SelectItem>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {isMobile ? (
              <div className="space-y-2 p-3">
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Laden...</p>
                ) : documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border bg-card p-3 cursor-pointer active:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{doc.document_number || doc.file_name}</span>
                        {doc.document_type === "invoice" && (
                          <Badge className={paymentStatusInfo[doc.payment_status].color}>
                            {paymentStatusInfo[doc.payment_status].label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground truncate">{doc.supplier?.name}</span>
                        <Badge variant="outline" className="text-xs">{documentTypeInfo[doc.document_type].label}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">
                          {doc.document_date
                            ? format(new Date(doc.document_date), "d MMM yyyy", { locale: nl })
                            : "-"}
                        </span>
                        <span className="font-medium">
                          {doc.total_amount
                            ? `€${doc.total_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </span>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Geen documenten gevonden</p>
                  </div>
                )}
              </div>
            ) : (
            <div className="min-w-[750px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Leverancier</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Vervaldatum</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Laden...
                    </TableCell>
                  </TableRow>
                ) : documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.document_number || doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.file_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {documentTypeInfo[doc.document_type].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/suppliers/${doc.supplier_id}`}
                          className="hover:text-primary"
                        >
                          {doc.supplier?.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {doc.document_date
                          ? format(new Date(doc.document_date), "d MMM yyyy", {
                              locale: nl,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {doc.due_date
                          ? format(new Date(doc.due_date), "d MMM yyyy", {
                              locale: nl,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {doc.total_amount
                          ? `€${doc.total_amount.toLocaleString("nl-NL", {
                              minimumFractionDigits: 2,
                            })}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {doc.document_type === "invoice" && (
                          <Badge className={paymentStatusInfo[doc.payment_status].color}>
                            {paymentStatusInfo[doc.payment_status].label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Openen
                              </a>
                            </DropdownMenuItem>
                            {doc.document_type === "invoice" &&
                              doc.payment_status !== "paid" && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsPaid(doc)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Markeer als betaald
                                </DropdownMenuItem>
                              )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(doc)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-1">
                        Geen documenten gevonden
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Upload je eerste document
                      </p>
                      <Button onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Document uploaden
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <SupplierDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Document verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit document wilt verwijderen? Dit kan niet
              ongedaan worden gemaakt.
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
    </>
  );
}
