// ZAAL-1 — overzicht van de zalen van een winkel. Een zaal teken je één keer en gebruik
// je voor elke datum die erin doorgaat (koppeling per datum: ZAAL-2).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Armchair, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCreateVenue, useDeleteVenue, useVenues } from '@/hooks/useVenues';

export default function VenueList() {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.venues.${x}`, o);
  const navigate = useNavigate();
  const { data: venues, isLoading } = useVenues();
  const create = useCreateVenue();
  const del = useDeleteVenue();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      const id = await create.mutateAsync({ name, sectionName: k('default_section'), className: k('default_class') });
      setOpen(false);
      setName('');
      navigate(`/admin/events/venues/${id}`);
    } catch {
      toast.error(k('create_failed'));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(k('deleted'));
    } catch {
      toast.error(k('delete_failed'));
    }
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {k('back_to_events')}
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Armchair className="h-5 w-5" /> {k('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{k('subtitle')}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />{k('new_venue')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !venues?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Armchair className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{k('empty_title')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{k('empty_body')}</p>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{k('first_venue')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <Card key={v.id} className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <Link to={`/admin/events/venues/${v.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name}</p>
                  {v.address && <p className="truncate text-sm text-muted-foreground">{v.address}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">{k('seat_count', { count: v.seats })}</p>
                </Link>
                <Button
                  variant="ghost" size="icon" aria-label={k('delete')}
                  onClick={() => setToDelete({ id: v.id, name: v.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{k('new_venue')}</DialogTitle>
            <DialogDescription>{k('new_venue_hint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="venue-name">{k('name')}</Label>
            <Input
              id="venue-name" value={name} autoFocus placeholder={k('name_placeholder')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void submit()} disabled={!name.trim() || create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{k('delete_title', { name: toDelete?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{k('delete_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>{k('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
