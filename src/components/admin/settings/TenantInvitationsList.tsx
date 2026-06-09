import { useMemo, useState } from 'react';
import { Mail, MoreHorizontal, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTeamInvitations, InvitationStatus, TeamInvitation } from '@/hooks/useTeamInvitations';

type FilterValue = InvitationStatus | 'all';

const STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'In afwachting',
  accepted: 'Geaccepteerd',
  expired: 'Verlopen',
  revoked: 'Ingetrokken',
  rejected: 'Geweigerd',
};

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Admin',
  staff: 'Medewerker',
  accountant: 'Boekhouder',
  warehouse: 'Magazijn',
  marketing: 'Marketing',
  viewer: 'Kijker',
};

function StatusBadge({ status }: { status: InvitationStatus }) {
  switch (status) {
    case 'pending':
      return <Badge className="bg-yellow-500/15 text-yellow-700 border border-yellow-500/40">{STATUS_LABELS[status]}</Badge>;
    case 'accepted':
      return <Badge className="bg-green-500/15 text-green-700 border border-green-500/40">{STATUS_LABELS[status]}</Badge>;
    case 'expired':
      return <Badge variant="outline" className="text-muted-foreground">{STATUS_LABELS[status]}</Badge>;
    case 'revoked':
      return <Badge className="bg-destructive/15 text-destructive border border-destructive/40">{STATUS_LABELS[status]}</Badge>;
    case 'rejected':
      return <Badge className="bg-orange-500/15 text-orange-700 border border-orange-500/40">{STATUS_LABELS[status]}</Badge>;
  }
}

export function TenantInvitationsList() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const { invitations, isLoading, revokeInvitation, resendInvitation } =
    useTeamInvitations({ statusFilter: 'all' });
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    if (filter === 'all') return invitations;
    return invitations.filter((i) => i.status === filter);
  }, [invitations, filter]);

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      all: invitations.length, pending: 0, accepted: 0, expired: 0, revoked: 0, rejected: 0,
    };
    invitations.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [invitations]);

  const handleRevoke = async () => {
    if (!confirmRevokeId) return;
    setBusy(true);
    await revokeInvitation(confirmRevokeId);
    setBusy(false);
    setConfirmRevokeId(null);
  };

  const handleResend = async (id: string) => {
    setBusy(true);
    await resendInvitation(id);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Uitnodigingen</CardTitle>
              <CardDescription>
                Verstuurde, geaccepteerde en ingetrokken team-uitnodigingen
              </CardDescription>
            </div>
          </div>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)} className="mt-3">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all">Alle ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">In afwachting ({counts.pending})</TabsTrigger>
            <TabsTrigger value="accepted">Geaccepteerd ({counts.accepted})</TabsTrigger>
            <TabsTrigger value="expired">Verlopen ({counts.expired})</TabsTrigger>
            <TabsTrigger value="revoked">Ingetrokken ({counts.revoked})</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Geen uitnodigingen in deze categorie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Aangemaakt</TableHead>
                  <TableHead className="hidden md:table-cell">Vervalt</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((inv: TeamInvitation) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>{ROLE_LABELS[inv.role] ?? inv.role}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {format(new Date(inv.created_at), 'd MMM yyyy', { locale: nl })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {format(new Date(inv.expires_at), 'd MMM yyyy', { locale: nl })}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        inv={inv}
                        busy={busy}
                        onResend={() => handleResend(inv.id)}
                        onRevoke={() => setConfirmRevokeId(inv.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmRevokeId} onOpenChange={() => setConfirmRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uitnodiging intrekken?</AlertDialogTitle>
            <AlertDialogDescription>
              De uitnodigingslink wordt onmiddellijk ongeldig. Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? 'Intrekken...' : 'Intrekken'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function RowActions({
  inv, busy, onResend, onRevoke,
}: {
  inv: TeamInvitation;
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  if (inv.status === 'accepted') return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {inv.status === 'pending' && (
          <>
            <DropdownMenuItem onClick={onResend}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Opnieuw verzenden
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRevoke} className="text-destructive">
              <X className="h-4 w-4 mr-2" />
              Intrekken
            </DropdownMenuItem>
          </>
        )}
        {(inv.status === 'expired' || inv.status === 'revoked' || inv.status === 'rejected') && (
          <DropdownMenuItem onClick={onResend}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Opnieuw uitnodigen
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}