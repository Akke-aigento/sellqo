import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Conversation, InboxMessage } from '@/hooks/useInbox';

// APP-INBOX-CRASH-1: `onMarkAsRead` komt uit Messages.tsx als inline arrow,
// elke render nieuw. Dat gaf live 52 PATCH-requests en React #185 bij het
// openen van een ongelezen gesprek. Eén aanroep per gesprek-en-stand.

vi.mock('@/components/admin/inbox/ReplyComposer', () => ({ ReplyComposer: () => null }));
vi.mock('@/components/admin/inbox/ConversationActions', () => ({ ConversationActions: () => null }));
vi.mock('@/components/admin/inbox/MessageBubble', () => ({ MessageBubble: () => null }));
vi.mock('@/hooks/useCustomers', () => ({ useCustomers: () => ({ createCustomer: { mutateAsync: vi.fn() } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useDateFnsLocale', () => ({ useDateFnsLocale: () => undefined }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: unknown }) => children }));

const { ConversationDetail } = await import('@/components/admin/inbox/ConversationDetail');

const msg = { id: 'm1', direction: 'inbound', channel: 'email', created_at: '2026-09-18T14:20:05Z', read_at: null } as unknown as InboxMessage;
const convo = (id: string, unreadCount: number): Conversation => ({
  id, customer: null, lastMessage: msg, unreadCount, channel: 'email', messages: [msg],
  messageStatus: 'active', folderId: null,
});

const props = { onMessageSent: () => {} };

describe('ConversationDetail — mark-as-read', () => {
  it('vuurt één keer, ook als elke render een nieuwe callback meegeeft', () => {
    const calls: number[] = [];
    const { rerender } = render(<ConversationDetail {...props} conversation={convo('a', 1)} onMarkAsRead={() => calls.push(1)} />);
    for (let i = 0; i < 20; i++) {
      rerender(<ConversationDetail {...props} conversation={convo('a', 1)} onMarkAsRead={() => calls.push(1)} />);
    }
    expect(calls).toHaveLength(1);
  });

  it('niets bij 0 ongelezen', () => {
    const onMarkAsRead = vi.fn();
    render(<ConversationDetail {...props} conversation={convo('a', 0)} onMarkAsRead={onMarkAsRead} />);
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('opnieuw bij een ander gesprek of een nieuw ongelezen bericht', () => {
    const onMarkAsRead = vi.fn();
    const { rerender } = render(<ConversationDetail {...props} conversation={convo('a', 1)} onMarkAsRead={onMarkAsRead} />);
    rerender(<ConversationDetail {...props} conversation={convo('b', 1)} onMarkAsRead={onMarkAsRead} />);
    rerender(<ConversationDetail {...props} conversation={convo('b', 2)} onMarkAsRead={onMarkAsRead} />);
    expect(onMarkAsRead).toHaveBeenCalledTimes(3);
  });
});
