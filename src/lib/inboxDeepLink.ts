/**
 * NOTIF-DEEPLINK-1 — `/admin/messages?conversation=<id>` opent één gesprek.
 *
 * `<id>` is meestal een bericht-id: meldingen dragen `message_id` in hun data,
 * en CustomerDetail linkt al met het id van het nieuwste bericht. De inbox
 * zelf kent gesprekken als `${klant}::${onderwerp}`; die sleutel wordt ook
 * aanvaard. Het gesprek is het gesprek dat dat bericht bevat.
 */

interface ConversationLike {
  id: string;
  messages: ReadonlyArray<{ id: string }>;
}

export function findConversationForParam<C extends ConversationLike>(
  conversations: readonly C[],
  param: string | null,
): C | null {
  if (!param) return null;
  return (
    conversations.find((c) => c.id === param) ??
    conversations.find((c) => c.messages.some((m) => m.id === param)) ??
    null
  );
}

/**
 * De mapfilter van useInbox waarin dit bericht staat: `'archived'`,
 * `'deleted'`, een eigen map-id, of `null` (inbox).
 */
export function folderFilterForMessage(row: {
  message_status?: string | null;
  folder_id?: string | null;
}): string | null {
  if (row.message_status === 'archived') return 'archived';
  if (row.message_status === 'deleted') return 'deleted';
  return row.folder_id ?? null;
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
