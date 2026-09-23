import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// One-time migration endpoint to fix schema mismatches.
// DELETE THIS FILE after running once.
export async function POST(request: Request) {
  const secret = request.headers.get("x-migrate-secret")
  if (secret !== "sundarban-migrate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results: Record<string, string> = {}

  // Helper: try an ALTER statement, ignore if column already exists
  const tryAlter = async (table: string, sql: string): Promise<string> => {
    const { error } = await db.from("_migrations_log").select("id").limit(0)
    // Use raw fetch to Supabase REST since we cannot run raw DDL via JS client
    // We use the undocumented /rest/v1/rpc/... path
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/run_ddl`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ sql }),
        }
      )
      const text = await res.text()
      return res.ok ? "ok" : `${res.status}: ${text}`
    } catch (e) {
      return `exception: ${e}`
    }
  }

  // 1. messages: missing columns
  results.msg_reply = await tryAlter("messages", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL")
  results.msg_interactive_reply_id = await tryAlter("messages", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT")
  results.msg_interactive_payload = await tryAlter("messages", "ALTER TABLE messages ADD COLUMN IF NOT EXISTS interactive_payload JSONB")

  // 2. conversations: missing columns
  results.conv_user_id = await tryAlter("conversations", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID")
  results.conv_last_message_text = await tryAlter("conversations", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_text TEXT")
  results.conv_assigned_agent = await tryAlter("conversations", "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_agent_id UUID")

  // 3. whatsapp_config: missing columns
  results.wc_user_id = await tryAlter("whatsapp_config", "ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS user_id UUID")
  results.wc_mirror = await tryAlter("whatsapp_config", "ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS mirror_inbound_media BOOLEAN NOT NULL DEFAULT TRUE")

  return NextResponse.json({ results })
}
