import { describe, expect, it } from 'vitest';
import {
  collectTags, contentRequestCost, isValidWantedFor, matchesTags, pickRequestAssetIds, regenerateCost,
  socialRpcErrorCode, socialRpcErrorKey, SOCIAL_CONTENT_MAX_ASSETS,
} from '@/lib/socialContent';
import { canRegenerate, REGENERATE_FROM_STATUSES } from '@/hooks/useSocialPlanner';
import nl from '@/i18n/locales/nl.json';

describe('SOCIAL-SEC-1 — kosten (zelfde bedragen als de RPC\'s)', () => {
  it('post en story 10, reel 25', () => {
    expect(contentRequestCost('post')).toBe(10);
    expect(contentRequestCost('story')).toBe(10);
    expect(contentRequestCost('reel')).toBe(25);
    expect(contentRequestCost('iets')).toBe(10);
    expect(regenerateCost('reel')).toBe(25);
    expect(regenerateCost('image')).toBe(10);
    expect(regenerateCost('carousel')).toBe(10);
    expect(regenerateCost(null)).toBe(10);
  });
});

describe('SOCIAL-SEC-1 — foutsleutels van de RPC\'s', () => {
  it('herkent elke sleutel uit de message', () => {
    expect(socialRpcErrorCode({ message: 'social_insufficient_credits' })).toBe('insufficient_credits');
    expect(socialRpcErrorCode({ message: 'social_rate_limit' })).toBe('rate_limit');
    expect(socialRpcErrorCode({ message: 'social_no_pipeline' })).toBe('no_pipeline');
    expect(socialRpcErrorCode({ message: 'social_invalid_state' })).toBe('invalid_state');
    expect(socialRpcErrorCode({ message: 'social_guard_forbidden', code: '42501' })).toBe('guard_forbidden');
    expect(socialRpcErrorCode(new Error('social_not_found'))).toBe('not_found');
  });
  it('rechtenfout van PostgREST zonder sleutel = geen toegang; de rest onbekend', () => {
    expect(socialRpcErrorCode({ message: 'permission denied for function request_social_content', code: '42501' })).toBe('no_access');
    expect(socialRpcErrorCode({ message: 'netwerkfout' })).toBe('unknown');
    expect(socialRpcErrorCode({ message: 'social_bestaat_niet' })).toBe('unknown');
    expect(socialRpcErrorCode(null)).toBe('unknown');
  });
  it('elke code heeft een vertaling in nl.json', () => {
    const errors = (nl as { admin: { socialContent: { errors: Record<string, string> } } }).admin.socialContent.errors;
    for (const code of ['no_access', 'no_pipeline', 'not_found', 'invalid_state', 'invalid_input', 'rate_limit', 'insufficient_credits', 'guard_forbidden', 'unknown'] as const) {
      const key = socialRpcErrorKey(code);
      expect(key).toBe(`admin.socialContent.errors.${code}`);
      expect(typeof errors[code]).toBe('string');
    }
  });
});

describe('MEDIA-3 — beelden kiezen en datum', () => {
  it('uniek, zonder lege id\'s, maximaal 10', () => {
    expect(pickRequestAssetIds(['a', null, 'b', 'a', undefined, ''])).toEqual(['a', 'b']);
    const many = Array.from({ length: 14 }, (_, i) => `id${i}`);
    expect(pickRequestAssetIds(many)).toHaveLength(SOCIAL_CONTENT_MAX_ASSETS);
  });
  it('datum: leeg mag, vandaag t/m +90 dagen, niet ervoor of erna', () => {
    const today = new Date(2026, 9, 16);
    expect(isValidWantedFor('', today)).toBe(true);
    expect(isValidWantedFor('2026-10-16', today)).toBe(true);
    expect(isValidWantedFor('2027-01-14', today)).toBe(true);
    expect(isValidWantedFor('2027-01-15', today)).toBe(false);
    expect(isValidWantedFor('2026-10-15', today)).toBe(false);
    expect(isValidWantedFor('16-10-2026', today)).toBe(false);
  });
});

describe('MEDIA-3 — tagfilter', () => {
  const assets = [
    { tags: ['Lissabon', 'reis'] },
    { tags: ['lissabon', 'Strand'] },
    { tags: ['reis', 'reis'] },
    { tags: null },
  ];
  it('telt per beeld één keer, hoofdletterongevoelig, meest gebruikt eerst', () => {
    expect(collectTags(assets)).toEqual([
      { tag: 'Lissabon', count: 2 },
      { tag: 'reis', count: 2 },
      { tag: 'Strand', count: 1 },
    ]);
  });
  it('filter = alle gekozen tags aanwezig', () => {
    expect(matchesTags(['Lissabon', 'reis'], [])).toBe(true);
    expect(matchesTags(['Lissabon', 'reis'], ['lissabon'])).toBe(true);
    expect(matchesTags(['Lissabon', 'reis'], ['lissabon', 'strand'])).toBe(false);
    expect(matchesTags(null, ['reis'])).toBe(false);
  });
});

describe('SOCIAL-SEC-1 — "Opnieuw maken" enkel waar de RPC het toelaat', () => {
  it('statussen gelijk aan de RPC', () => {
    expect([...REGENERATE_FROM_STATUSES].sort()).toEqual(['draft', 'failed', 'manual', 'pending_approval']);
  });
  it('content_task + juiste status + pijplijn', () => {
    expect(canRegenerate({ status: 'pending_approval', source: 'content_task' }, true)).toBe(true);
    expect(canRegenerate({ status: 'manual', source: 'content_task' }, true)).toBe(true);
    expect(canRegenerate({ status: 'approved', source: 'content_task' }, true)).toBe(false);
    expect(canRegenerate({ status: 'scheduled', source: 'content_task' }, true)).toBe(false);
    expect(canRegenerate({ status: 'pending_approval', source: 'ui' }, true)).toBe(false);
    expect(canRegenerate({ status: 'pending_approval', source: 'content_task' }, false)).toBe(false);
  });
});
