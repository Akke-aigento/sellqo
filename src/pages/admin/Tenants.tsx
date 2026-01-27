import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Store, ExternalLink, Eye } from 'lucide-react';
import { useTenants, Tenant, TenantFormData } from '@/hooks/useTenants';
import { TenantFormDialog } from '@/components/admin/TenantFormDialog';
import { TenantBulkActions } from '@/components/admin/TenantBulkActions';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Actief</Badge>;
    case 'trial':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Trial</Badge>;
    case 'suspended':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Opgeschort</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Geannuleerd</Badge>;
    default:
      return <Badge variant="secondary">Onbekend</Badge>;
  }
}

function getPlanBadge(plan: string | null) {
  switch (plan) {
    case 'starter':
      return <Badge variant="outline">Starter</Badge>;
    case 'professional':
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Professional</Badge>;
    case 'enterprise':
      return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Enterprise</Badge>;
    default:
      return <Badge variant="secondary">Onbekend</Badge>;
  }
}

export default function TenantsPage() {
  const navigate = useNavigate();
  const { tenants, isLoading, createTenant, updateTenant, deleteTenant } = useTenants();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTenants = tenants.filter((t) => selectedIds.has(t.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredTenants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTenants.map((t) => t.id)));
    }
  };

  const handleCreate = () => {
    setSelectedTenant(null);
    setDialogOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogOpen(true);
  };

  const handleDelete = (tenant: Tenant) => {
    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (tenantToDelete) {
      deleteTenant.mutate(tenantToDelete.id);
      setDeleteDialogOpen(false);
      setTenantToDelete(null);
    }
  };

  const handleSubmit = (data: TenantFormData) => {
    if (selectedTenant) {
      updateTenant.mutate(
        { id: selectedTenant.id, data },
        {
          onSuccess: () => setDialogOpen(false),
        }
      );
    } else {
      createTenant.mutate(data, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">
            Beheer alle winkels op het platform
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe tenant
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoek tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredTenants.length} tenant{filteredTenants.length !== 1 ? 's' : ''}
        </div>
      </div>

      <TenantBulkActions
        selectedTenants={selectedTenants}
        onComplete={() => {}}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === filteredTenants.length && filteredTenants.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Winkel</TableHead>
              <TableHead>Eigenaar</TableHead>
              <TableHead>Abonnement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aangemaakt</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Store className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">Geen tenants gevonden</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(tenant.id)}
                      onCheckedChange={() => toggleSelection(tenant.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{tenant.name}</p>
                          {tenant.is_demo && (
                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">
                              DEMO
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tenant.owner_name || '-'}</p>
                      <p className="text-sm text-muted-foreground">{tenant.owner_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tenant.is_demo ? (
                      <Badge variant="secondary">N/A</Badge>
                    ) : (
                      getPlanBadge(tenant.subscription_plan)
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant.is_demo ? (
                      <Badge variant="secondary">N/A</Badge>
                    ) : (
                      getStatusBadge(tenant.subscription_status)
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant.created_at
                      ? format(new Date(tenant.created_at), 'd MMM yyyy', { locale: nl })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/platform/tenants/${tenant.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Bekijk details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Bewerken
                        </DropdownMenuItem>
                        {tenant.custom_domain && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://${tenant.custom_domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Naar winkel
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(tenant)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={selectedTenant}
        onSubmit={handleSubmit}
        isLoading={createTenant.isPending || updateTenant.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tenant verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{tenantToDelete?.name}" wilt verwijderen? Dit
              verwijdert ook alle producten, bestellingen en klanten van deze
              tenant. Deze actie kan niet ongedaan worden gemaakt.
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
    </div>
  );
}
