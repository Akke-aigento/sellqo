import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePurchaseOrders, usePurchaseOrderStats } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { PurchaseOrderStatusBadge } from "@/components/admin/suppliers/PurchaseOrderStatusBadge";
import { StatsCard } from "@/components/admin/StatsCard";
import type { PurchaseOrderStatus } from "@/types/supplier";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Plus,
  Search,
  Eye,
  MoreVertical,
  FileText,
  Clock,
  Truck,
  CheckCircle,
  ShoppingCart,
} from "lucide-react";

export default function PurchaseOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const { data: orders, isLoading } = usePurchaseOrders({
    search: search || undefined,
    status:
      statusFilter === "all"
        ? undefined
        : (statusFilter as PurchaseOrderStatus),
    supplierId: supplierFilter === "all" ? undefined : supplierFilter,
  });

  const { data: stats } = usePurchaseOrderStats();
  const { data: suppliers } = useSuppliers({ isActive: true });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inkooporders</h1>
            <p className="text-muted-foreground">
              Beheer je bestellingen bij leveranciers
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/purchase-orders/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe inkooporder
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Concepten"
            value={stats?.draft || 0}
            icon={FileText}
          />
          <StatsCard
            title="In afwachting"
            value={stats?.pending || 0}
            description={`€${(stats?.pendingValue || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
            icon={Clock}
          />
          <StatsCard
            title="Onderweg"
            value={stats?.inTransit || 0}
            icon={Truck}
          />
          <StatsCard
            title="Ontvangen"
            value={stats?.received || 0}
            icon={CheckCircle}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op ordernummer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="draft">Concept</SelectItem>
                  <SelectItem value="sent">Verzonden</SelectItem>
                  <SelectItem value="confirmed">Bevestigd</SelectItem>
                  <SelectItem value="shipped">Onderweg</SelectItem>
                  <SelectItem value="partially_received">Deels ontvangen</SelectItem>
                  <SelectItem value="received">Ontvangen</SelectItem>
                  <SelectItem value="cancelled">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]">
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

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordernummer</TableHead>
                  <TableHead>Leverancier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orderdatum</TableHead>
                  <TableHead>Verwachte levering</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Laden...
                    </TableCell>
                  </TableRow>
                ) : orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Link
                          to={`/admin/purchase-orders/${order.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/suppliers/${order.supplier_id}`}
                          className="hover:text-primary"
                        >
                          {order.supplier?.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PurchaseOrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.order_date), "d MMM yyyy", {
                          locale: nl,
                        })}
                      </TableCell>
                      <TableCell>
                        {order.expected_delivery_date
                          ? format(
                              new Date(order.expected_delivery_date),
                              "d MMM yyyy",
                              { locale: nl }
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        €{order.total.toLocaleString("nl-NL", {
                          minimumFractionDigits: 2,
                        })}
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
                              <Link to={`/admin/purchase-orders/${order.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                Bekijken
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-1">
                        Geen inkooporders gevonden
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {search || statusFilter !== "all" || supplierFilter !== "all"
                          ? "Probeer andere filters"
                          : "Maak je eerste inkooporder aan"}
                      </p>
                      {!search && statusFilter === "all" && supplierFilter === "all" && (
                        <Button asChild>
                          <Link to="/admin/purchase-orders/new">
                            <Plus className="h-4 w-4 mr-2" />
                            Eerste inkooporder
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
