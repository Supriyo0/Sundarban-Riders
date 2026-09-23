-- ============================================================
-- 042_schema_compatibility_fixes
--
-- The codebase references columns that do not exist in the
-- deployed schema. This migration adds those columns and
-- updates the bump_conversation_on_inbound RPC to write to
-- both column names so old and new code both work.
--
-- Idempotent -- safe to re-run.
-- ============================================================

-- ============================================================
-- 1. messages: add reply_to_message_id, interactive_reply_id,
--    interactive_payload
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
    REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS interactive_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- ============================================================
-- 2. conversations: add user_id, last_message_text alias,
--    assigned_agent_id
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- last_message_text is the canonical code name; last_message
-- is what the deployed schema has. Add both so all code works.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_text TEXT;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;

-- Back-fill last_message_text from last_message
UPDATE conversations
SET last_message_text = last_message
WHERE last_message_text IS NULL AND last_message IS NOT NULL;

-- ============================================================
-- 3. whatsapp_config: add user_id, mirror_inbound_media
-- ============================================================
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS mirror_inbound_media BOOLEAN NOT NULL DEFAULT TRUE;

-- Back-fill user_id from account_members (owner of the account)
UPDATE whatsapp_config wc
SET user_id = (
  SELECT am.user_id
  FROM account_members am
  WHERE am.account_id = wc.account_id
    AND am.role = 'owner'
  LIMIT 1
)
WHERE wc.user_id IS NULL;

-- ============================================================
-- 4. Fix bump_conversation_on_inbound to update BOTH column
--    name variants so the transition period doesn''t drop data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_conversation_on_inbound(
  p_conversation_id UUID,
  p_last_message_text TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversations
  SET unread_count      = COALESCE(unread_count, 0) + 1,
      last_message      = p_last_message_text,
      last_message_text = p_last_message_text,
      last_message_at   = NOW(),
      updated_at        = NOW()
  WHERE id = p_conversation_id;
$$;

REVOKE ALL ON FUNCTION public.bump_conversation_on_inbound(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_conversation_on_inbound(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.bump_conversation_on_inbound(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bump_conversation_on_inbound(UUID, TEXT) TO service_role;

-- ============================================================
-- 5. Widen content_type CHECK to include interactive
-- ============================================================
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
      CHECK (content_type IN (
        'text', 'image', 'document', 'audio', 'video',
        'location', 'template', 'interactive'
      ));
  END IF;
END;
$$;
