-- ============================================================
-- 041_messages_direction_account_body
--
-- The webhook (route.ts) inserts `direction`, `account_id`, and
-- `body` columns into `messages` but they were never added to the
-- schema. Every inbound webhook INSERT silently failed with a
-- Postgres "column does not exist" error, leaving the messages
-- table empty even though contacts and conversations were created.
--
-- Similarly, `body` mirrors `content_text` for API consumers that
-- prefer the simpler field name.
--
-- Idempotent -- safe to re-run.
-- ============================================================

-- 1. direction: 'inbound' for customer messages, 'outbound' for agent/bot
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS direction TEXT
    CHECK (direction IN ('inbound', 'outbound'));

-- Back-fill: existing rows -- customer = inbound, agent/bot = outbound
UPDATE messages
SET direction = CASE
  WHEN sender_type = 'customer' THEN 'inbound'
  ELSE 'outbound'
END
WHERE direction IS NULL;

COMMENT ON COLUMN messages.direction IS
  'Message direction relative to the business: inbound (from customer) or outbound (from agent/bot).';

-- 2. account_id: tenancy stamp -- the account the message belongs to
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS account_id UUID
    REFERENCES accounts(id) ON DELETE CASCADE;

-- Back-fill via the conversation account_id
UPDATE messages m
SET account_id = c.account_id
FROM conversations c
WHERE c.id = m.conversation_id
  AND m.account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);

COMMENT ON COLUMN messages.account_id IS
  'Tenancy -- the account this message belongs to. Denormalised from conversations.account_id.';

-- 3. body: alias for content_text used by some API consumers
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS body TEXT;

-- Back-fill: body mirrors content_text for existing rows
UPDATE messages
SET body = content_text
WHERE body IS NULL AND content_text IS NOT NULL;

COMMENT ON COLUMN messages.body IS
  'Alias for content_text. Written alongside content_text on insert.';

-- 4. Widen the content_type CHECK to include interactive if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'messages'::regclass
      AND conname = 'messages_content_type_check'
      AND pg_get_constraintdef(oid) LIKE '%interactive%'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_type_check;
    ALTER TABLE messages ADD CONSTRAINT messages_content_type_check
      CHECK (content_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template', 'interactive'));
  END IF;
END;
$$;
