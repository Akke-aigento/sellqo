// KASSA-0 — voert alle officiële use cases uit (A schema, B herbouw, C simulator, D rapporten)
// en geeft per stap het resultaat. Gebruikt door uc.test.ts en door het dekkingsrapport.
import { FdmSimulator } from '../../simulator/fdmSimulator';
import { validateMutation } from '../../schema';
import { turnoverReportParts, userReportParts, type SignedEvent } from '../../reports';
import { MUTATIONS, type ReportTurnoverXInput, type ReportUserXInput, type SignResult } from '../../types';
import { allDiffs, firstDiff, loadFixtures, normalize, officialResult, parseCalls, rebuild, type UcFixture } from './harness';

export type Check = 'schema' | 'rebuild' | 'simulator' | 'report' | 'status';
export interface StepResult { set: string; uc: string; step: string; mutation: string; check: Check; ok: boolean; detail?: string; diffs?: string[] }

const REPORTS = new Set(['signReportTurnoverX', 'signReportTurnoverZ', 'signReportUserX', 'signReportUserZ']);

/** Alle verschillen tussen ons rapport (uit het logboek) en het officiële. */
export function compareReport(name: string, official: ReportTurnoverXInput | ReportUserXInput, journal: SignedEvent[]): string[] {
  const diffs: string[] = [];
  if (name === 'signReportTurnoverX' || name === 'signReportTurnoverZ') {
    const ours = turnoverReportParts(journal);
    const o = official as ReportTurnoverXInput;
    for (const k of ['turnover', 'posDevices', 'fdmDevices'] as const) allDiffs(normalize(stripForCompare(ours[k], k)), normalize(stripForCompare(o[k], k)), k, diffs);
    return diffs;
  }
  const ours = userReportParts(journal);
  const o = official as ReportUserXInput;
  for (const k of ['users', 'posDevices', 'fdmDevices'] as const) allDiffs(normalize(stripForCompare(ours[k], k)), normalize(stripForCompare(o[k], k)), k, diffs);
  return diffs;
}

/**
 * Wat we in rapporten NIET vergelijken: fdmId/fdmDateTime (geanonimiseerd en door de
 * simulator anders ingevuld), en de vrije namen van betaalmiddelen (de officiële rapporten
 * gebruiken soms een andere naam dan de tickets, bv. CONTANT vs CASH).
 */
function stripForCompare(v: unknown, k: string): unknown {
  const clone = JSON.parse(JSON.stringify(v ?? null));
  if (k === 'fdmDevices') return (clone as Record<string, unknown>[]).map((x) => ({ firstTotalCounter: x.firstTotalCounter, lastTotalCounter: x.lastTotalCounter }));
  const dropPayNames = (pays: Record<string, unknown>[] | undefined) => pays?.forEach((p) => { delete p.name; });
  if (k === 'turnover') dropPayNames((clone as { payments?: Record<string, unknown>[] }).payments);
  if (k === 'users') (clone as { payments?: Record<string, unknown>[] }[]).forEach((u) => dropPayNames(u.payments));
  return clone;
}

