// HORECA-0 — nooit meer een wit scherm zonder dat wij het weten.
//
// Twee dingen:
// 1. Een kruimelspoor van de laatste 50 handelingen (routewissels en aangetikte knoppen),
//    zodat we bij een crash zien wat de gebruiker net deed.
// 2. reportClientError(): schrijft een fout naar public.client_errors (RLS: enkel de eigen
//    rij invoegen, lezen enkel platform-admin). Mag nooit zelf een fout gooien.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

type Crumb = { t: string; kind: 'route' | 'tap'; what: string };
const MAX_CRUMBS = 50;
const crumbs: Crumb[] = [];

function push(kind: Crumb['kind'], what: string) {
  crumbs.push({ t: new Date().toISOString(), kind, what: what.slice(0, 120) });
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

export function recordRoute(path: string) {
  push('route', path);
}

let tapListener = false;
/** Eén keer opzetten: noteert de tekst of aria-label van aangetikte knoppen en links. */
export function startTapCrumbs() {
  if (tapListener || typeof document === 'undefined') return;
  tapListener = true;
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button,a,[role="button"],[role="tab"],[role="menuitem"]');
    if (!el) return;
    const label = el.getAttribute('aria-label') || (el.textContent || '').trim() || el.getAttribute('href') || el.tagName;
    push('tap', label);
  }, { capture: true, passive: true });
}

/** Vingerafdruk van de gebouwde bundel (index-<hash>.js), zodat we weten welke versie crashte. */
function buildId(): string {
  if (typeof document === 'undefined') return 'ssr';
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s?.src.split('/').pop() || 'dev';
}

export interface ClientErrorInput {
  error: unknown;
  componentStack?: string | null;
  source: 'boundary' | 'chunk' | 'unhandled';
  tenantId?: string | null;
}

export async function reportClientError({ error, componentStack, source, tenantId }: ClientErrorInput): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const { data } = await supabase.auth.getUser();
    if (!data.user) return; // RLS laat enkel ingelogde gebruikers schrijven; publieke pagina's loggen we niet.
    await supabase.from('client_errors' as never).insert({
      user_id: data.user.id,
      tenant_id: tenantId ?? null,
      source,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      build: buildId(),
      platform: Capacitor.getPlatform(),
      message: err.message.slice(0, 1000),
      stack: (err.stack || '').slice(0, 8000),
      component_stack: (componentStack || '').slice(0, 8000) || null,
      crumbs: [...crumbs],
    } as never);
  } catch {
    // Loggen mag nooit zelf iets breken.
  }
}

const RELOAD_FLAG = 'sq_chunk_reload_at';

/**
 * Na een nieuwe deploy bestaan de oude JS-stukken niet meer. Een open tabblad of app die
 * een nieuw scherm opent, krijgt dan "Failed to fetch dynamically imported module". Eén
 * keer automatisch herladen lost dat op; een tweede keer binnen een minuut niet meer
 * (dan is er iets anders mis en toont de foutvanger zijn scherm).
 */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(msg);
}

export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage niet beschikbaar: toch één keer proberen.
  }
  window.location.reload();
  return true;
}

let globalHandlers = false;
/** Eén keer opzetten in main.tsx. */
export function installGlobalErrorHandlers() {
  if (globalHandlers || typeof window === 'undefined') return;
  globalHandlers = true;
  startTapCrumbs();
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (!reloadOnceForChunkError()) void reportClientError({ error: (event as Event & { payload?: unknown }).payload ?? 'vite:preloadError', source: 'chunk' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      if (reloadOnceForChunkError()) return;
    }
    void reportClientError({ error: event.reason, source: 'unhandled' });
  });
}
