// KASSA-ACCOUNT-1 — het toestel koppelen met de code of QR uit beheer (Kassa (POS) › Kassa's › Toestel koppelen).
// Vervangt het aanmelden met een SellQo-account: een kassatoestel heeft nooit meer de rechten van de eigenaar.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2, X } from 'lucide-react';
import { deviceUuidForPairing } from '../runtime';
import { PAIR_PARAM, parsePairInput, type PairError } from '../setup';
import { pairThisDevice } from '../deviceAccount';

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

export function PairDevice() {
  const { t } = useTranslation();
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
      <div className="space-y-1">
        <h1 className="text-xl font-bold">{t('kassa.pair.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('kassa.pair.intro')}</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('kassa.pair.codeLabel')}</span>
          <input value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} inputMode="numeric" autoComplete="one-time-code"
            autoFocus maxLength={80} placeholder="123 456"
            className="h-14 w-full rounded-md border bg-background px-3 text-center font-mono text-2xl tracking-[0.3em]" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{t(`kassa.pair.error.${error}`)}</p>}
        <button type="submit" disabled={busy || !value.trim()}
          className="flex h-12 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t('kassa.common.loading')} /> : t('kassa.pair.submit')}
        </button>
      </form>
      {scanning ? <QrScan onCode={onScan} onClose={() => setScanning(false)} /> : (
        <button type="button" onClick={() => { setError(null); setScanning(true); }} disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-md border font-semibold disabled:opacity-50">
          <Camera className="h-5 w-5" />{t('kassa.pair.scan')}
        </button>
      )}
      <p className="text-xs text-muted-foreground">{t('kassa.pair.whereHint')}</p>
    </div>
  );
}
