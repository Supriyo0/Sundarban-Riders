import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          fetch: async (url, options) => {
            let lastErr: any;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                return await fetch(url, options);
              } catch (err: any) {
                lastErr = err;
                const msg = err?.message || err?.toString() || "";
                if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT")) {
                  await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
                  continue;
                }
                throw err;
              }
            }
            throw lastErr;
          },
        },
      }
    )
  }
  return _adminClient
}
