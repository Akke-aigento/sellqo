// EVENT-SYSTEEM — snelacties-menu per event-kaart op het dashboard.
//
// Bewerken · Scanner openen · Dupliceren — | — Afronden · Annuleren — | — Verwijderen.
// De kaart eronder is volledig klikbaar (navigeert), dus elke interactie hier stopt
// propagatie. Alle schrijf-acties lopen via bestaande/aparte hooks; guards (annuleren,
// verwijderen-met-verkopen) zijn client-side waarschuwingen, de harde handhaving zit
// server-side.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MoreVertical, Pencil, QrCode, Copy, CheckCircle2, XCircle, Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDuplicateEvent, useUpdateEventStatusQuick, useDeleteEventQuick } from '@/hooks/useDuplicateEvent';

interface EventCardActionsProps {
  eventId: string;
  status: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  /** Aantal verkochte tickets (valid/checked_in) — gebruikt in de bevestigingstekst. */
  sold: number;
  /**
   * Het event heeft blokkerende kinderen (tickets in welke status dan ook,
   * tickettypes, zones of scanner-toegangen). Geen enkele FK naar event_details
   * heeft ON DELETE CASCADE, dus een DELETE zou stuklopen op een 23503. Het
   * menu-item blijft zichtbaar maar wordt uitgeschakeld met uitleg.
   */
  deleteBlocked: boolean;
}

const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

export function EventCardActions({ eventId, status, eventDate, startTime, endTime, sold, deleteBlocked }: EventCardActionsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const duplicate = useDuplicateEvent();
  const updateStatus = useUpdateEventStatusQuick();
  const deleteEvent = useDeleteEventQuick();

  const [dupOpen, setDupOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dupDate, setDupDate] = useState(eventDate);
  const [dupStart, setDupStart] = useState(startTime?.slice(0, 5) ?? '');
  const [dupEnd, setDupEnd] = useState(endTime?.slice(0, 5) ?? '');

  const canComplete = status !== 'completed' && status !== 'cancelled';
  const canCancel = status !== 'cancelled';
  const dupInvalid = !dupDate || !dupStart;

  const doDuplicate = () => {
    duplicate.mutate(
      { sourceEventId: eventId, event_date: dupDate, start_time: dupStart, end_time: dupEnd.trim() === '' ? null : dupEnd },
      { onSuccess: () => setDupOpen(false) },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={stop}
            aria-label={t('events.actions.menuLabel', 'Acties')}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem onClick={() => navigate(`/admin/events/${eventId}`)}>
            <Pencil className="h-4 w-4 mr-2" /> {t('events.actions.edit', 'Bewerken')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/admin/checkin?event=${eventId}`)}>
            <QrCode className="h-4 w-4 mr-2" /> {t('events.actions.openScanner', 'Scanner openen')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDupOpen(true)}>
            <Copy className="h-4 w-4 mr-2" /> {t('events.actions.duplicate', 'Dupliceren')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {canComplete && (
            <DropdownMenuItem
              onClick={() => updateStatus.mutate({ id: eventId, status: 'completed' })}
              disabled={updateStatus.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> {t('events.actions.complete', 'Afronden')}
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem onClick={() => setCancelOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" /> {t('events.actions.cancel', 'Annuleren')}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {deleteBlocked ? (
            // Zichtbaar maar uitgeschakeld. De Tooltip hangt om een span: het item
            // zelf krijgt `pointer-events: none` via data-[disabled], dus hover moet
            // op de wrapper landen om de uitleg te kunnen tonen.
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <DropdownMenuItem
                    disabled
                    onSelect={(e) => e.preventDefault()}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> {t('events.actions.delete', 'Verwijderen')}
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[16rem]">
                {t('events.actions.deleteBlockedHint', 'Dit event heeft tickettypes of tickets — annuleer het in plaats van verwijderen.')}
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> {t('events.actions.delete', 'Verwijderen')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dupliceer-dialog: alleen nieuwe datum/tijd; rest wordt overgenomen. */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent onClick={stop}>
          <DialogHeader>
            <DialogTitle>{t('events.actions.duplicateTitle', 'Event dupliceren')}</DialogTitle>
            <DialogDescription>
              {t('events.actions.duplicateDesc', 'Kies een nieuwe datum en tijd. Capaciteit, locatie en tickettypes worden overgenomen. Het nieuwe event staat op "Gepland".')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('events.settings.date', 'Datum')}</Label>
              <Input type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('events.settings.startTime', 'Starttijd')}</Label>
              <Input type="time" value={dupStart} onChange={(e) => setDupStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('events.settings.endTime', 'Eindtijd')}</Label>
              <Input type="time" value={dupEnd} onChange={(e) => setDupEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDupOpen(false)} disabled={duplicate.isPending}>
              {t('common.cancel', 'Annuleren')}
            </Button>
            <Button onClick={doDuplicate} disabled={dupInvalid || duplicate.isPending}>
              {duplicate.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
              {t('events.actions.duplicateConfirm', 'Dupliceren')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annuleren-confirm: haalt het event uit de webshop. */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.actions.cancelTitle', 'Event annuleren?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('events.actions.cancelDesc', 'Dit event verdwijnt uit je webshop en er kunnen geen nieuwe tickets verkocht worden. Bestaande tickets blijven geldig.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.back', 'Terug')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setCancelOpen(false); updateStatus.mutate({ id: eventId, status: 'cancelled' }); }}
            >
              {t('events.actions.cancelConfirm', 'Ja, annuleren')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verwijderen-confirm: geblokkeerd bij verkochte tickets. */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('events.actions.deleteTitle', 'Event verwijderen?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {sold > 0
                ? t('events.actions.deleteBlocked', 'Er zijn al tickets verkocht voor dit event. Verwijderen kan niet — annuleer het event in plaats daarvan.')
                : t('events.actions.deleteDesc', 'Dit verwijdert het event definitief. Deze actie kan niet ongedaan gemaakt worden.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.back', 'Terug')}</AlertDialogCancel>
            {sold === 0 && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { setDeleteOpen(false); deleteEvent.mutate({ id: eventId }); }}
              >
                {t('events.actions.deleteConfirm', 'Ja, verwijderen')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
