import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Palette,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Image as ImageIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useGiftCardDesigns,
  useUpdateGiftCardDesign,
  useDeleteGiftCardDesign,
} from '@/hooks/useGiftCardDesigns';
import { GiftCardDesignDialog } from '@/components/admin/promotions/GiftCardDesignDialog';
import { giftCardThemes, type GiftCardDesign } from '@/types/giftCard';
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

export default function GiftCardDesigns() {
  const navigate = useNavigate();
  const { data: designs = [], isLoading } = useGiftCardDesigns();
  const updateDesign = useUpdateGiftCardDesign();
  const deleteDesign = useDeleteGiftCardDesign();

  const [showDialog, setShowDialog] = useState(false);
  const [editingDesign, setEditingDesign] = useState<GiftCardDesign | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggleActive = async (design: GiftCardDesign) => {
    await updateDesign.mutateAsync({
      id: design.id,
      formData: { is_active: !design.is_active },
    });
  };

  const handleEdit = (design: GiftCardDesign) => {
    setEditingDesign(design);
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDesign.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const getThemeLabel = (theme: string) => {
    return giftCardThemes.find((t) => t.value === theme)?.label || theme;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/promotions/gift-cards')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="h-8 w-8" />
            Cadeaukaart ontwerpen
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer de visuele ontwerpen voor je cadeaukaarten
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingDesign(null);
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nieuw ontwerp
        </Button>
      </div>

      {/* Designs Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nog geen ontwerpen</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Maak mooie ontwerpen voor je cadeaukaarten. Klanten kunnen bij
              aankoop een ontwerp kiezen.
            </p>
            <Button
              onClick={() => {
                setEditingDesign(null);
                setShowDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Eerste ontwerp maken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {designs.map((design) => (
            <Card key={design.id} className="overflow-hidden">
              {/* Image Preview */}
              <div className="aspect-video bg-muted relative">
                {design.image_url ? (
                  <img
                    src={design.image_url}
                    alt={design.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                {!design.is_active && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Badge variant="secondary">Inactief</Badge>
                  </div>
                )}
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{design.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{getThemeLabel(design.theme)}</Badge>
                    </CardDescription>
                  </div>
                  <Switch
                    checked={design.is_active}
                    onCheckedChange={() => handleToggleActive(design)}
                  />
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(design)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Bewerken
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(design.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <GiftCardDesignDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        design={editingDesign}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ontwerp verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit ontwerp wordt permanent verwijderd. Bestaande cadeaukaarten met
              dit ontwerp behouden hun afbeelding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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