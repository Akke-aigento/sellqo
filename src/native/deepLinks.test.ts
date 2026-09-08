import { describe, it, expect } from 'vitest';
import { deepLinkPath } from './deepLinks';

describe('deepLinkPath', () => {
  describe('geldige deep links', () => {
    it('haalt pad en querystring uit een Universal Link', () => {
      expect(deepLinkPath('https://sellqo.app/app/oauth-return?status=ok')).toBe(
        '/app/oauth-return?status=ok',
      );
    });

    it('accepteert /app zonder subpad', () => {
      expect(deepLinkPath('https://sellqo.app/app')).toBe('/app');
    });

    it('behoudt een fragment', () => {
      expect(deepLinkPath('https://sellqo.app/app/betaling/gelukt?pr=PR-1#bon')).toBe(
        '/app/betaling/gelukt?pr=PR-1#bon',
      );
    });
  });

  describe('wordt genegeerd', () => {
    it('geeft null bij een pad dat alleen met /app begint', () => {
      // Dit is precies het geval waarop Capacitor's eigen voorbeeld
      // (url.split('.app').pop()) stukloopt.
      expect(deepLinkPath('https://sellqo.app/appelmoes')).toBeNull();
    });

    it('geeft null bij een gewone site-URL', () => {
      expect(deepLinkPath('https://sellqo.app/shop/demo-bakkerij')).toBeNull();
      expect(deepLinkPath('https://sellqo.app/')).toBeNull();
    });

    it('geeft null bij onparsebare invoer', () => {
      expect(deepLinkPath('geen-url')).toBeNull();
      expect(deepLinkPath('')).toBeNull();
    });
  });

  it('bindt het resultaat aan onze eigen routes, ongeacht de host', () => {
    // De host wordt bewust niet gecontroleerd: het resultaat is een intern pad
    // onder /app, dus een gemanipuleerde link kan alleen onze eigen
    // landingspagina tonen — niet naar buiten navigeren.
    const path = deepLinkPath('https://kwaadwillend.example/app/x');
    expect(path).toBe('/app/x');
    expect(path?.startsWith('/app')).toBe(true);
  });
});
