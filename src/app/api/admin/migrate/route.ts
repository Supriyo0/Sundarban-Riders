import { NextResponse } from "next/server"

// One-time migration endpoint to fix schema mismatches.
// Uses Supabase Management API to run raw DDL.
// DELETE THIS FILE after running once.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSQL(sql: string): Promise<{ok: boolean, body: string}> {
  // Extract project ref from URL
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
  
  // Try the management API query endpoint
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  return { ok: res.ok, body: text }
}

async function runSQLDirect(sql: string): Promise<{ok: boolean, body: string}> {
  // Use PostgREST's RPC endpoint via pg function if available
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/pg_execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await res.text()
  return { ok: res.ok, body: text.substring(0, 300) }
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-migrate-secret")
  if (secret !== "sundarban-migrate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const statements = [
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS interactive_payload JSONB",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_text TEXT",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_agent_id UUID",
    "UPDATE conversations SET last_message_text = last_message WHERE last_message_text IS NULL AND last_message IS NOT NULL",
    "ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS user_id UUID",
    "ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS mirror_inbound_media BOOLEAN NOT NULL DEFAULT TRUE",
    "UPDATE whatsapp_config wc SET user_id = (SELECT am.user_id FROM account_members am WHERE am.account_id = wc.account_id AND am.role = 'owner' LIMIT 1) WHERE wc.user_id IS NULL",
    `CREATE OR REPLACE FUNCTION public.bump_conversation_on_inbound(p_conversation_id UUID, p_last_message_text TEXT) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE conversations SET unread_count = COALESCE(unread_count, 0) + 1, last_message = p_last_message_text, last_message_text = p_last_message_text, last_message_at = NOW(), updated_at = NOW() WHERE id = p_conversation_id; $$`,
    "GRANT EXECUTE ON FUNCTION public.bump_conversation_on_inbound(UUID, TEXT) TO service_role",
  ]

  const results: Record<string, string> = {}

  for (const sql of statements) {
    const key = sql.substring(0, 40)
    // Try management API first
    let result = await runSQL(sql)
    if (!result.ok) {
      // Try direct pg_execute
      result = await runSQLDirect(sql)
    }
    results[key] = result.ok ? 'ok' : `FAILED: ${result.body.substring(0, 100)}`
  }

  return NextResponse.json({ results })
}
