// HORECA-INSTELLINGEN-1 — Mijn zaak: de indeling, de redirects van de oude plekken en dat elke tab inhoud heeft.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KAART_TABS_HORECA_ONLY, PAYMENT_SETTINGS_URL, STAFF_TABS, ZAAK_GROUPS, legacyKaartTarget, legacyPosTarget, legacySettingsTarget, legacyStaffTarget, mijnZaakUrl, resolveLegacyHref } from './mijnZaak';

describe('Mijn zaak — indeling', () => {
  it('zes groepen en Jij, in de afgesproken volgorde, met unieke tabs', () => {
    expect(ZAAK_GROUPS.map((g) => g.id)).toEqual(['zaak', 'gasten', 'betalen', 'zaal-keuken', 'toestellen', 'geld', 'jij']);
    for (const g of ZAAK_GROUPS) expect(new Set(g.tabs.map((t) => t.id)).size).toBe(g.tabs.length);
    expect(ZAAK_GROUPS.find((g) => g.id === 'betalen')!.tabs.map((t) => t.id)).toEqual(['kassa', 'online', 'fooi', 'terminal']);
  });

  it('elke tab heeft inhoud in MijnZaakTabs.tsx (geen lege tab)', () => {
    const src = readFileSync('src/components/admin/mijnzaak/MijnZaakTabs.tsx', 'utf8');
    for (const g of ZAAK_GROUPS) for (const t of g.tabs) expect(src, `${g.id}/${t.id}`).toContain(`case '${g.id}/${t.id}':`);
  });

  it('Personeel: PIN, uren, beheerders (beheerders enkel zaakvoerder)', () => {
    expect(STAFF_TABS.map((t) => t.id)).toEqual(['pin', 'uren', 'beheerders']);
    expect(STAFF_TABS.find((t) => t.id === 'beheerders')!.adminOnly).toBe(true);
  });

  it('1b: Je gasten, Betalen, Zaal & keuken en Kassa’s & toestellen enkel voor de zaakvoerder (volgt de RLS)', () => {
    for (const id of ['gasten', 'betalen', 'zaal-keuken', 'toestellen']) {
      for (const t of ZAAK_GROUPS.find((g) => g.id === id)!.tabs) expect(t.adminOnly, `${id}/${t.id}`).toBe(true);
    }
    // Je zaak (website = themes), Geld (settings_financial) en Jij: niet enkel de zaakvoerder.
    for (const id of ['zaak', 'geld', 'jij']) {
      for (const t of ZAAK_GROUPS.find((g) => g.id === id)!.tabs) expect(t.adminOnly, `${id}/${t.id}`).toBeFalsy();
    }
    expect(ZAAK_GROUPS.find((g) => g.id === 'zaak')!.tabs.find((t) => t.id === 'website')!.requiredRead).toBe('themes');
  });

  it('de Kaart houdt enkel inhoud', () => {
    expect([...KAART_TABS_HORECA_ONLY]).toEqual(['kaart', 'overview', 'extras', 'allergens']);
  });
});

describe('Mijn zaak — oude links gaan door', () => {
  it('1b: Personeel en Reservaties voor een combinatiezaak → de klassieke plek', () => {
    expect(legacyStaffTarget(null)).toBe('/admin/pos?tab=personeel');
    expect(legacyStaffTarget('uren')).toBe('/admin/pos?tab=personeel');
    expect(legacyStaffTarget('beheerders')).toBe('/admin/settings?section=team');
    expect(legacySettingsTarget('domain')).toBe(mijnZaakUrl('zaak', 'website'));
  });

  it('Instellingen ?section=', () => {
    expect(legacySettingsTarget('company')).toBe(mijnZaakUrl('zaak', 'gegevens'));
    expect(legacySettingsTarget('company', '#openingsuren')).toBe(mijnZaakUrl('zaak', 'uren'));
    expect(legacySettingsTarget('branding')).toBe(mijnZaakUrl('zaak', 'merk'));
    expect(legacySettingsTarget('payments')).toBe(mijnZaakUrl('betalen', 'online'));
    expect(legacySettingsTarget('team')).toBe('/admin/personeel?tab=beheerders');
    expect(legacySettingsTarget('accounting')).toBe(mijnZaakUrl('geld', 'boekhouding'));
    expect(legacySettingsTarget('profile')).toBe(mijnZaakUrl('jij', 'profiel'));
    expect(legacySettingsTarget('horeca')).toBe('/admin/settings');
    expect(legacySettingsTarget('iets-onbekends')).toBe('/admin/settings');
    expect(legacySettingsTarget('betalen')).toBeNull(); // al een nieuwe groep
  });

  it('Kassabeheer ?tab=', () => {
    expect(legacyPosTarget(null)).toBe(mijnZaakUrl('toestellen', 'kassas'));
    expect(legacyPosTarget('personeel')).toBe('/admin/personeel');
    expect(legacyPosTarget('betalen')).toBe(mijnZaakUrl('betalen', 'kassa'));
    expect(legacyPosTarget('printers')).toBe(mijnZaakUrl('zaal-keuken', 'printers'));
  });

  it('Kaart ?tab=: enkel wat verhuisd is', () => {
    expect(legacyKaartTarget('qr')).toBe(mijnZaakUrl('gasten', 'qr'));
    expect(legacyKaartTarget('webshop')).toBe(mijnZaakUrl('gasten', 'afhalen'));
    expect(legacyKaartTarget('posten')).toBe(mijnZaakUrl('zaal-keuken', 'posten'));
    expect(legacyKaartTarget('reservaties')).toBe('/admin/reservaties');
    for (const tab of [null, 'kaart', 'extras', 'allergens', 'overview']) expect(legacyKaartTarget(tab)).toBeNull();
  });

  it('resolveLegacyHref voor gedeelde schermen', () => {
    expect(resolveLegacyHref('/admin/settings?section=company#openingsuren')).toBe(mijnZaakUrl('zaak', 'uren'));
    expect(resolveLegacyHref('/admin/pos?tab=printers')).toBe(mijnZaakUrl('zaal-keuken', 'printers'));
    expect(resolveLegacyHref('/admin/bestellen?tab=allergens')).toBe('/admin/bestellen?tab=allergens');
    expect(resolveLegacyHref('/admin/keuken')).toBe('/admin/keuken');
    expect(resolveLegacyHref('/admin/settings?section=geld&tab=btw')).toBe('/admin/settings?section=geld&tab=btw');
  });
});

// FIXES-0711 — "Naar Betalingen" opent de Stripe-koppeling, nooit Transacties (/admin/payments).
describe('FIXES-0711 — link naar de betaalinstellingen', () => {
  it('Instellingen › Betalingen; horeca-only via useHorecaHref: Mijn zaak › Betalen › Online', () => {
    expect(PAYMENT_SETTINGS_URL).toBe('/admin/settings?section=payments');
    expect(resolveLegacyHref(PAYMENT_SETTINGS_URL)).toBe(mijnZaakUrl('betalen', 'online'));
  });

  it('geen link naar /admin/payments voor "Stripe koppelen" in QR aan tafel en het Nu-paneel', () => {
    for (const f of ['src/components/admin/storefront/food/QrModeSettings.tsx', 'src/components/horeca/now/NowPanel.tsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toContain("'/admin/payments'");
      expect(readFileSync(f, 'utf8'), f).not.toContain('"/admin/payments"');
    }
  });
});
