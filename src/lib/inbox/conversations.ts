import type { Conversation, Contact, Tag } from "@/types";

/**
 * Conversation select that embeds the contact plus its tags, so the Inbox
 * can filter conversations by contact tag without a second round-trip.
 * `contact_tags(tags(*))` returns the join rows; {@link normalizeConversation}
 * flattens them onto `contact.tags`.
 */
export const CONVERSATION_SELECT =
  "*, contact:contacts(*)";

/** Raw shape returned by {@link CONVERSATION_SELECT} before flattening. */
type RawContact = Contact & { contact_tags?: { tags: Tag | null }[] };
type RawConversation = Omit<Conversation, "contact"> & {
  contact?: RawContact | null;
};

/**
 * Flatten the embedded `contact_tags(tags(*))` join into `contact.tags`.
 * Safe to call on rows fetched with {@link CONVERSATION_SELECT}; a row with
 * no contact (e.g. a freshly-inserted conversation) passes through untouched.
 */
export function normalizeConversation(raw: RawConversation): Conversation {
  const rawContact = raw.contact;
  const lastMsg = raw.last_message ?? raw.last_message_text ?? '';
  const base: Conversation = {
    ...(raw as Conversation),
    last_message: lastMsg,
    last_message_text: lastMsg,
  };
  if (!rawContact) return base;

  const { contact_tags, ...contact } = rawContact;
  const directTags: Tag[] = Array.isArray(contact.tags)
    ? (contact.tags as Tag[])
    : [];

  const joinedTags: Tag[] = Array.isArray(contact_tags)
    ? contact_tags
        .map((ct) => ct.tags)
        .filter((t): t is Tag => t != null)
    : [];

  const tags = joinedTags.length > 0 ? joinedTags : directTags;

  return {
    ...base,
    contact: {
      ...contact,
      tags,
    },
  };
}

export function normalizeConversations(
  rows: RawConversation[],
): Conversation[] {
  return rows.map(normalizeConversation);
}

/**
 * Resilient conversation fetcher.
 * Attempts the primary embedded join first, but gracefully falls back to
 * a two-step point lookup if PostgREST's relationship cache reports PGRST200,
 * guaranteeing the inbox never shows a blank screen.
 */
export async function fetchConversationsWithContacts(supabase: any): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .order("last_message_at", { ascending: false });

    if (!error && data) {
      return normalizeConversations(data);
    }
  } catch {
    // Fall through to point join
  }

  // Resilient fallback: point lookup for contacts (immune to PGRST200 schema cache misses)
  const { data: convs, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (convErr || !convs) {
    return [];
  }

  const contactIds = [...new Set(convs.map((c: any) => c.contact_id).filter(Boolean))];
  const contactsMap = new Map<string, any>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .in("id", contactIds);
    if (contacts) {
      contacts.forEach((ct: any) => contactsMap.set(ct.id, ct));
    }
  }

  const combined = convs.map((c: any) => ({
    ...c,
    contact: contactsMap.get(c.contact_id) || null,
  }));

  return normalizeConversations(combined);
}

export async function fetchSingleConversationWithContact(
  supabase: any,
  convId: string
): Promise<Conversation | null> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .eq("id", convId)
      .maybeSingle();

    if (!error && data) {
      return normalizeConversation(data);
    }
  } catch {
    // Fall through
  }

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", convId)
    .maybeSingle();

  if (convErr || !conv) return null;

  let contact = null;
  if (conv.contact_id) {
    const { data: ct } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", conv.contact_id)
      .maybeSingle();
    contact = ct;
  }

  return normalizeConversation({
    ...conv,
    contact,
  });
}

export interface ContactFilters {
  /** Tag ids; a conversation matches if its contact has ANY of them (OR). */
  tagIds: string[];
  /** Exact company match, or null for no company filter. */
  company: string | null;
}

/**
 * Whether a conversation passes the contact-based Inbox filters (issue #272).
 * Empty `tagIds` and null `company` are no-ops, so the default (no filters)
 * always matches. Tags use OR logic, consistent with Broadcast audiences.
 */
export function matchesContactFilters(
  conversation: Conversation,
  { tagIds, company }: ContactFilters,
): boolean {
  if (tagIds.length > 0) {
    const contactTagIds = conversation.contact?.tags ?? [];
    if (!contactTagIds.some((t) => tagIds.includes(t.id))) return false;
  }

  if (company !== null && conversation.contact?.company?.trim() !== company) {
    return false;
  }

  return true;
}
