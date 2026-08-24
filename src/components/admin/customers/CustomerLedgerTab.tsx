import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Wallet, Trash2, Pencil, Check, X, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/lib/utils';
import { useCustomerLedger, type LedgerEntry } from '@/hooks/useCustomerLedger';
import { useTranslation } from 'react-i18next';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';

const today = () => new Date().toISOString().slice(0, 10);

export function CustomerLedgerTab({ customerId }: { customerId?: string }) {
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { currentTenant } = useTenant();
  const currency = currentTenant?.currency || 'EUR';
  const {
    entries,
    balance,
    isLoading,
    recurring,
    createEntry,
    updateEntry,
    deleteEntry,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    applyRecurring,
  } = useCustomerLedger(customerId);

  // New entry form state
  const [newDate, setNewDate] = useState<string>(today());
  const [newAmount, setNewAmount] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Recurring form state
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [rcAmount, setRcAmount] = useState<string>('');
  const [rcNote, setRcNote] = useState<string>('');
  const [rcInterval, setRcInterval] = useState<string>('1');
  const [rcStart, setRcStart] = useState<string>(today());
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);

  const rec = recurring[0]; // one active row per customer conceptually

  const handleCreate = () => {
    const amt = parseFloat(newAmount);
    if (!Number.isFinite(amt)) return;
    createEntry.mutate(
      { amount: amt, note: newNote.trim() || null, entry_date: newDate },
      {
        onSuccess: () => {
          setNewAmount('');
          setNewNote('');
          setNewDate(today());
        },
      },
    );
  };

  const startEdit = (e: LedgerEntry) => {
    setEditingId(e.id);
    setEditDate(e.entry_date);
    setEditAmount(String(e.amount));
    setEditNote(e.note ?? '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: string) => {
    const amt = parseFloat(editAmount);
    if (!Number.isFinite(amt)) return;
    updateEntry.mutate(
      { id, data: { amount: amt, note: editNote.trim() || null, entry_date: editDate } },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleCreateRecurring = () => {
    const amt = parseFloat(rcAmount);
    const interval = parseInt(rcInterval, 10);
    if (!Number.isFinite(amt) || !Number.isFinite(interval) || interval < 1) return;
    createRecurring.mutate(
      {
        amount: amt,
        note: rcNote.trim() || null,
        interval_months: interval,
        next_date: rcStart,
      },
      {
        onSuccess: () => {
          setShowRecurringForm(false);
          setRcAmount('');
          setRcNote('');
          setRcInterval('1');
          setRcStart(today());
        },
      },
    );
  };

  const startEditRecurring = () => {
    if (!rec) return;
    setEditingRecurringId(rec.id);
    setRcAmount(String(rec.amount));
    setRcNote(rec.note ?? '');
    setRcInterval(String(rec.interval_months));
    setRcStart(rec.next_date);
  };

  const saveEditRecurring = () => {
    if (!editingRecurringId) return;
    const amt = parseFloat(rcAmount);
    const interval = parseInt(rcInterval, 10);
    if (!Number.isFinite(amt) || !Number.isFinite(interval) || interval < 1) return;
    updateRecurring.mutate(
      {
        id: editingRecurringId,
        data: {
          amount: amt,
          note: rcNote.trim() || null,
          interval_months: interval,
          next_date: rcStart,
        },
      },
      { onSuccess: () => setEditingRecurringId(null) },
    );
  };

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.giftCards.openstaand_saldo')}</CardTitle>
          <CardDescription>{t('admin.customers.customerLedgerTab.prive_kladblok_enkel_zichtbaar_voor_platform')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`text-4xl font-semibold ${
              balance >= 0 ? 'text-green-600' : 'text-destructive'
            }`}
          >
            {formatCurrency(balance, currency)}
          </div>
        </CardContent>
      </Card>

      {/* Add entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.customers.customerLedgerTab.mutatie_toevoegen')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
            <div className="sm:col-span-3">
              <Label htmlFor="ledger-date" className="sr-only">{t('common.date')}</Label>
              <Input
                id="ledger-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="ledger-amount" className="sr-only">{t('admin.promotions.giftCardBalanceDialog.bedrag')}</Label>
              <Input
                id="ledger-amount"
                type="number"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="-150.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.customers.customerLedgerTab.negatief_positief')}
              </p>
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="ledger-note" className="sr-only">{t('admin.stockLedger.colNote')}</Label>
              <Input
                id="ledger-note"
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('admin.customers.customerLedgerTab.betaling_ontvangen')}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createEntry.isPending || !newAmount}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('common.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.customers.customerLedgerTab.mutaties')}</CardTitle>
          <CardDescription>{entries.length} mutatie(s)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.customers.customerLedgerTab.nog_geen_mutaties')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">{t('common.date')}</TableHead>
                  <TableHead>{t('admin.stockLedger.colNote')}</TableHead>
                  <TableHead className="text-right w-[140px]">{t('admin.promotions.giftCardBalanceDialog.bedrag')}</TableHead>
                  <TableHead className="w-[110px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const isEditing = editingId === e.id;
                  const amt = Number(e.amount);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(ev) => setEditDate(ev.target.value)}
                          />
                        ) : (
                          format(parseISO(e.entry_date), 'd MMM yyyy', { locale: dateLocale })
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="text"
                            value={editNote}
                            onChange={(ev) => setEditNote(ev.target.value)}
                          />
                        ) : (
                          e.note || <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(ev) => setEditAmount(ev.target.value)}
                            className="text-right"
                          />
                        ) : (
                          <span className={amt >= 0 ? 'text-green-600' : 'text-destructive'}>
                            {formatCurrency(amt, currency)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(e.id)}
                                disabled={updateEntry.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={cancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(e)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.customers.customerLedgerTab.mutatie_verwijderen')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t('admin.customers.customerLedgerTab.deze_actie_kan_niet_ongedaan_gemaakt')}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteEntry.mutate({ id: e.id })}
                                    >
                                      {t('common.delete')}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recurring block */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.customers.customerLedgerTab.vaste_kost')}</CardTitle>
          <CardDescription>{t('admin.customers.customerLedgerTab.herhalend_maandbedrag_of_ander_interval')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!rec && !showRecurringForm && (
            <Button variant="outline" onClick={() => setShowRecurringForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('admin.customers.customerLedgerTab.vaste_kost_instellen')}
            </Button>
          )}

          {!rec && showRecurringForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('admin.promotions.giftCardBalanceDialog.bedrag')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rcAmount}
                  onChange={(e) => setRcAmount(e.target.value)}
                  placeholder="-49.00"
                />
              </div>
              <div>
                <Label>{t('admin.stockLedger.colNote')}</Label>
                <Input
                  type="text"
                  value={rcNote}
                  onChange={(e) => setRcNote(e.target.value)}
                  placeholder={t('admin.customers.customerLedgerTab.maandelijkse_fee')}
                />
              </div>
              <div>
                <Label>{t('admin.customers.customerLedgerTab.interval_maanden')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={rcInterval}
                  onChange={(e) => setRcInterval(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.ads.bolCampaignEditForm.startdatum')}</Label>
                <Input
                  type="date"
                  value={rcStart}
                  onChange={(e) => setRcStart(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button onClick={handleCreateRecurring} disabled={createRecurring.isPending}>
                  {t('common.save')}
                </Button>
                <Button variant="ghost" onClick={() => setShowRecurringForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {rec && editingRecurringId !== rec.id && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={`text-xl font-semibold ${Number(rec.amount) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(Number(rec.amount), currency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {rec.note || '—'} · elke {rec.interval_months} maand(en) · volgende:{' '}
                    {format(parseISO(rec.next_date), 'd MMM yyyy', { locale: dateLocale })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rec.active}
                      onCheckedChange={(checked) =>
                        updateRecurring.mutate({ id: rec.id, data: { active: checked } })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {rec.active ? t('admin.marketing.aBTestingPanel.actief') : t('admin.marketing.campaignCard.status.gepauzeerd')}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={startEditRecurring}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin.customers.customerLedgerTab.vaste_kost_verwijderen')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('admin.customers.customerLedgerTab.bestaande_mutaties_blijven_staan_enkel_de')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRecurring.mutate({ id: rec.id })}>
                          {t('common.delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => applyRecurring.mutate(rec)}
                disabled={!rec.active || applyRecurring.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('admin.customers.customerLedgerTab.voeg_maandbedrag_toe')}
              </Button>
            </div>
          )}

          {rec && editingRecurringId === rec.id && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('admin.promotions.giftCardBalanceDialog.bedrag')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rcAmount}
                  onChange={(e) => setRcAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.stockLedger.colNote')}</Label>
                <Input
                  type="text"
                  value={rcNote}
                  onChange={(e) => setRcNote(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.customers.customerLedgerTab.interval_maanden_2')}</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={rcInterval}
                  onChange={(e) => setRcInterval(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('admin.customers.customerLedgerTab.volgende_datum')}</Label>
                <Input
                  type="date"
                  value={rcStart}
                  onChange={(e) => setRcStart(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button onClick={saveEditRecurring} disabled={updateRecurring.isPending}>
                  {t('common.save')}
                </Button>
                <Button variant="ghost" onClick={() => setEditingRecurringId(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}