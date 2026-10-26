// FEST-2 — munten: drank- en etenbonnen zonder papier.
// De klant koopt een muntenpakket (los of samen met tickets) en krijgt één QR per bestelling.
// Aan de bar scant het personeel die QR met een barlink (geen account) en schrijft munten af.
// Ongebruikte munten kan de klant zelf laten terugstorten: dat wordt een gewone retour die
// je in Retouren goedkeurt; process-refund doet de Stripe-terugbetaling en de creditnota.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import {
  ArrowLeft, Ban, Check, Coins, Copy, ExternalLink, Loader2, Plus, QrCode, RotateCcw, Search, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  barUrl, useAdjustWallet, useCreateTokenPack, useCreateTokenScanner, useSaveTokenSettings, useSetWalletBlocked,
  useTokenPacks, useTokenScanners, useTokenSettings, useTokenStats, useToggleTokenScanner, useWallets, walletUrl,
  type TokenScanner, type TokenSettings, type WalletRow,
} from '@/hooks/useFestival';
import { formatCurrency } from '@/lib/utils';
import { WALLET_STATUS_VARIANT } from '@/lib/orderTickets';

export default function EventTokens() {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const { data: settings } = useTokenSettings();
  const plural = settings?.token_name_plural || 'munten';

  return (
    <div className="space-y-4">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t('events.venues.back_to_events')}
      </Link>
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Coins className="h-5 w-5" /> {k('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{k('subtitle')}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full overflow-x-auto justify-start">
          <TabsTrigger value="overview">{k('tab_overview')}</TabsTrigger>
          <TabsTrigger value="bars">{k('tab_bars')}</TabsTrigger>
          <TabsTrigger value="wallets">{k('tab_wallets')}</TabsTrigger>
          <TabsTrigger value="settings">{k('tab_settings')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4"><Overview plural={plural} /></TabsContent>
        <TabsContent value="bars" className="space-y-4"><Bars /></TabsContent>
        <TabsContent value="wallets" className="space-y-4"><Wallets plural={plural} /></TabsContent>
        <TabsContent value="settings" className="space-y-4">{settings && <SettingsForm initial={settings} />}</TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Overview({ plural }: { plural: string }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const { data: stats } = useTokenStats();
  const { data: packs, isLoading } = useTokenPacks();
  const create = useCreateTokenPack();
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState('10');
  const [price, setPrice] = useState('30');
  const [name, setName] = useState('');

  const tokNum = parseInt(tokens, 10);
  const priceNum = Number(price.replace(',', '.'));
  const valid = tokNum > 0 && tokNum <= 1000 && Number.isFinite(priceNum) && priceNum > 0;
  const autoName = k('pack_default_name', { count: tokNum || 0, plural });

  const submit = async () => {
    if (!valid) return;
    try {
      await create.mutateAsync({ name: name.trim() || autoName, price: priceNum, tokens: tokNum, description: k('pack_default_description', { plural }) });
      toast.success(k('pack_created'));
      setOpen(false); setName('');
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'limit' ? t('events.bundles.limit') : k('pack_failed'));
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={k('stat_sold', { plural })} value={stats?.sold ?? '–'} />
        <Stat label={k('stat_spent')} value={stats?.spent ?? '–'} />
        <Stat label={k('stat_outstanding')} value={stats?.outstanding ?? '–'} />
        <Stat label={k('stat_wallets')} value={stats?.wallets ?? '–'} />
      </div>
      {!!stats?.refund_requests && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>{k('refund_requests', { count: stats.refund_requests })}</span>
            <Button size="sm" variant="outline" asChild><Link to="/admin/returns">{k('to_returns')}</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">{k('packs_title')}</CardTitle>
            <CardDescription>{k('packs_hint', { plural })}</CardDescription>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{k('new_pack')}</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !packs?.length ? (
            <p className="text-sm text-muted-foreground">{k('no_packs')}</p>
          ) : (
            <ul className="divide-y">
              {packs.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                    <span>{p.token_amount} × · {formatCurrency(p.price)}</span>
                    <span className="hidden sm:inline">{formatCurrency(p.price / p.token_amount)} / {k('per_token')}</span>
                    {(!p.is_active || p.hidden) && <Badge variant="secondary">{k('not_on_sale')}</Badge>}
                    <Link to={`/admin/products/${p.id}/edit`} className="text-primary hover:underline">{k('edit')}</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{k('new_pack')}</DialogTitle>
            <DialogDescription>{k('new_pack_hint')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pack-tokens">{k('pack_tokens', { plural })}</Label>
              <Input id="pack-tokens" inputMode="numeric" value={tokens} onChange={(e) => setTokens(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-price">{k('pack_price')}</Label>
              <Input id="pack-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="pack-name">{k('pack_name')}</Label>
              <Input id="pack-name" value={name} placeholder={autoName} onChange={(e) => setName(e.target.value)} />
            </div>
            {valid && <p className="col-span-2 text-xs text-muted-foreground">{k('pack_unit', { price: formatCurrency(priceNum / tokNum) })}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button disabled={!valid || create.isPending} onClick={() => void submit()}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('create_pack')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Bars() {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const { data: bars, isLoading } = useTokenScanners();
  const create = useCreateTokenScanner();
  const toggle = useToggleTokenScanner();
  const [name, setName] = useState('');
  const [qr, setQr] = useState<TokenScanner | null>(null);
  const [copied, setCopied] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    try {
      const bar = await create.mutateAsync(name);
      setName('');
      setQr(bar);
    } catch { toast.error(k('bar_failed')); }
  };

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* geen klembord */ }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k('bars_title')}</CardTitle>
          <CardDescription>{k('bars_hint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={name} placeholder={k('bar_name_placeholder')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
            <Button disabled={!name.trim() || create.isPending} onClick={() => void add()}><Plus className="mr-1 h-4 w-4" />{k('add_bar')}</Button>
          </div>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !bars?.length ? (
            <p className="text-sm text-muted-foreground">{k('no_bars')}</p>
          ) : (
            <ul className="divide-y">
              {bars.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {k('bar_uses', { count: b.use_count })}
                      {b.last_used_at ? ` · ${k('bar_last', { time: new Date(b.last_used_at).toLocaleString() })}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={b.is_active} onCheckedChange={(v) => toggle.mutate({ id: b.id, is_active: v })} aria-label={k('bar_active')} />
                    <Button size="sm" variant="outline" disabled={!b.is_active} onClick={() => setQr(b)}><QrCode className="mr-1 h-4 w-4" />{k('show_link')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!qr} onOpenChange={(o) => { if (!o) { setQr(null); setCopied(false); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{qr?.name}</DialogTitle>
            <DialogDescription>{k('qr_hint')}</DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="space-y-3">
              <div className="flex justify-center rounded-lg bg-white p-4"><QRCode value={barUrl(qr.access_token)} size={200} /></div>
              <p className="break-all rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">{barUrl(qr.access_token)}</p>
              <p className="text-xs text-muted-foreground">{k('qr_secret')}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            {qr && <Button variant="outline" asChild><a href={barUrl(qr.access_token)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />{k('open')}</a></Button>}
            {qr && (
              <Button onClick={() => void copy(barUrl(qr.access_token))}>
                {copied ? <><Check className="mr-1 h-4 w-4" />{k('copied')}</> : <><Copy className="mr-1 h-4 w-4" />{k('copy')}</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// EVENT-409-1: één bron voor de kaartkleuren, gedeeld met de orderdetail (OrderTicketsCard).
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = WALLET_STATUS_VARIANT;

function Wallets({ plural }: { plural: string }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const [q, setQ] = useState('');
  const { data: wallets, isLoading } = useWallets(q);
  const block = useSetWalletBlocked();
  const [adjusting, setAdjusting] = useState<WalletRow | null>(null);

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} placeholder={k('search_placeholder')} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : !wallets?.length ? (
        <p className="text-sm text-muted-foreground">{q.trim() ? k('no_results') : k('no_wallets', { plural })}</p>
      ) : (
        <div className="space-y-2">
          {wallets.map((w) => (
            <Card key={w.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium break-words">{w.customer_name || w.customer_email || k('anonymous')}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {w.order_number ? `#${w.order_number} · ` : ''}{w.code.slice(0, 8)}…
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums">{w.balance} / {w.purchased}</span>
                  <Badge variant={STATUS_VARIANT[w.status] ?? 'secondary'}>{k(`status_${w.status}`)}</Badge>
                  {w.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => setAdjusting(w)}><RotateCcw className="mr-1 h-4 w-4" />{k('adjust')}</Button>
                  )}
                  {(w.status === 'active' || w.status === 'blocked') && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => block.mutate({ walletId: w.id, blocked: w.status === 'active' }, { onError: () => toast.error(k('save_failed')) })}
                    >
                      {w.status === 'active' ? <><Ban className="mr-1 h-4 w-4" />{k('block')}</> : <><Undo2 className="mr-1 h-4 w-4" />{k('unblock')}</>}
                    </Button>
                  )}
                  {w.return_id && <Button size="sm" variant="ghost" asChild><Link to={`/admin/returns/${w.return_id}`}>{k('view_return')}</Link></Button>}
                  <Button size="sm" variant="ghost" asChild><a href={walletUrl(w.code)} target="_blank" rel="noreferrer" aria-label={k('open')}><ExternalLink className="h-4 w-4" /></a></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AdjustDialog wallet={adjusting} onClose={() => setAdjusting(null)} plural={plural} />
    </>
  );
}

function AdjustDialog({ wallet, onClose, plural }: { wallet: WalletRow | null; onClose: () => void; plural: string }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const adjust = useAdjustWallet();
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const d = parseInt(delta, 10);
  const valid = !!wallet && Number.isInteger(d) && d !== 0 && wallet.balance + d >= 0 && note.trim().length > 2;

  const submit = async () => {
    if (!wallet || !valid) return;
    try {
      await adjust.mutateAsync({ walletId: wallet.id, delta: d, note });
      toast.success(k('adjusted'));
      setDelta(''); setNote(''); onClose();
    } catch { toast.error(k('save_failed')); }
  };

  return (
    <Dialog open={!!wallet} onOpenChange={(o) => { if (!o) { setDelta(''); setNote(''); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{k('adjust_title')}</DialogTitle>
          <DialogDescription>{k('adjust_hint', { balance: wallet?.balance ?? 0, plural })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-delta">{k('adjust_delta')}</Label>
            <Input id="adj-delta" inputMode="numeric" placeholder="+2 / -1" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">{k('adjust_note')}</Label>
            <Input id="adj-note" value={note} placeholder={k('adjust_note_placeholder')} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!valid || adjust.isPending} onClick={() => void submit()}>
            {adjust.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ISO → waarde voor een datetime-local-veld, in de tijdzone van de browser. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function SettingsForm({ initial }: { initial: TokenSettings }) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`events.tokens.${x}`, o);
  const save = useSaveTokenSettings();
  const [s, setS] = useState<TokenSettings>(initial);
  const [fee, setFee] = useState(String(initial.refund_fee ?? 0));
  const until = s.refund_until ? toLocalInput(s.refund_until) : '';

  const submit = async () => {
    const feeNum = Number(fee.replace(',', '.'));
    if (!s.token_name.trim() || !s.token_name_plural.trim() || !Number.isFinite(feeNum) || feeNum < 0) { toast.error(k('settings_invalid')); return; }
    try {
      await save.mutateAsync({ ...s, token_name: s.token_name.trim(), token_name_plural: s.token_name_plural.trim(), refund_fee: feeNum });
      toast.success(k('settings_saved'));
    } catch { toast.error(k('save_failed')); }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tok-name">{k('token_name')}</Label>
            <Input id="tok-name" value={s.token_name} onChange={(e) => setS({ ...s, token_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tok-plural">{k('token_name_plural')}</Label>
            <Input id="tok-plural" value={s.token_name_plural} onChange={(e) => setS({ ...s, token_name_plural: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{k('token_name_hint')}</p>
        <div className="space-y-3 border-t pt-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={s.refund_enabled} onCheckedChange={(v) => setS({ ...s, refund_enabled: v })} />
            {k('refund_enabled')}
          </label>
          <p className="text-xs text-muted-foreground">{k('refund_hint')}</p>
          {s.refund_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tok-until">{k('refund_until')}</Label>
                <Input id="tok-until" type="datetime-local" value={until} onChange={(e) => setS({ ...s, refund_until: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tok-fee">{k('refund_fee')}</Label>
                <Input id="tok-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <Button disabled={save.isPending} onClick={() => void submit()}>
          {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{k('save')}
        </Button>
      </CardContent>
    </Card>
  );
}
