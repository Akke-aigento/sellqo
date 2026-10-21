// DASH-2b — afgeleide cijfers voor de cockpit: vandaag per uur tegenover dezelfde weekdag
// vorige week, reeksen, records, de drukte per kwartier en het maanddoel. Puur (geen
// supabase, geen i18n): alles rekent op de Sale-lijst uit cockpitRevenue.toSales, dus
// dezelfde omzetdefinitie als de rest van de cockpit. Alle tijden in LOKALE tijd.
import { addDays, differenceInCalendarDays, endOfMonth, format, getDay, startOfDay, subDays } from 'date-fns';
import type { Sale } from '@/lib/cockpitRevenue';

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** Minuten sinds middernacht (lokaal). */
const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

function salesOnDay(sales: Sale[], day: Date): Sale[] {
  const from = startOfDay(day).getTime();
  const to = addDays(startOfDay(day), 1).getTime();
  return sales.filter((s) => s.at >= from && s.at < to);
}

// ---------------------------------------------------------------- vandaag per uur

export interface HourlyCompare {
  /** Eerste en laatste uur van de grafiek (inclusief). */
  startHour: number;
  endHour: number;
  /** Cumulatieve omzet vóór h:00 voor elk uur h = startHour..endHour; vandaag enkel t.e.m. het huidige uur. */
  today: number[];
  lastWeek: number[];
  /** Positie van "nu" in uren (bv. 14.5 = 14:30). */
  nowHour: number;
  todaySoFar: number;
  /** Omzet vorige week op dezelfde weekdag tot hetzelfde tijdstip. */
  lastWeekSameTime: number;
  /** null als er vorige week op dit tijdstip niets verkocht was. */
  changePct: number | null;
  todayCount: number;
}

/**
 * Vandaag tegenover dezelfde weekdag 7 dagen geleden, tot hetzelfde tijdstip.
 * Het uurbereik volgt de verkoop (vroegste tot laatste uur van beide dagen), minstens 8–20 u.
 */
export function hourlyCompare(sales: Sale[], now: Date): HourlyCompare {
  const today = salesOnDay(sales, now);
  const lastWeekDay = subDays(now, 7);
  const lastWeek = salesOnDay(sales, lastWeekDay);

  const hours = [...today, ...lastWeek].map((s) => new Date(s.at).getHours());
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const startHour = Math.min(8, Math.floor(nowHour), ...hours);
  const endHour = Math.max(20, Math.ceil(nowHour), ...hours.map((h) => h + 1));

  const cumulative = (list: Sale[], until: number) => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      if (h > until) break;
      const limit = h * 60;
      out.push(round2(list.filter((s) => minuteOfDay(new Date(s.at)) < limit).reduce((n, s) => n + s.amount, 0)));
    }
    return out;
  };

  const nowMinute = minuteOfDay(now);
  const todaySoFar = round2(today.reduce((n, s) => n + s.amount, 0));
  const lastWeekSameTime = round2(
    lastWeek.filter((s) => minuteOfDay(new Date(s.at)) <= nowMinute).reduce((n, s) => n + s.amount, 0),
  );

  return {
    startHour,
    endHour,
    today: cumulative(today, Math.floor(nowHour)),
    lastWeek: cumulative(lastWeek, endHour),
    nowHour,
    todaySoFar,
    lastWeekSameTime,
    changePct: lastWeekSameTime > 0 ? Math.round(((todaySoFar - lastWeekSameTime) / lastWeekSameTime) * 100) : null,
    todayCount: today.length,
  };
}

// ---------------------------------------------------------------- reeksen en records

/**
 * Aantal dagen op rij met minstens één verkoop, eindigend vandaag (als er vandaag al iets
 * verkocht is) of gisteren (zo breekt de reeks niet 's ochtends vroeg).
 */
export function salesStreak(sales: Sale[], now: Date): number {
  const days = new Set(sales.map((s) => dayKey(new Date(s.at))));
  let cursor = days.has(dayKey(now)) ? startOfDay(now) : subDays(startOfDay(now), 1);
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    cursor = subDays(cursor, 1);
  }
  return n;
}

export interface DayRecord {
  date: Date;
  revenue: number;
}

/** Omzet per kalenderdag (lokaal). */
export function dailyTotals(sales: Sale[]): Map<string, DayRecord> {
  const map = new Map<string, DayRecord>();
  for (const s of sales) {
    const d = startOfDay(new Date(s.at));
    const k = dayKey(d);
    const row = map.get(k) ?? { date: d, revenue: 0 };
    row.revenue += s.amount;
    map.set(k, row);
  }
  for (const r of map.values()) r.revenue = round2(r.revenue);
  return map;
}

export interface CockpitRecords {
  /** Beste dag met dezelfde weekdag als vandaag, vandaag niet meegerekend. */
  bestSameWeekday: DayRecord | null;
  /** Een dag uit de laatste 7 dagen (vandaag niet) die de beste ooit was voor zijn weekdag. */
  recentWeekdayRecord: DayRecord | null;
  /** Hoeveel er vandaag nog nodig is om het weekdagrecord te breken (0 = al gebroken). */
  toBeatSameWeekday: number | null;
}

