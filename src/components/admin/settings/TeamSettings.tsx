import { useState } from 'react';
import { Users, MoreHorizontal, Shield, UserCog, Trash2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTeamMembers, TeamMember } from '@/hooks/useTeamMembers';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'platform_admin':
      return <Badge className="bg-purple-500">Platform Admin</Badge>;
    case 'tenant_admin':
      return <Badge className="bg-blue-500">Admin</Badge>;
    case 'staff':
      return <Badge variant="secondary">Medewerker</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

const getInitials = (name: string | null, email: string | null) => {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return email?.charAt(0).toUpperCase() || 'U';
};

export function TeamSettings() {
  const { members, isLoading, updateMemberRole, removeMember } = useTeamMembers();
  const { user } = useAuth();
  
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRoleChange = async (member: TeamMember, newRole: 'tenant_admin' | 'staff') => {
    await updateMemberRole(member.id, newRole);
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    await removeMember(memberToRemove.id);
    setIsRemoving(false);
    setMemberToRemove(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Teamleden</CardTitle>
                <CardDescription>
                  Beheer wie toegang heeft tot je winkel
                </CardDescription>
              </div>
            </div>
            <Button disabled>
              <Mail className="h-4 w-4 mr-2" />
              Uitnodigen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Geen teamleden</h3>
              <p className="text-muted-foreground mb-4">
                Voeg teamleden toe om samen te werken aan je winkel.
              </p>
              <Button disabled>
                <Mail className="h-4 w-4 mr-2" />
                Eerste teamlid uitnodigen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Toegevoegd op</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  const isPlatformAdmin = member.role === 'platform_admin';
                  
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatar_url || ''} />
                            <AvatarFallback>
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.full_name || 'Geen naam'}
                              {isCurrentUser && (
                                <span className="text-muted-foreground ml-2">(jij)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.email || 'Geen e-mail'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(member.created_at), 'd MMM yyyy', { locale: nl })}
                      </TableCell>
                      <TableCell>
                        {!isCurrentUser && !isPlatformAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => handleRoleChange(member, 'tenant_admin')}
                                disabled={member.role === 'tenant_admin'}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Maak Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleRoleChange(member, 'staff')}
                                disabled={member.role === 'staff'}
                              >
                                <UserCog className="h-4 w-4 mr-2" />
                                Maak Medewerker
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setMemberToRemove(member)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role explanations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rollen uitleg</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Badge className="bg-blue-500 mt-0.5">Admin</Badge>
            <div>
              <p className="font-medium">Tenant Admin</p>
              <p className="text-sm text-muted-foreground">
                Volledige toegang tot alle functies, inclusief instellingen, teamleden en betalingen.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-0.5">Medewerker</Badge>
            <div>
              <p className="font-medium">Staff</p>
              <p className="text-sm text-muted-foreground">
                Kan producten, orders en klanten beheren. Geen toegang tot instellingen of teamleden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teamlid verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove && (
                <>
                  Weet je zeker dat je <strong>{memberToRemove.full_name || memberToRemove.email}</strong> wilt 
                  verwijderen uit het team? Deze persoon heeft dan geen toegang meer tot je winkel.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Verwijderen...' : 'Verwijderen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
