// HORECA-INSTELLINGEN-1 — de checklist "Je zaak inrichten".
import { describe, expect, it } from 'vitest';
import { setupProgress, setupSteps, type HorecaStatus } from './horecaSetup';

const empty: HorecaStatus = {
  name: 'Café', address: '', postalCode: '', city: '', vat: '', logo: false, hoursSet: false,
  terminals: 0, pairedDevices: 0, cashiers: 0, payMethods: 2, kassaTip: true, terminalMode: 'none', receiptPrint: false, mailOnline: false, notifyDevices: 0,
  tables: 0, areas: 0, stations: 0, printers: 0,
  qrMode: 'view', qrFlow: 'order', qrPayCounter: true, qrPayOnline: false, checkOnline: false, onlineTip: true, leadMinutes: 60,
  shopLive: false, shopOrdering: false, pickup: false, delivery: false, slots: false, payOnPickup: false, addonGroups: 0, menuItems: 0,
  stripe: false,
};
const ready: HorecaStatus = {
  ...empty, address: 'Markt 1', postalCode: '3000', city: 'Leuven', vat: 'BE0123456789', logo: true, hoursSet: true,
  terminals: 1, pairedDevices: 1, cashiers: 2, tables: 8, areas: 1, stations: 2, shopLive: true,
};

describe('checklist', () => {
  it('lege zaak: enkel betaalwijze (standaard) en QR (bekijken) zijn klaar; printer telt niet mee', () => {
    const steps = setupSteps(empty);
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(['qr', 'pay']);
    expect(steps.find((s) => s.id === 'printer')!.optional).toBe(true);
    expect(setupProgress(steps)).toEqual({ done: 2, total: 10 });
  });

  it('volledig ingerichte zaak zonder printer: alles klaar', () => {
    expect(setupProgress(setupSteps(ready))).toEqual({ done: 10, total: 10 });
  });

  it('online betalen is pas een stap als QR-betalen of online bestellen aanstaat', () => {
    expect(setupSteps(ready).some((s) => s.id === 'stripe')).toBe(false);
    const qrOnline = setupSteps({ ...ready, qrMode: 'order', qrPayOnline: true });
    expect(qrOnline.find((s) => s.id === 'stripe')!.done).toBe(false);
    expect(setupProgress(qrOnline)).toEqual({ done: 10, total: 11 });
    expect(setupSteps({ ...ready, qrMode: 'order', qrFlow: 'check', checkOnline: true, stripe: true }).find((s) => s.id === 'stripe')!.done).toBe(true);
    expect(setupSteps({ ...ready, shopOrdering: true }).some((s) => s.id === 'stripe')).toBe(true);
  });

  it('een kassa zonder gekoppeld toestel is niet klaar; elke stap linkt ergens heen', () => {
    expect(setupSteps({ ...ready, pairedDevices: 0 }).find((s) => s.id === 'kassa')!.done).toBe(false);
    for (const s of setupSteps(ready)) expect(s.to).toMatch(/^\/admin\//);
  });
});
