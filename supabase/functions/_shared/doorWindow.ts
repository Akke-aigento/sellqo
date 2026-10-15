// EVENT-SCAN-2 — het scanvenster: wanneer is een event "live" aan de deur?
//
// Kernidee: het ticket zégt het event; de deur bewaakt alleen dat het NU klopt.
// Het venster rekent op de eigen uren van het event (tijdzone van het event,
// middernacht-veilig: een crawl 21:00→03:00 is één venster, de kalenderdag doet
// er niet toe). Regels (Akke, 15-10-2026):
//   - standaard 60 min vóór start tot 60 min na einde, per tenant instelbaar;
//   - geen eindtijd → start + 6 uur als rekeneinde (instelbaar);
//   - per tickettype overschrijfbaar via event_ticket_types.valid_from/valid_until.

export interface ScanWindowSettings {
  open_before_minutes: number;
  close_after_minutes: number;
  no_end_fallback_hours: number;
}

export const DEFAULT_SCAN_WINDOW: ScanWindowSettings = {
  open_before_minutes: 60,
  close_after_minutes: 60,
  no_end_fallback_hours: 6,
};

export interface WindowEvent {
  event_date: string;            // YYYY-MM-DD
  start_time: string | null;     // HH:MM[:SS]
  end_time: string | null;
  timezone?: string | null;
}

/** Epoch (ms) van een wandkloktijd in een tijdzone. Benadering via Intl — alleen
 *  in het exacte DST-omschakeluur een uur onzeker, en de marges zijn toch ±1u. */
export function zonedEpoch(dateStr: string, timeStr: string, timeZone: string): number {
  const naive = Date.parse(`${dateStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}Z`);
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const p = Object.fromEntries(fmt.formatToParts(new Date(naive)).map((x) => [x.type, x.value]));
    const hour = p.hour === "24" ? "00" : p.hour;
    const asZone = Date.parse(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`);
    return naive - (asZone - naive);
  } catch {
    return naive; // onbekende tijdzone → UTC-benadering
  }
}

export interface ScanWindow {
  opensAt: number;
  closesAt: number;
  startsAt: number;
}

/** Het scanvenster van een event. typeOverride (valid_from/valid_until van het
 *  tickettype) wint van de berekende grenzen — dat dekt de camping-case. */
export function eventWindow(
  ev: WindowEvent,
  settings: ScanWindowSettings,
  typeOverride?: { valid_from?: string | null; valid_until?: string | null },
): ScanWindow {
  const tz = ev.timezone || "Europe/Brussels";
  const start = zonedEpoch(ev.event_date, ev.start_time || "00:00:00", tz);
  let end: number;
  if (ev.end_time) {
    end = zonedEpoch(ev.event_date, ev.end_time, tz);
    if (end <= start) end += 24 * 60 * 60 * 1000; // einde over middernacht
  } else {
    end = start + settings.no_end_fallback_hours * 60 * 60 * 1000;
  }
  let opensAt = start - settings.open_before_minutes * 60 * 1000;
  let closesAt = end + settings.close_after_minutes * 60 * 1000;
  if (typeOverride?.valid_from) {
    const t = Date.parse(typeOverride.valid_from);
    if (Number.isFinite(t)) opensAt = t;
  }
  if (typeOverride?.valid_until) {
    const t = Date.parse(typeOverride.valid_until);
    if (Number.isFinite(t)) closesAt = t;
  }
  return { opensAt, closesAt, startsAt: start };
}

export type WindowState = "live" | "early" | "late";

export function windowState(now: number, w: ScanWindow): WindowState {
  if (now < w.opensAt) return "early";
  if (now > w.closesAt) return "late";
  return "live";
}

interface DbEventRow {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  timezone?: string | null;
  status: string;
  location_name?: string | null;
}

/** Minimale supabase-vorm — bewust los (zelfde patroon als catalogFilters.SupabaseLike),
 *  zodat zowel de echte client als de testharnas erin past. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-client passepartout
export interface SupabaseLike { from(table: string): any }

export interface ResolvedDoor {
  /** Events waarvan het venster NU open staat, vroegste start eerst. */
  live: DbEventRow[];
  /** Eerstvolgende event als er niks live is (venster nog niet open). */
  next: DbEventRow | null;
}

/** Lopende en eerstvolgende events van een tenant, venster-gerekend.
 *  Datumbereik ±3 dagen rond vandaag dekt elke redelijke marge-instelling. */
export async function resolveDoor(
  admin: SupabaseLike,
  tenantId: string,
  settings: ScanWindowSettings,
  now = Date.now(),
): Promise<ResolvedDoor> {
  const day = 24 * 60 * 60 * 1000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const { data } = await admin
    .from("event_details")
    .select("id, event_date, start_time, end_time, timezone, status, location_name")
    .eq("tenant_id", tenantId)
    .in("status", ["scheduled", "confirmed"])
    .gte("event_date", iso(now - 3 * day))
    .lte("event_date", iso(now + 14 * day))
    .order("event_date", { ascending: true })
    .limit(100);
  const rows = ((data ?? []) as DbEventRow[]);
  const live = rows
    .filter((e) => windowState(now, eventWindow(e, settings)) === "live")
    .sort((a, b) => eventWindow(a, settings).startsAt - eventWindow(b, settings).startsAt);
  const next = live.length
    ? null
    : rows
      .filter((e) => windowState(now, eventWindow(e, settings)) === "early")
      .sort((a, b) => eventWindow(a, settings).startsAt - eventWindow(b, settings).startsAt)[0] ?? null;
  return { live, next };
}

/** Tenant-instellingen ophalen met platform-defaults als er geen rij is. */
export async function loadScanWindow(admin: SupabaseLike, tenantId: string): Promise<ScanWindowSettings> {
  try {
    const { data } = await admin
      .from("event_scan_settings")
      .select("open_before_minutes, close_after_minutes, no_end_fallback_hours")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return DEFAULT_SCAN_WINDOW;
    return {
      open_before_minutes: Number(data.open_before_minutes ?? 60),
      close_after_minutes: Number(data.close_after_minutes ?? 60),
      no_end_fallback_hours: Number(data.no_end_fallback_hours ?? 6),
    };
  } catch {
    return DEFAULT_SCAN_WINDOW;
  }
}
