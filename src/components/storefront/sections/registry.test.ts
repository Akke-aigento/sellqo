import { describe, it, expect } from 'vitest';
import { SECTION_RENDERERS, getSectionRenderer } from './registry';
import { SECTION_TYPES } from '@/types/storefront';

describe('sectie-renderregister', () => {
  it('heeft een renderer voor elk type uit SECTION_TYPES', () => {
    for (const { type } of SECTION_TYPES) {
      expect(SECTION_RENDERERS[type], `ontbrekende renderer voor ${type}`).toBeDefined();
    }
  });

  it('bevat geen renderers voor types die niet in SECTION_TYPES staan', () => {
    const known = SECTION_TYPES.map((t) => t.type).sort();
    expect(Object.keys(SECTION_RENDERERS).sort()).toEqual(known);
  });

  it('dekt de negen types die de editor aanbiedt', () => {
    // Vangt op wanneer een type wordt toegevoegd zonder renderer of andersom.
    expect(Object.keys(SECTION_RENDERERS)).toHaveLength(9);
  });

  it('geeft null voor een onbekend type in plaats van te crashen', () => {
    // Komt voor wanneer de database een type bevat dat deze build nog niet
    // kent, bijvoorbeeld tijdens een uitrol.
    expect(getSectionRenderer('bestaat_niet')).toBeNull();
  });

  it('geeft voor elk bekend type hetzelfde component als het register', () => {
    for (const { type } of SECTION_TYPES) {
      expect(getSectionRenderer(type)).toBe(SECTION_RENDERERS[type]);
    }
  });
});