export async function runUc(fx: UcFixture): Promise<StepResult[]> {
  const out: StepResult[] = [];
  // Eén FDM per use case. Tellers starten waar het officiële antwoord van de eerste stap
  // begon, zodat fdmDevices-tellers in de rapporten vergelijkbaar zijn.
  const isReportStep = (s: { step: string }) => /^Report\d|^M18\d/.test(s.step);
  const firstRef = fx.steps.filter((s) => !isReportStep(s)).flatMap((s) => parseCalls(s).map((c) => officialResult(s, c.alias))).find((r) => r && (r as { fdmRef?: unknown }).fdmRef) as unknown as SignResult | undefined;
  const sims = new Map<string, FdmSimulator>();
  const simFor = (fdmId: string | undefined) => {
    const id = fdmId ?? 'FOD01000001';
    let s = sims.get(id);
    if (!s) {
      s = new FdmSimulator({
        fdmId: id,
        counters: firstRef ? { total: firstRef.fdmRef.totalCounter - 1 } : {},
        footer: [],
      });
      sims.set(id, s);
    }
    return s;
  };
  const journal: SignedEvent[] = [];

  // Rapporten pas na de inputtickets (M184 staat alfabetisch vooraan).
  const steps = [...fx.steps].sort((a, b) => Number(isReportStep(a)) - Number(isReportStep(b)));
  for (const step of steps) {
    const calls = parseCalls(step);
    if (!calls.length && /\bstatus\s*\(/.test(step.query)) {
      // Status-query (EVT-15): zelfde vorm als het officiële antwoord, per alias.
      const res = await simFor(undefined).handleGraphQL({ query: step.query, variables: step.variables ?? {} });
      const official = (step.response as { data?: Record<string, unknown> } | null)?.data ?? {};
      const shape = (v: unknown): unknown => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])])) : Array.isArray(v) ? 'list' : typeof v);
      const d = firstDiff(Object.keys(res.data ?? {}).sort(), Object.keys(official).sort(), 'aliases')
        ?? Object.keys(official).map((k) => firstDiff(shape((res.data ?? {})[k]), shape(official[k]), k)).find(Boolean) ?? null;
      out.push({ set: fx.set, uc: fx.uc, step: step.step, mutation: 'status', check: 'status', ok: d === null, detail: d ?? undefined });
      continue;
    }
    for (const call of calls) {
      const base = { set: fx.set, uc: fx.uc, step: step.step, mutation: call.name };
      const official = officialResult(step, call.alias) as unknown as SignResult | null;

      // A — schema
      const problems = validateMutation(call.name, call.data);
      out.push({ ...base, check: 'schema', ok: problems.length === 0, detail: problems.slice(0, 3).join('; ') || undefined });

      // D — rapporten
      if (REPORTS.has(call.name)) {
        const d = compareReport(call.name, call.data as ReportTurnoverXInput, journal);
        out.push({ ...base, check: 'report', ok: d.length === 0, detail: d.join(' | ') || undefined, diffs: d });
        continue;
      }

      // B — herbouw
      let ours = null as ReturnType<typeof rebuild>;
      try {
        ours = rebuild(call.name, call.data);
        const diff = firstDiff(normalize(ours), normalize(call.data));
        out.push({ ...base, check: 'rebuild', ok: diff === null, detail: diff ?? undefined });
      } catch (e) {
        out.push({ ...base, check: 'rebuild', ok: false, detail: e instanceof Error ? e.message : String(e) });
      }

      // C — simulator (met het officiële bericht, zodat C los van B staat)
      const sim = simFor(official?.fdmRef?.fdmId);
      const res = await sim.sign(call.name, call.data, call.isTraining);
      if (!res.ok) {
        out.push({ ...base, check: 'simulator', ok: false, detail: res.errors.map((x) => x.message + ' ' + JSON.stringify(x.extensions.data ?? [])).join('; ') });
        continue;
      }
      journal.push({ name: call.name, isTraining: call.isTraining, data: call.data, result: res.result });
      if (!official) { out.push({ ...base, check: 'simulator', ok: true, detail: 'geen officieel antwoord' }); continue; }
      const expectLabel = call.isTraining ? 'T' : MUTATIONS[call.name].label;
      const problemsC: string[] = [];
      if (res.result.fdmRef.eventLabel !== official.fdmRef.eventLabel) problemsC.push(`label ${res.result.fdmRef.eventLabel} ≠ ${official.fdmRef.eventLabel}`);
      if (res.result.fdmRef.eventLabel !== expectLabel) problemsC.push(`label ${res.result.fdmRef.eventLabel} ≠ verwacht ${expectLabel}`);
      if (res.result.eventOperation !== official.eventOperation) problemsC.push(`operation ${res.result.eventOperation} ≠ ${official.eventOperation}`);
      // Volgorde van de labels is geen contract (UC220 wijkt af van de andere 36): vergelijk per label.
      const byLabel = (v: { label: string }[] | null | undefined) => [...(v ?? [])].sort((a, b) => a.label.localeCompare(b.label));
      const dv = firstDiff(normalize(byLabel(res.result.vatCalc)), normalize(byLabel(official.vatCalc)), 'vatCalc');
      if (dv) problemsC.push(dv);
      if (Boolean(res.result.verificationUrl) !== Boolean(official.verificationUrl)) problemsC.push('verificationUrl aanwezig ≠');
      if (Boolean(res.result.shortSignature) !== Boolean(official.shortSignature)) problemsC.push('shortSignature aanwezig ≠');
      out.push({ ...base, check: 'simulator', ok: problemsC.length === 0, detail: problemsC.join('; ') || undefined });
    }
  }
  return out;
}

export async function runAll(): Promise<StepResult[]> {
  const all: StepResult[] = [];
  for (const fx of loadFixtures()) all.push(...(await runUc(fx)));
  return all;
}

export const keyOf = (r: StepResult) => `${r.set}/${r.uc}/${r.step}/${r.mutation}/${r.check}`;