/**
 * Records binnen de opgehaalde geschiedenis. Een record telt pas met minstens 3 eerdere
 * dagen van die weekdag, anders is "de beste maandag ooit" na twee maandagen loze praat.
 */
export function cockpitRecords(sales: Sale[], now: Date, todayRevenue: number): CockpitRecords {
  const totals = [...dailyTotals(sales).values()];
  const todayKey = dayKey(now);
  const past = totals.filter((r) => dayKey(r.date) !== todayKey);

  const bestOf = (weekday: number, before: Date) => {
    const pool = past.filter((r) => getDay(r.date) === weekday && r.date < before);
    if (pool.length < 3) return null;
    return pool.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  };

  const weekday = getDay(now);
  const sameWeekdayPool = past.filter((r) => getDay(r.date) === weekday);
  const bestSameWeekday =
    sameWeekdayPool.length >= 3 ? sameWeekdayPool.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

  // Recentste dag van de laatste week die zijn weekdag-record vestigde.
  let recentWeekdayRecord: DayRecord | null = null;
  for (let i = 1; i <= 6 && !recentWeekdayRecord; i++) {
    const day = startOfDay(subDays(now, i));
    const rec = past.find((r) => dayKey(r.date) === dayKey(day));
    if (!rec || rec.revenue <= 0) continue;
    const earlier = bestOf(getDay(day), day);
    if (earlier && rec.revenue > earlier.revenue) recentWeekdayRecord = rec;
  }

  return {
    bestSameWeekday,
    recentWeekdayRecord,
    toBeatSameWeekday: bestSameWeekday ? Math.max(0, round2(bestSameWeekday.revenue - todayRevenue)) : null,
  };
}

// ---------------------------------------------------------------- drukte per kwartier

export interface RushBucket {
  /** Start van het kwartier in minuten sinds middernacht. */
  minute: number;
  /** Verkopen vandaag in dit kwartier; null voor kwartieren die nog moeten komen. */
  today: number | null;
  /** Gemiddeld aantal verkopen op dezelfde weekdag de laatste weken. */
  expected: number;
}

export interface RushForecast {
  buckets: RushBucket[];
  /** Drukste uur (4 kwartieren) volgens het gemiddelde; null zonder geschiedenis. */
  peakStartMinute: number | null;
  /** Aantal weken waarop het gemiddelde rust (0–4). */
  weeks: number;
}

/**
 * Verkopen per kwartier vandaag, naast het gemiddelde van dezelfde weekdag de vorige 4 weken
 * (alleen weken waarop er die dag iets verkocht werd). Bereik: van het eerste tot het laatste
 * kwartier met verkoop, aangevuld tot "nu".
 */
export function rushForecast(sales: Sale[], now: Date): RushForecast {
  const bucketOf = (s: Sale) => Math.floor(minuteOfDay(new Date(s.at)) / 15);
  const todayCounts = new Array(96).fill(0);
  for (const s of salesOnDay(sales, now)) todayCounts[bucketOf(s)] += 1;

  const sum = new Array(96).fill(0);
  let weeks = 0;
  for (let w = 1; w <= 4; w++) {
    const day = salesOnDay(sales, subDays(now, 7 * w));
    if (!day.length) continue;
    weeks += 1;
    for (const s of day) sum[bucketOf(s)] += 1;
  }
  const expected = sum.map((n) => (weeks ? n / weeks : 0));

  const nowBucket = Math.floor(minuteOfDay(now) / 15);
  const active = expected.map((e, i) => e > 0 || todayCounts[i] > 0);
  let first = active.indexOf(true);
  let last = active.lastIndexOf(true);
  if (first === -1) {
    first = nowBucket;
    last = nowBucket;
  }
  first = Math.min(first, nowBucket);
  last = Math.max(last, nowBucket);

  const buckets: RushBucket[] = [];
  for (let i = first; i <= last; i++) {
    buckets.push({
      minute: i * 15,
      today: i <= nowBucket ? todayCounts[i] : null,
      expected: Math.round(expected[i] * 10) / 10,
    });
  }

  let peakStartMinute: number | null = null;
  if (weeks > 0) {
    let best = -1;
    for (let i = 0; i + 4 <= 96; i++) {
      const v = expected[i] + expected[i + 1] + expected[i + 2] + expected[i + 3];
      if (v > best) {
        best = v;
        peakStartMinute = i * 15;
      }
    }
    if (best <= 0) peakStartMinute = null;
  }

  return { buckets, peakStartMinute, weeks };
}

// ---------------------------------------------------------------- maanddoel

export interface GoalProgress {
  goal: number;
  achieved: number;
  /** 0–100, afgerond; kan boven 100 gaan. */
  pct: number;
  remaining: number;
  /** Dagen die overblijven, vandaag inbegrepen. */
  daysLeft: number;
  /** Nodig per resterende dag (0 als het doel gehaald is). */
  perDay: number;
}

export function goalProgress(goal: number, achieved: number, now: Date): GoalProgress {
  const remaining = Math.max(0, round2(goal - achieved));
  const daysLeft = differenceInCalendarDays(endOfMonth(now), now) + 1;
  return {
    goal,
    achieved,
    pct: goal > 0 ? Math.round((achieved / goal) * 100) : 0,
    remaining,
    daysLeft,
    perDay: remaining > 0 ? Math.ceil(remaining / daysLeft) : 0,
  };
}
