// PERSONEEL-1 — tab "Personeel" op /admin/pos: wie mag aan de kassa, met welke PIN en rol,
// en het rijksregisternummer (INSZ) dat een geregistreerde kassa per medewerker nodig heeft.
// PIN en INSZ zijn hier enkel te zetten, nooit te lezen.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Plus, ShieldCheck, ShieldAlert, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useKassaStaff, KASSA_ROLES, type KassaRole, type KassaStaffRow } from '@/hooks/useKassaStaff';
import { isValidInsz } from '@/kassa/fiscal/identity';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

interface FormState {
  id: string | null;
  display_name: string;
  role: KassaRole;
  employee_no: string;
  avatar_color: string;
  is_active: boolean;
  can_use_pos: boolean;
  pin: string;
  insz: string;
  inszSetAt: string | null;
  clearInsz: boolean;
}

const empty = (): FormState => ({
  id: null, display_name: '', role: 'waiter', employee_no: '', avatar_color: COLORS[0], is_active: true, can_use_pos: true,
  pin: '', insz: '', inszSetAt: null, clearInsz: false,
});

export function KassaStaffTab() {
  const { t, i18n } = useTranslation();
  const { staff, isLoading, error, save } = useKassaStaff();
  const [form, setForm] = useState<FormState | null>(null);

  const open = (s?: KassaStaffRow) => setForm(s ? {
    id: s.id, display_name: s.display_name, role: s.role, employee_no: s.employee_no ? String(s.employee_no) : '',
    avatar_color: s.avatar_color ?? COLORS[0], is_active: s.is_active, can_use_pos: s.can_use_pos, pin: '', insz: '',
    inszSetAt: s.insz_set_at, clearInsz: false,
  } : empty());

  const inszDigits = form?.insz.replace(/\D/g, '') ?? '';
  const pinOk = !form || (form.id ? form.pin === '' || /^\d{4,6}$/.test(form.pin) : /^\d{4,6}$/.test(form.pin));
  const inszOk = !form || inszDigits === '' || isValidInsz(inszDigits);
  const noOk = !form || form.employee_no === '' || /^\d{1,4}$/.test(form.employee_no);
  const canSave = !!form && form.display_name.trim().length > 0 && pinOk && inszOk && noOk && !save.isPending;

  const submit = async () => {
    if (!form || !canSave) return;
    try {
      await save.mutateAsync({
        id: form.id,
        display_name: form.display_name.trim(),
        role: form.role,
        employee_no: form.employee_no ? Number(form.employee_no) : null,
        avatar_color: form.avatar_color,
        is_active: form.is_active,
        can_use_pos: form.can_use_pos,
        pin: form.pin || null,
        insz: form.clearInsz ? null : inszDigits ? inszDigits : undefined,
      });
      toast.success(t('admin.kassaStaff.saved'));
      setForm(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === '23505' ? t('admin.kassaStaff.numberTaken') : t('admin.kassaStaff.saveError'));
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.kassaStaff.intro')}</p>
        <Button onClick={() => open()} className="shrink-0"><Plus className="mr-2 h-4 w-4" />{t('admin.kassaStaff.add')}</Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t('admin.kassaStaff.loadError')}</p>}
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : staff.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <UserRound className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">{t('admin.kassaStaff.emptyTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('admin.kassaStaff.emptyBody')}</p>
            <Button onClick={() => open()}><Plus className="mr-2 h-4 w-4" />{t('admin.kassaStaff.add')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border">
          {staff.map((s) => (
            <button key={s.id} type="button" onClick={() => open(s)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ backgroundColor: s.avatar_color ?? COLORS[0] }} aria-hidden>
                {s.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.display_name}{s.employee_no ? <span className="ml-2 text-xs text-muted-foreground">#{s.employee_no}</span> : null}</span>
                <span className="block truncate text-xs text-muted-foreground">{t(`admin.kassaStaff.roles.${s.role}`)}</span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {!s.is_active && <Badge variant="outline">{t('admin.kassaStaff.inactive')}</Badge>}
                {s.locked_until && new Date(s.locked_until) > new Date() && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />{t('admin.kassaStaff.locked')}</Badge>}
                {s.insz_set_at
                  ? <Badge variant="outline" className="gap-1 border-green-300 text-green-800"><ShieldCheck className="h-3 w-3" />{t('admin.kassaStaff.inszOk')}</Badge>
                  : <Badge variant="outline" className="gap-1 border-amber-300 text-amber-800"><ShieldAlert className="h-3 w-3" />{t('admin.kassaStaff.inszMissing')}</Badge>}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? t('admin.kassaStaff.editTitle') : t('admin.kassaStaff.addTitle')}</DialogTitle>
            <DialogDescription>{t('admin.kassaStaff.dialogIntro')}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <div className="space-y-1">
                  <Label htmlFor="ks-name">{t('admin.kassaStaff.name')}</Label>
                  <Input id="ks-name" value={form.display_name} maxLength={60} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ks-no">{t('admin.kassaStaff.number')}</Label>
                  <Input id="ks-no" inputMode="numeric" placeholder={t('admin.kassaStaff.numberAuto')} value={form.employee_no}
                    onChange={(e) => setForm({ ...form, employee_no: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-role">{t('admin.kassaStaff.role')}</Label>
                <select id="ks-role" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as KassaRole })}>
                  {KASSA_ROLES.map((r) => <option key={r} value={r}>{t(`admin.kassaStaff.roles.${r}`)}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-sm font-medium">{t('admin.kassaStaff.color')}</span>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, avatar_color: c })} aria-label={c} aria-pressed={form.avatar_color === c}
                      className={`h-8 w-8 rounded-full ring-offset-2 ${form.avatar_color === c ? 'ring-2 ring-foreground' : ''}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-pin">{form.id ? t('admin.kassaStaff.newPin') : t('admin.kassaStaff.pin')}</Label>
                <Input id="ks-pin" type="password" inputMode="numeric" autoComplete="new-password" value={form.pin}
                  placeholder={form.id ? t('admin.kassaStaff.pinKeep') : ''}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                {!pinOk && <p className="text-xs text-destructive">{t('admin.kassaStaff.pinRule')}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ks-insz">{t('admin.kassaStaff.insz')}</Label>
                <Input id="ks-insz" inputMode="numeric" autoComplete="off" value={form.insz} disabled={form.clearInsz}
                  placeholder={form.inszSetAt ? t('admin.kassaStaff.inszSetOn', { date: fmt(form.inszSetAt) }) : '85.07.30-033.28'}
                  onChange={(e) => setForm({ ...form, insz: e.target.value.slice(0, 15) })} />
                <p className="text-xs text-muted-foreground">{t('admin.kassaStaff.inszHelp')}</p>
                {!inszOk && <p className="text-xs text-destructive">{t('admin.kassaStaff.inszInvalid')}</p>}
                {form.inszSetAt && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.clearInsz} onChange={(e) => setForm({ ...form, clearInsz: e.target.checked, insz: '' })} />
                    {t('admin.kassaStaff.inszClear')}
                  </label>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ks-pos">{t('admin.kassaStaff.canUsePos')}</Label>
                <Switch id="ks-pos" checked={form.can_use_pos} onCheckedChange={(v) => setForm({ ...form, can_use_pos: v })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ks-active">{t('admin.kassaStaff.active')}</Label>
                <Switch id="ks-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={!canSave}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
