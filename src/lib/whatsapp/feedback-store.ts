import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface FeedbackItem {
  id: string;
  ticket: string;
  type: "complaint" | "suggestion";
  customer_phone: string;
  customer_name?: string;
  message: string;
  status: "pending" | "resolved" | "reviewed";
  created_at: string;
  admin_notes?: string;
}

const SETTING_KEY = "customer_feedback_records";

export async function getFeedbackRecords(): Promise<FeedbackItem[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (err) {
    console.error("Error reading feedback records:", err);
    return [];
  }
}

export async function saveFeedbackRecord(
  item: Omit<FeedbackItem, "id" | "created_at">
): Promise<FeedbackItem> {
  const supabase = getSupabaseAdmin();
  const current = await getFeedbackRecords();
  const newItem: FeedbackItem = {
    ...item,
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  const updated = [newItem, ...current];

  await supabase.from("system_settings").upsert(
    {
      key: SETTING_KEY,
      value: JSON.stringify(updated),
    },
    { onConflict: "key" }
  );

  return newItem;
}
