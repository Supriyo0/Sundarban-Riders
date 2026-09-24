import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getFeedbackRecords,
  saveFeedbackRecord,
  type FeedbackItem,
} from "@/lib/whatsapp/feedback-store";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SETTING_KEY = "customer_feedback_records";

export async function GET() {
  try {
    const records = await getFeedbackRecords();
    const complaints = records.filter((r) => r.type === "complaint");
    const suggestions = records.filter((r) => r.type === "suggestion");

    return NextResponse.json({
      success: true,
      all: records,
      complaints,
      suggestions,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, ticket, customer_phone, customer_name, message, status } = body;

    if (!type || !customer_phone || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const saved = await saveFeedbackRecord({
      type,
      ticket: ticket || `#${type === "complaint" ? "CMP" : "SUG"}-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_phone,
      customer_name,
      message,
      status: status || (type === "complaint" ? "pending" : "reviewed"),
    });

    return NextResponse.json({ success: true, item: saved });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, admin_notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const current = await getFeedbackRecords();
    const index = current.findIndex((item) => item.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
    }

    if (status) current[index].status = status;
    if (admin_notes !== undefined) current[index].admin_notes = admin_notes;

    await supabase.from("system_settings").upsert(
      {
        key: SETTING_KEY,
        value: JSON.stringify(current),
      },
      { onConflict: "key" }
    );

    return NextResponse.json({ success: true, item: current[index] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
