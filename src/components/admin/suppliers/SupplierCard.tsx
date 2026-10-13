import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Mail,
  Phone,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Package,
} from "lucide-react";
import type { Supplier } from "@/types/supplier";

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  productCount?: number;
}

export function SupplierCard({
  supplier,
  onEdit,
  onDelete,
  productCount = 0,
}: SupplierCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              {/* SUPPLIER-404-1: er bestaat geen detailpagina; de naam opent het bewerkvenster. */}
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                className="font-semibold hover:text-primary transition-colors text-left"
              >
                {supplier.name}
              </button>
              {supplier.contact_person && (
                <p className="text-sm text-muted-foreground">
                  {supplier.contact_person}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={supplier.is_active ? "default" : "secondary"}>
              {supplier.is_active ? "Actief" : "Inactief"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(supplier)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Bewerken
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(supplier)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {supplier.email && (
            <a
              href={`mailto:${supplier.email}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              {supplier.email}
            </a>
          )}
          {supplier.phone && (
            <a
              href={`tel:${supplier.phone}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              {supplier.phone}
            </a>
          )}
        </div>

        <div className="flex items-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-1.5 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{productCount} producten</span>
          </div>

          {supplier.rating && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < supplier.rating!
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted"
                  }`}
                />
              ))}
            </div>
          )}

          {supplier.city && (
            <span className="text-sm text-muted-foreground">
              {supplier.city}
              {supplier.country && `, ${supplier.country}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
