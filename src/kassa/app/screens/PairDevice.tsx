// KASSA-ACCOUNT-1 — het toestel koppelen met de code of QR uit beheer (Kassa (POS) › Kassa's › Toestel koppelen).
// Vervangt het aanmelden met een SellQo-account: een kassatoestel heeft nooit meer de rechten van de eigenaar.
// KASSA-MOBIEL-1: terugknop naar beheer (niet in de aparte Kassa-app) en, als de eigenaar op dit toestel in beheer
// aangemeld is, "Dit toestel nu koppelen": zaak en kassa kiezen, één tik (geen code overtikken).
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Link2, Loader2, X } from 'lucide-react';
import { deviceUuidForPairing } from '../runtime';
import { PAIR_PARAM, parsePairInput, type PairError } from '../setup';
import { pairThisDevice, pairWithAdminSession, type QuickPairError } from '../deviceAccount';
import { useAdminPairTargets, type PairTarget } from '../useAdminPairTargets';
import { BackToAdmin } from './BackToAdmin';

const SCAN_ID = 'kassa-pair-scan';

/** Camera met html5-qrcode (zoals de deurscanner); enkel zolang het venster open is. */
function QrScan({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    let scanner: { stop: () => Promise<void>; isScanning?: boolean } | null = null;
    let alive = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!alive) return;
        const s = new Html5Qrcode(SCAN_ID);
        scanner = s;
        await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
          if (done.current) return;
          done.current = true;
          onCode(text);
        }, () => { /* geen QR in beeld */ });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (scanner?.isScanning !== false) void scanner?.stop().catch(() => { /* al gestopt */ });
    };
  }, [onCode]);
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('kassa.pair.scanTitle')}</span>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md border" aria-label={t('kassa.common.cancel')}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div id={SCAN_ID} className="aspect-square w-full overflow-hidden rounded-lg bg-black" />
      {failed && <p role="alert" className="text-sm text-destructive">{t('kassa.pair.cameraFailed')}</p>}
    </div>
  );
}

const selectCls = 'h-12 w-full rounded-md border bg-background px-3 text-base';

/** Eén tik koppelen met de beheer-sessie van dit toestel (enkel tenant_admin). */
function QuickPair({ email, targets, disabled, onBusy }: { email: string | null; targets: PairTarget[]; disabled: boolean; onBusy: (b: boolean) => void }) {
  const { t } = useTranslation();
  const [tenantId, setTenantId] = useState(targets[0].tenantId);
  const target = targets.find((x) => x.tenantId === tenantId) ?? targets[0];
  const [terminalId, setTerminalId] = useState(target.terminals[0].id);
  const terminal = target.terminals.find((x) => x.id === terminalId) ?? target.terminals[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<QuickPairError | null>(null);
  const go = async () => {
    setBusy(true); onBusy(true); setError(null);
    const r = await pairWithAdminSession(target.tenantId, terminal.id, deviceUuidForPairing());
    // Gelukt: de kassa-sessie wisselt en KassaApp laadt de toestelcontext; dit scherm verdwijnt vanzelf.
    if ('error' in r) { setBusy(false); onBusy(false); setError(r.error); }
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="kassa-quick-pair">
      <div className="space-y-1">
        <h2 id="kassa-quick-pair" className="font-semibold">{t('kassa.pair.quick.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('kassa.pair.quick.intro', { email: email ?? '' })}</p>
      </div>
      {targets.length > 1 && (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t('kassa.pair.quick.shop')}</span>
          <select className={selectCls} value={target.tenantId} disabled={busy}
            onChange={(e) => { const next = targets.find((x) => x.tenantId === e.target.value); setTenantId(e.target.value); if (next) setTerminalId(next.terminals[0].id); setError(null); }}>
            {targets.map((x) => <option key={x.tenantId} value={x.tenantId}>{x.tenantName}</option>)}
          </select>
        </label>
      )}
      {target.terminals.length > 1 ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t('kassa.pair.quick.terminal')}</span>
          <select className={selectCls} value={terminal.id} disabled={busy} onChange={(e) => { setTerminalId(e.target.value); setError(null); }}>
            {target.terminals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="text-sm">{t('kassa.pair.quick.single', { shop: target.tenantName, terminal: terminal.name })}</p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{t(error === 'not_allowed' ? 'kassa.pair.quick.notAllowed' : `kassa.pair.error.${error}`)}</p>}
      <button type="button" onClick={() => void go()} disabled={busy || disabled}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : <><Link2 className="h-5 w-5" aria-hidden />{t('kassa.pair.quick.submit')}</>}
      </button>
    </section>
  );
}

export function PairDevice({ hasAdmin }: { hasAdmin: boolean }) {
  const { t } = useTranslation();
  const admin = useAdminPairTargets();
  const quick = hasAdmin && admin.targets.length > 0;
  const [quickBusy, setQuickBusy] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PairError | 'format' | null>(null);
  const [scanning, setScanning] = useState(false);
  const autoTried = useRef(false);

  const submit = useCallback(async (raw: string) => {
    const secret = parsePairInput(raw);
    if (!secret) { setError('format'); return; }
    setBusy(true); setError(null); setScanning(false);
    const r = await pairThisDevice(secret, deviceUuidForPairing());
    // Gelukt: de sessie wisselt, KassaApp laadt de toestelcontext. Dit scherm verdwijnt vanzelf.
    if ('error' in r) { setBusy(false); setError(r.error); }
  }, []);

  // QR met de gewone camera gescand: /kassa?koppel=<token> → één keer automatisch koppelen.
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get(PAIR_PARAM);
    if (!token) return;
    url.searchParams.delete(PAIR_PARAM);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    void submit(`?${PAIR_PARAM}=${token}`);
  }, [submit]);

  const onScan = useCallback((text: string) => { void submit(text); }, [submit]);
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void submit(value); };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6" style={{ paddingTop: 'max(1.5rem, var(--safe-top))' }}>
      {hasAdmin && <BackToAdmin />}
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t('kassa.pair.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('kassa.pair.intro')}</p>
      </div>
      {quick && (
        <>
          <QuickPair email={admin.email} targets={admin.targets} disabled={busy} onBusy={setQuickBusy} />
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('kassa.pair.orCode')}</p>
        </>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('kassa.pair.codeLabel')}</span>
          <input value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} inputMode="numeric" autoComplete="one-time-code"
            autoFocus={!quick && !admin.loading} maxLength={80} placeholder="123 456"
            className="h-14 w-full rounded-md border bg-background px-3 text-center font-mono text-2xl tracking-[0.3em]" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{t(`kassa.pair.error.${error}`)}</p>}
        <button type="submit" disabled={busy || quickBusy || !value.trim()}
          className="flex h-12 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : t('kassa.pair.submit')}
        </button>
      </form>
      {scanning ? <QrScan onCode={onScan} onClose={() => setScanning(false)} /> : (
        <button type="button" onClick={() => { setError(null); setScanning(true); }} disabled={busy || quickBusy}
          className="flex h-12 items-center justify-center gap-2 rounded-md border font-semibold disabled:opacity-50">
          <Camera className="h-5 w-5" />{t('kassa.pair.scan')}
        </button>
      )}
      <p className="text-xs text-muted-foreground">{t('kassa.pair.whereHint')}</p>
    </div>
  );
}
