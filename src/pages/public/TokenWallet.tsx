// FEST-2 — de muntenkaart van een klant: /munten/:code (link in de ticketmail).
// Toont de QR voor aan de bar, het saldo en wat er afgeschreven is. Zijn er munten over
// en laat de winkel het toe, dan vraagt de klant hier de terugbetaling aan.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { Check, Coins, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

const CODE_RE = /^[a-f0-9]{40}$/;

interface WalletData {
  success: boolean;
  shop: { name: string | null; logo_url: string | null; primary_color: string | null; currency: string };
  token_name: string;
  token_name_plural: string;
  wallet: { name: string | null; order_number: string | null; purchased: number; balance: number; status: string; unit_value: number };
  refund: { enabled: boolean; open: boolean; until: string | null; fee: number; estimate: number; needs_iban: boolean };
  history: { delta: number; kind: string; balance_after: number; at: string }[];
}

const invoke = <T,>(body: Record<string, unknown>) =>
  supabase.functions.invoke('token-wallet', { body }).then(({ data, error }) => { if (error) throw error; return data as T; });

export default function TokenWallet() {
  const { code = '' } = useParams();
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`wallet.${x}`, o);
  const valid = CODE_RE.test(code);
  const [data, setData] = useState<WalletData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iban, setIban] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [refundMsg, setRefundMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!valid) { setFailed(true); return; }
    setLoading(true);
    try {
      const r = await invoke<WalletData>({ action: 'get', code });
      if (!r?.success) throw new Error('not_found');
      setData(r);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [code, valid]);

  useEffect(() => { void load(); }, [load]);

  const unit = (n: number) => (n === 1 ? data?.token_name ?? 'munt' : data?.token_name_plural ?? 'munten');
  const money = (n: number) => formatCurrency(n, data?.shop.currency || 'EUR');

  const requestRefund = async () => {
    setSending(true); setRefundMsg(null);
    try {
      const r = await invoke<{ success: boolean; reason?: string | null; amount?: number | null }>({ action: 'request_refund', code, iban: iban.trim() || undefined });
      if (r.success) {
        setRefundMsg({ ok: true, text: k('refund_requested', { amount: money(r.amount ?? 0) }) });
        setConfirm(false);
        void load();
      } else {
        setRefundMsg({ ok: false, text: k(`refund_error_${r.reason ?? 'generic'}`, { defaultValue: k('refund_error_generic') }) });
      }
    } catch { setRefundMsg({ ok: false, text: k('refund_error_generic') }); } finally { setSending(false); }
  };

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center">
        <TriangleAlert className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-semibold">{k('not_found_title')}</p>
        <p className="max-w-xs text-sm text-slate-500">{k('not_found_text')}</p>
      </div>
    );
  }
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const accent = data.shop.primary_color && /^#[0-9a-f]{6}$/i.test(data.shop.primary_color) ? data.shop.primary_color : '#0f172a';
  const w = data.wallet;
  const kindLabel = (kind: string) => k(`kind_${kind}`, { defaultValue: kind });
  const usable = w.status === 'active';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <header className="flex items-center gap-3">
          {data.shop.logo_url ? <img src={data.shop.logo_url} alt="" className="h-10 w-10 rounded-md bg-white object-contain p-0.5 shadow-sm" /> : <Coins className="h-9 w-9" style={{ color: accent }} />}
          <div className="min-w-0">
            <p className="truncate font-semibold">{data.shop.name}</p>
            <p className="truncate text-xs text-slate-500">{w.order_number ? k('order', { number: w.order_number }) : k('title', { plural: data.token_name_plural })}</p>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 text-center shadow-sm" style={{ borderTop: `6px solid ${accent}` }}>
          {w.name && <p className="text-sm text-slate-500">{k('hi', { name: w.name })}</p>}
          <p className="mt-1 text-6xl font-black tabular-nums">{w.balance}</p>
          <p className="text-sm text-slate-500">{k('of_total', { total: w.purchased, unit: unit(w.purchased) })}</p>
          {usable ? (
            <>
              <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3 ring-1 ring-slate-200"><QRCode value={code} size={210} /></div>
              <p className="mt-3 text-sm text-slate-600">{k('show_at_bar')}</p>
            </>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">{k(`status_${w.status}`)}</p>
          )}
          <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 underline">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {k('refresh')}
          </button>
        </section>

        {data.refund.enabled && w.status === 'active' && w.balance > 0 && (
          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-semibold">{k('refund_title', { plural: data.token_name_plural })}</p>
            {!data.refund.open ? (
              <p className="text-sm text-slate-500">{k('refund_closed')}</p>
            ) : data.refund.estimate <= 0 ? (
              <p className="text-sm text-slate-500">{k('refund_below_fee')}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  {k('refund_text', { balance: w.balance, unit: unit(w.balance), amount: money(data.refund.estimate) })}
                  {data.refund.fee > 0 ? ` ${k('refund_fee', { fee: money(data.refund.fee) })}` : ''}
                </p>
                {data.refund.until && <p className="text-xs text-slate-500">{k('refund_until', { date: new Date(data.refund.until).toLocaleString() })}</p>}
                <p className="text-xs text-slate-500">{data.refund.needs_iban ? k('refund_iban_hint') : k('refund_card_hint')}</p>
                {data.refund.needs_iban && (
                  <input
                    value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="BE.. .... .... ...."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" autoComplete="off"
                  />
                )}
                {!confirm ? (
                  <button
                    type="button" disabled={data.refund.needs_iban && iban.replace(/\s/g, '').length < 15}
                    onClick={() => setConfirm(true)}
                    className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40" style={{ background: accent }}
                  >{k('refund_button', { amount: money(data.refund.estimate) })}</button>
                ) : (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    <p className="text-sm">{k('refund_confirm', { plural: data.token_name_plural })}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-slate-300 py-2 text-sm">{k('cancel')}</button>
                      <button type="button" disabled={sending} onClick={() => void requestRefund()} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white" style={{ background: accent }}>
                        {sending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : k('refund_confirm_button')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {refundMsg && (
          <p className={`flex items-start gap-2 rounded-xl p-3 text-sm ${refundMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {refundMsg.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}{refundMsg.text}
          </p>
        )}

        {data.history.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="mb-2 font-semibold">{k('history')}</p>
            <ul className="divide-y divide-slate-100 text-sm">
              {data.history.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{kindLabel(h.kind)} <span className="text-slate-400">· {new Date(h.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
                  <span className={`shrink-0 font-semibold tabular-nums ${h.delta > 0 ? 'text-emerald-600' : ''}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-center text-xs text-slate-400">{k('powered')}</p>
      </div>
    </div>
  );
}
