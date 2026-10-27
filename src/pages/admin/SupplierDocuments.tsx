import { Capacitor } from "@capacitor/core";
import { useState } from "react";
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
  getSupplierDocumentSignedUrl,
} from "@/hooks/useSupplierDocuments";
import { openExternal } from "@/lib/openExternal";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useTenant } from "@/hooks/useTenant";
import { useTenantOdooSettings } from "@/hooks/useTenantOdooSettings";
import { invoiceInboxAddress } from "@/lib/invoiceInbox";
import { SupplierDocumentUploadDialog } from "@/components/admin/suppliers/SupplierDocumentUploadDialog";
import { MoveSupplierDocumentDialog } from "@/components/admin/suppliers/MoveSupplierDocumentDialog";
import { useMoveTargets } from "@/hooks/useMoveTargets";
import { SupplierDocumentSettingsDialog } from "@/components/admin/suppliers/SupplierDocumentSettingsDialog";
import { useCanManageInbox, useInboxReview, useSupplierInbox, type InboxDecision } from "@/hooks/useSupplierInbox";
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
  Copy,
  Inbox,
  ArrowRightLeft,
  ArrowLeft,
  Settings,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Check,
  X,
} from "lucide-react";

export default function SupplierDocuments() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { settings: odooSettings } = useTenantOdooSettings(currentTenant?.id);
  const inboxAddress = currentTenant?.inbound_email_prefix ? invoiceInboxAddress(currentTenant.inbound_email_prefix) : null;
  const copyInbox = async () => {
    if (!inboxAddress) return;
    try {
      await navigator.clipboard.writeText(inboxAddress);
      toast.success(t("admin.supplierDocuments.inbox_copied"));
    } catch {
      toast.error(inboxAddress);
    }
  };
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SupplierDocument | null>(null);
  // INKOOP-5: naar een andere winkel verplaatsen (enkel als je er meer dan één beheert).
  const [documentToMove, setDocumentToMove] = useState<SupplierDocument | null>(null);
  const moveTargets = useMoveTargets();
  // INKOOP-6: instellingen + mail van onbekende afzenders controleren.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const { pendingCount } = useSupplierInbox(currentTenant?.id);
  const review = useInboxReview();
  const canManageInbox = useCanManageInbox(currentTenant?.id);
  const decide = (doc: SupplierDocument, decision: InboxDecision) =>
    review.mutate({ documentId: doc.id, decision }, {
      onSuccess: ({ count }) => toast.success(t(`admin.supplierDocuments.review_done_${decision}`, { count })),
    });

  const { data: documents, isLoading } = useSupplierDocuments({
    documentType:
      typeFilter === "all" ? undefined : (typeFilter as SupplierDocumentType),
    paymentStatus:
      statusFilter === "all" ? undefined : (statusFilter as SupplierPaymentStatus),
    supplierId: supplierFilter === "all" ? undefined : supplierFilter,
    reviewPending: reviewOnly || undefined,
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

  const handleOpen = async (doc: SupplierDocument) => {
    // Web: open het venster synchroon in de klik, anders blokkeert Safari de popup na de await.
    const pending = Capacitor.isNativePlatform() ? null : window.open('', '_blank');
    try {
      // Privé-bucket: elke keer een verse signed URL (5 min geldig).
      const url = await getSupplierDocumentSignedUrl(doc);
      if (pending) pending.location.href = url;
      else await openExternal(url);
    } catch {
      pending?.close();
      toast.error(t("admin.supplierDocuments.openen_mislukt"));
    }
  };

  const handleMarkAsPaid = async (doc: SupplierDocument) => {
    await markAsPaid.mutateAsync({ id: doc.id });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <Button variant="ghost" size="sm" className="-ml-2 -mb-4" asChild>
          <Link to="/admin/suppliers">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.supplierDocuments.back_to_suppliers")}
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Leveranciersdocumenten</h1>
            <p className="text-muted-foreground">
              Facturen, offertes en andere documenten van leveranciers
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              {t("admin.supplierDocuments.settings_button")}
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Document uploaden
            </Button>
          </div>
        </div>

        {/* INKOOP-6: mail van onbekende afzenders wacht op goedkeuring */}
        {(pendingCount.data ?? 0) > 0 && (
          <Card className="border-amber-500/60">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <ShieldAlert className="h-8 w-8 text-amber-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("admin.supplierDocuments.review_banner", { count: pendingCount.data })}</p>
                <p className="text-xs text-muted-foreground">{t("admin.supplierDocuments.review_banner_desc")}</p>
              </div>
              <Button variant={reviewOnly ? "default" : "outline"} size="sm" onClick={() => setReviewOnly((v) => !v)}>
                {reviewOnly ? t("admin.supplierDocuments.review_show_all") : t("admin.supplierDocuments.review_show")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* INKOOP-4: facturenadres van deze winkel */}
        {inboxAddress && (
          <Card>
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <Inbox className="h-8 w-8 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("admin.supplierDocuments.inbox_title")}</p>
                <p className="font-mono text-sm break-all">{inboxAddress}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.supplierDocuments.inbox_desc")}
                  {odooSettings?.push_supplier_documents ? ` ${t("admin.supplierDocuments.inbox_odoo")}` : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={copyInbox}>
                <Copy className="h-4 w-4 mr-2" />
                {t("admin.supplierDocuments.inbox_copy")}
              </Button>
            </CardContent>
          </Card>
        )}

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
                              {doc.source && doc.source !== "upload" && (
                                <> · {t(`admin.supplierDocuments.source.${doc.source}`)}</>
                              )}
                              {doc.sender_email && <> · {doc.sender_email}</>}
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
                        {/* SUPPLIER-404-1: geen leveranciersdetailpagina. */}
                        {doc.supplier?.name ?? (
                          <Badge variant="secondary">{t("admin.supplierDocuments.to_process")}</Badge>
                        )}
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
                        <div className="flex flex-wrap gap-1">
                          {doc.review_status && (
                            <Badge variant={doc.review_status === "pending" ? "secondary" : "destructive"}>
                              {t(`admin.supplierDocuments.review_${doc.review_status}`)}
                            </Badge>
                          )}
                          {doc.review_status === "pending" && doc.sender_authenticated === false && (
                            <Badge variant="destructive" title={t("admin.supplierDocuments.unverified_help")}>
                              {t("admin.supplierDocuments.unverified")}
                            </Badge>
                          )}
                          {doc.document_type === "invoice" && (
                            <Badge className={paymentStatusInfo[doc.payment_status].color}>
                              {paymentStatusInfo[doc.payment_status].label}
                            </Badge>
                          )}
                          {doc.odoo_status && (
                            <Badge
                              variant={doc.odoo_status === "error" ? "destructive" : "outline"}
                              title={doc.odoo_error ?? undefined}
                            >
                              {t(`admin.supplierDocuments.odoo.${doc.odoo_status}`)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpen(doc)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Openen
                            </DropdownMenuItem>
                            {doc.review_status === "pending" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={review.isPending} onClick={() => decide(doc, "approve")}>
                                  <Check className="h-4 w-4 mr-2" />
                                  {t("admin.supplierDocuments.review_approve")}
                                </DropdownMenuItem>
                                {doc.sender_email && canManageInbox && doc.sender_authenticated === true && (
                                  <DropdownMenuItem disabled={review.isPending} onClick={() => decide(doc, "approve_sender")}>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    {t("admin.supplierDocuments.review_approve_sender")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem disabled={review.isPending} onClick={() => decide(doc, "reject")}>
                                  <X className="h-4 w-4 mr-2" />
                                  {t("admin.supplierDocuments.review_reject")}
                                </DropdownMenuItem>
                                {doc.sender_email && canManageInbox && (
                                  <DropdownMenuItem disabled={review.isPending} className="text-destructive" onClick={() => decide(doc, "block_sender")}>
                                    <ShieldX className="h-4 w-4 mr-2" />
                                    {t("admin.supplierDocuments.review_block_sender")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {typeof doc.extracted_data?.odoo_url === "string" &&
                              doc.extracted_data.odoo_url.startsWith("https://") && (
                              <DropdownMenuItem onClick={() => void openExternal(doc.extracted_data.odoo_url as string)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {t("admin.supplierDocuments.open_in_odoo")}
                              </DropdownMenuItem>
                            )}
                            {doc.document_type === "invoice" &&
                              doc.payment_status !== "paid" && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsPaid(doc)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Markeer als betaald
                                </DropdownMenuItem>
                              )}
                            {moveTargets.length > 0 && (
                              <DropdownMenuItem onClick={() => setDocumentToMove(doc)}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                {t("admin.supplierDocuments.move_menu")}
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
          </CardContent>
        </Card>
      </div>

      <SupplierDocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tenantId={currentTenant?.id}
        inboxAddress={inboxAddress}
      />

      {/* Upload Dialog */}
      <SupplierDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <MoveSupplierDocumentDialog
        document={documentToMove}
        onOpenChange={(open) => { if (!open) setDocumentToMove(null); }}
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
