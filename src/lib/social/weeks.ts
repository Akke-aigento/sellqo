// SOCIAL-WEEKS-1 — welke week is het, en vraagt ze actie? (Social planning)

import { addWeeks, startOfWeek } from 'date-fns';
import type { PlannerWeek } from '@/hooks/useSocialPlanner';

export type WeekKind = 'past' | 'this' | 'next' | 'later';

export function weekKind(weekStart: string, now = new Date()): WeekKind {
  const current = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const start = new Date(weekStart).getTime();
  if (start < current) return 'past';
  if (start === current) return 'this';
  if (start === addWeeks(current, 1).getTime()) return 'next';
  return 'later';
}

/** Vraagt deze week iets van jou? Dan staat ze standaard open. */
export function weekNeedsAction(week: PlannerWeek): boolean {
  return week.pendingIds.length > 0
    || week.posts.some((p) => p.status === 'failed' || p.status === 'regenerate_requested');
}
