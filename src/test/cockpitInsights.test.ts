import { describe, expect, it } from 'vitest';
import type { Sale } from '@/lib/cockpitRevenue';
import { cockpitRecords, goalProgress, hourlyCompare, rushForecast, salesStreak } from '@/lib/cockpitInsights';

// Lokaal opgebouwde datums, zodat de tests in elke tijdzone kloppen.
const sale = (y: number, m: number, d: number, h: number, min = 0, amount = 10): Sale => ({
  at: new Date(y, m, d, h, min).getTime(),
  channel: 'webshop',
  amount,
});

// Dinsdag 21 oktober 2026, 14:30.
const now = new Date(2026, 9, 21, 14, 30);

describe('DASH-2b vandaag per uur', () => {
  it('vergelijkt met dezelfde weekdag vorige week tot hetzelfde tijdstip', () => {
    const sales = [
      sale(2026, 9, 21, 9, 0, 100),
      sale(2026, 9, 21, 14, 10, 50),
      sale(2026, 9, 14, 10, 0, 60),
      sale(2026, 9, 14, 14, 30, 60), // precies op hetzelfde tijdstip: telt mee
      sale(2026, 9, 14, 18, 0, 500), // later op de dag: telt niet mee
    ];
    const r = hourlyCompare(sales, now);
    expect(r.todaySoFar).toBe(150);
    expect(r.lastWeekSameTime).toBe(120);
    expect(r.changePct).toBe(25);
    expect(r.todayCount).toBe(2);
  });

  it('vroeg op de dag begint de grafiek bij het huidige uur', () => {
    const r = hourlyCompare([], new Date(2026, 9, 21, 6, 40));
    expect(r.startHour).toBe(6);
    expect(r.nowHour).toBeGreaterThanOrEqual(r.startHour);
  });

  it('geen vergelijking als er vorige week niets was', () => {
    const r = hourlyCompare([sale(2026, 9, 21, 9)], now);
    expect(r.changePct).toBeNull();
  });

  it('cumulatieve lijn van vandaag stopt bij het huidige uur', () => {
    const r = hourlyCompare([sale(2026, 9, 21, 9, 0, 100)], now);
    expect(r.startHour).toBe(8);
    // 8u t.e.m. 14u = 7 punten; om 10u (einde 9u) staat de 100 erin.
    expect(r.today).toHaveLength(7);
    expect(r.today[0]).toBe(0);
    expect(r.today[2]).toBe(100);
    expect(r.lastWeek.length).toBe(r.endHour - r.startHour + 1);
  });
});

describe('DASH-2b reeks', () => {
  it('telt door tot vandaag als er vandaag al verkocht is', () => {
    const sales = [sale(2026, 9, 21, 9), sale(2026, 9, 20, 9), sale(2026, 9, 19, 9), sale(2026, 9, 17, 9)];
    expect(salesStreak(sales, now)).toBe(3);
  });

  it('breekt niet als er vandaag nog niets verkocht is', () => {
    const sales = [sale(2026, 9, 20, 9), sale(2026, 9, 19, 9)];
    expect(salesStreak(sales, now)).toBe(2);
  });

  it('nul zonder verkoop gisteren of vandaag', () => {
    expect(salesStreak([sale(2026, 9, 18, 9)], now)).toBe(0);
  });
});

describe('DASH-2b records', () => {
  it('beste dinsdag pas vanaf drie eerdere dinsdagen', () => {
    const two = [sale(2026, 9, 14, 9, 0, 100), sale(2026, 9, 7, 9, 0, 300)];
    expect(cockpitRecords(two, now, 0).bestSameWeekday).toBeNull();
    const three = [...two, sale(2026, 8, 30, 9, 0, 200)];
    const r = cockpitRecords(three, now, 120);
    expect(r.bestSameWeekday?.revenue).toBe(300);
    expect(r.toBeatSameWeekday).toBe(180);
  });

  it('een recente dag die het record van zijn weekdag brak', () => {
    // Zaterdagen: 27/9 (100), 4/10 (120), 11/10 (90), 18/10 (400 = record).
    const sales = [
      sale(2026, 8, 27, 12, 0, 100),
      sale(2026, 9, 4, 12, 0, 120),
      sale(2026, 9, 11, 12, 0, 90),
      sale(2026, 9, 18, 12, 0, 400),
    ];
    const r = cockpitRecords(sales, now, 0);
    expect(r.recentWeekdayRecord?.revenue).toBe(400);
    expect(r.recentWeekdayRecord?.date.getDate()).toBe(18);
  });

  it('geen recent record als het niet beter was', () => {
    const sales = [
      sale(2026, 8, 27, 12, 0, 500),
      sale(2026, 9, 4, 12, 0, 120),
      sale(2026, 9, 11, 12, 0, 90),
      sale(2026, 9, 18, 12, 0, 400),
    ];
    expect(cockpitRecords(sales, now, 0).recentWeekdayRecord).toBeNull();
  });
});

describe('DASH-2b drukte per kwartier', () => {
  it('gemiddelde over de weken met verkoop en de spits', () => {
    const fri = new Date(2026, 9, 23, 18, 40);
    const sales = [
      // Vrijdag 16/10 en 9/10: druk tussen 19:00 en 20:00.
      sale(2026, 9, 16, 19, 5), sale(2026, 9, 16, 19, 20), sale(2026, 9, 16, 19, 50), sale(2026, 9, 16, 18, 0),
      sale(2026, 9, 9, 19, 10), sale(2026, 9, 9, 19, 40),
      // Vandaag
      sale(2026, 9, 23, 18, 5), sale(2026, 9, 23, 18, 35),
    ];
    const r = rushForecast(sales, fri);
    expect(r.weeks).toBe(2);
    expect(r.peakStartMinute).toBe(19 * 60);
    const at1800 = r.buckets.find((b) => b.minute === 18 * 60)!;
    expect(at1800.today).toBe(1);
    expect(at1800.expected).toBe(0.5);
    const at1900 = r.buckets.find((b) => b.minute === 19 * 60)!;
    expect(at1900.today).toBeNull();
    expect(at1900.expected).toBe(1);
  });

  it('zonder geschiedenis geen spits', () => {
    const r = rushForecast([sale(2026, 9, 21, 12)], now);
    expect(r.peakStartMinute).toBeNull();
    expect(r.weeks).toBe(0);
  });
});

describe('DASH-2b maanddoel', () => {
  it('rest per dag, vandaag inbegrepen', () => {
    const g = goalProgress(12000, 8420, now);
    expect(g.pct).toBe(70);
    expect(g.remaining).toBe(3580);
    expect(g.daysLeft).toBe(11);
    expect(g.perDay).toBe(326);
  });

  it('doel gehaald', () => {
    const g = goalProgress(1000, 1200, now);
    expect(g.remaining).toBe(0);
    expect(g.perDay).toBe(0);
    expect(g.pct).toBe(120);
  });
});
