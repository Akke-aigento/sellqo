// NIGHT-QF-3: één bron voor de periode-presets van Rapporten. De picker en de
// snelknoppen op de pagina rekenden elk apart; nu delen ze deze functie en
// zijn de grenzen testbaar met een vaste `now`. Alles in lokale tijd:
// van 00:00:00.000 op de eerste dag t/m 23:59:59.999 op de laatste.
import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
} from 'date-fns';

export type ReportRangeType = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface ReportDateRange {
  from: Date;
  to: Date;
  type?: ReportRangeType;
}

export type ReportPresetKey =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year';

export const REPORT_PRESET_KEYS: readonly ReportPresetKey[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'last_quarter',
  'this_year',
  'last_year',
];

export function getReportPresetRange(key: ReportPresetKey, now: Date = new Date()): ReportDateRange {
  switch (key) {
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now), type: 'monthly' };
    case 'last_month': {
      const d = subMonths(now, 1);
      return { from: startOfMonth(d), to: endOfMonth(d), type: 'monthly' };
    }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now), type: 'quarterly' };
    case 'last_quarter': {
      const d = subQuarters(now, 1);
      return { from: startOfQuarter(d), to: endOfQuarter(d), type: 'quarterly' };
    }
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now), type: 'annual' };
    case 'last_year': {
      const d = subYears(now, 1);
      return { from: startOfYear(d), to: endOfYear(d), type: 'annual' };
    }
  }
}
