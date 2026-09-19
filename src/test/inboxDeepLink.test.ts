import { describe, expect, it } from 'vitest';
import { findConversationForParam, folderFilterForMessage } from '@/lib/inboxDeepLink';

// NOTIF-DEEPLINK-1: ?conversation= opent het gesprek dat dat bericht bevat.

const conversations = [
  { id: 'cust-1::cc test', messages: [{ id: 'm-new' }, { id: 'm-old' }] },
  { id: 'cust-2::andere', messages: [{ id: 'm-x' }] },
];

describe('findConversationForParam', () => {
  it('bericht-id uit een melding (ook een ouder bericht)', () => {
    expect(findConversationForParam(conversations, 'm-old')?.id).toBe('cust-1::cc test');
  });
  it('gesprekssleutel van de inbox zelf', () => {
    expect(findConversationForParam(conversations, 'cust-2::andere')?.id).toBe('cust-2::andere');
  });
  it('niet in de geladen set → null', () => {
    expect(findConversationForParam(conversations, 'm-onbekend')).toBeNull();
    expect(findConversationForParam(conversations, null)).toBeNull();
  });
});

describe('folderFilterForMessage', () => {
  it.each([
    [{ message_status: 'archived', folder_id: null }, 'archived'],
    [{ message_status: 'deleted', folder_id: 'f1' }, 'deleted'],
    [{ message_status: 'active', folder_id: 'f1' }, 'f1'],
    [{ message_status: 'active', folder_id: null }, null],
  ])('%j → %s', (row, expected) => expect(folderFilterForMessage(row)).toBe(expected));
});
