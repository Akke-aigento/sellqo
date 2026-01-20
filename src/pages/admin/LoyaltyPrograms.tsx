import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Plus, MoreHorizontal, Edit, Trash2, Heart, ArrowLeft, Users, Crown } from 'lucide-react';
import { useLoyaltyPrograms, useUpdateLoyaltyProgram, useDeleteLoyaltyProgram } from '@/hooks/useLoyalty';
import { LoyaltyProgramFormDialog } from '@/components/admin/promotions/LoyaltyProgramFormDialog';
import type { LoyaltyProgram } from '@/types/promotions';
import { NavLink } from 'react-router-dom';

export default function LoyaltyProgramsPage() {
  const { data: programs = [], isLoading } = useLoyaltyPrograms();
  const updateProgram = useUpdateLoyaltyProgram();
  const deleteProgram = useDeleteLoyaltyProgram();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<LoyaltyProgram | null>(null);

  const handleToggleActive = async (program: LoyaltyProgram) => {
    await updateProgram.mutateAsync({
      id: program.id,
      formData: { is_active: !program.is_active },
    });
  };

  const handleEdit = (program: LoyaltyProgram) => {
    setEditingProgram(program);
    setDialogOpen(true);
  };

  const handleDelete = (program: LoyaltyProgram) => {
    setProgramToDelete(program);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (programToDelete) {
      await deleteProgram.mutateAsync(programToDelete.id);
      setDeleteDialogOpen(false);
      setProgramToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <NavLink to="/admin/promotions">
            <ArrowLeft className="h-4 w-4" />
          </NavLink>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Loyaliteitsprogramma's</h1>
          <p className="text-muted-foreground">
            Spaarpunten en VIP tiers voor je klanten
          </p>
        </div>
        <Button onClick={() => { setEditingProgram(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuw Programma
        </Button>
      </div>

      {/* Programs */}
      {isLoading ? (
        <p className="text-muted-foreground">Laden...</p>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Geen loyaliteitsprogramma's</h3>
            <p className="text-muted-foreground mb-4">
              Start een spaarprogramma om klanten te belonen
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Eerste programma aanmaken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500 text-white">
                      <Heart className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {program.name}
                        {program.is_active ? (
                          <Badge>Actief</Badge>
                        ) : (
                          <Badge variant="secondary">Inactief</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{program.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={program.is_active}
                      onCheckedChange={() => handleToggleActive(program)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(program)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Bewerken
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(program)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{program.points_per_euro}</div>
                    <div className="text-sm text-muted-foreground">Punten per €1</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{program.tiers?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Tiers</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">—</div>
                    <div className="text-sm text-muted-foreground">Leden</div>
                  </div>
                </div>

                {/* Tiers */}
                {program.tiers && program.tiers.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Tiers
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tier</TableHead>
                          <TableHead>Min. Punten</TableHead>
                          <TableHead>Punten Multiplier</TableHead>
                          <TableHead>Korting</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {program.tiers.map((tier) => (
                          <TableRow key={tier.id}>
                            <TableCell className="font-medium">{tier.name}</TableCell>
                            <TableCell>{tier.min_points.toLocaleString()}</TableCell>
                            <TableCell>{tier.points_multiplier}x</TableCell>
                            <TableCell>
                              {tier.discount_percentage
                                ? `${tier.discount_percentage}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <LoyaltyProgramFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        program={editingProgram}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Programma verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{programToDelete?.name}" wilt verwijderen?
              Alle spaarpunten van klanten gaan verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
