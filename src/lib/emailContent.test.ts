import { describe, expect, it } from 'vitest';
import { isStandaloneEmailDocument } from './emailContent';

describe('isStandaloneEmailDocument (MAIL-CLEAN-1)', () => {
  const doc = '<!DOCTYPE html><html><head><style>a{}</style></head><body><a href="{{unsubscribe_url}}">x</a></body></html>';
  it('volledig document met eigen afmeldlink', () => {
    expect(isStandaloneEmailDocument(doc)).toBe(true);
  });
  it('zonder afmeldlink of zonder document: nee', () => {
    expect(isStandaloneEmailDocument(doc.replace('{{unsubscribe_url}}', '#'))).toBe(false);
    expect(isStandaloneEmailDocument('<p>Hallo</p><p>{{unsubscribe_url}}</p>')).toBe(false);
    expect(isStandaloneEmailDocument('')).toBe(false);
  });
});
