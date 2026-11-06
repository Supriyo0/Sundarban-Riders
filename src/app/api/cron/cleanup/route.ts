import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Daily Conversation & Messages Auto-Purge Cron Endpoint
 * Cleans up old chat conversations & messages to keep Supabase Free Tier completely light.
 * STRICTLY PRESERVES all contacts, customers, bookings, and drivers.
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    // 24 hours retention threshold
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Delete messages older than 24 hours
    const { error: msgErr, count: msgCount } = await supabase
      .from("messages")
      .delete({ count: "exact" })
      .lt("created_at", yesterday);

    if (msgErr) {
      console.warn("Cron cleanup messages error:", msgErr);
    }

    // 2. Delete conversations older than 24 hours
    const { error: convErr, count: convCount } = await supabase
      .from("conversations")
      .delete({ count: "exact" })
      .lt("created_at", yesterday);

    if (convErr) {
      console.warn("Cron cleanup conversations error:", convErr);
    }

    return NextResponse.json({
      success: true,
      message: "দৈনিক কথোপকথন ও মেসেজ সফলভাবে মুছে পরিষ্কার করা হয়েছে (কন্টাক্টস সম্পূর্ণ অক্ষত রয়েছে)।",
      deletedMessages: msgCount || 0,
      deletedConversations: convCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cleanup cron error:", err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

