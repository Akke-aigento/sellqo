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
import { Plus, MoreHorizontal, Edit, Trash2, Settings2, ArrowLeft, Info } from 'lucide-react';
import { useStackingRules, useUpdateStackingRule, useDeleteStackingRule } from '@/hooks/useStackingRules';
import { StackingRuleFormDialog } from '@/components/admin/promotions/StackingRuleFormDialog';
import type { DiscountStackingRule } from '@/types/promotions';
import { NavLink } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StackingRulesPage() {
  const { data: rules = [], isLoading } = useStackingRules();
  const updateRule = useUpdateStackingRule();
  const deleteRule = useDeleteStackingRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountStackingRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<DiscountStackingRule | null>(null);

  const handleToggleActive = async (rule: DiscountStackingRule) => {
    await updateRule.mutateAsync({
      id: rule.id,
      formData: { is_active: !rule.is_active },
    });
  };

  const handleEdit = (rule: DiscountStackingRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDelete = (rule: DiscountStackingRule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (ruleToDelete) {
      await deleteRule.mutateAsync(ruleToDelete.id);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'exclusive':
        return 'Exclusief';
      case 'stackable':
        return 'Stapelbaar';
      case 'priority':
        return 'Prioriteit';
      default:
        return type;
    }
  };

  const getRuleTypeVariant = (type: string): 'default' | 'secondary' | 'destructive' => {
    switch (type) {
      case 'exclusive':
        return 'destructive';
      case 'stackable':
        return 'default';
      default:
        return 'secondary';
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
          <h1 className="text-2xl font-semibold">Stapelregels</h1>
          <p className="text-muted-foreground">
            Bepaal welke kortingen mogen combineren
          </p>
        </div>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Regel
        </Button>
      </div>

      {/* Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Hoe werken stapelregels?</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li><strong>Exclusief:</strong> Deze korting kan niet met andere kortingen gecombineerd worden</li>
            <li><strong>Stapelbaar:</strong> Deze kortingen mogen samen toegepast worden</li>
            <li><strong>Prioriteit:</strong> Bepaal welke korting voorrang krijgt bij conflicten</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Stapelregels ({rules.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {isLoading ? (
            <p className="text-muted-foreground">Laden...</p>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <Settings2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Geen stapelregels geconfigureerd. Standaard kunnen alle kortingen gestapeld worden.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Eerste regel aanmaken
              </Button>
            </div>
          ) : (
            <div className="min-w-[650px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Kortingstypes</TableHead>
                  <TableHead className="hidden sm:table-cell">Max. Stapelen</TableHead>
                  <TableHead className="hidden sm:table-cell">Max. Korting</TableHead>
                  <TableHead>Actief</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-sm text-muted-foreground">{rule.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRuleTypeVariant(rule.rule_type)}>
                        {getRuleTypeLabel(rule.rule_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {rule.discount_types?.slice(0, 3).map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                        {rule.discount_types && rule.discount_types.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{rule.discount_types.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {rule.max_stack_count ?? '∞'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {rule.max_total_discount_percent
                        ? `${rule.max_total_discount_percent}%`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bewerken
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(rule)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <StackingRuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stapelregel verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{ruleToDelete?.name}" wilt verwijderen?
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
