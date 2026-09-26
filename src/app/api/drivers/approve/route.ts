import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDriverApprovalEmail } from "@/lib/email/mailer";
import { sendTextMessage } from "@/lib/whatsapp/meta-api";
import { decrypt, isLegacyFormat } from "@/lib/whatsapp/encryption";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { driver_id, approve = true } = body;

    if (!driver_id) {
      return NextResponse.json(
        { success: false, message: "driver_id আবশ্যক।" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch current driver
    const { data: driver, error: fetchErr } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", driver_id)
      .maybeSingle();

    if (fetchErr || !driver) {
      return NextResponse.json(
        { success: false, message: "চালক খুঁজে পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    // Parse email and metadata
    let email = "";
    if (driver.current_location_name) {
      try {
        const meta = JSON.parse(driver.current_location_name);
        if (meta.email) email = meta.email;
      } catch {
        // Not JSON
      }
    }

    // 2. Update driver status
    let meta: Record<string, unknown> = {};
    if (driver.current_location_name) {
      try {
        meta = JSON.parse(driver.current_location_name);
      } catch {}
    }
    meta.status = approve ? "approved" : "rejected";
    meta.approved_at = approve ? new Date().toISOString() : null;

    const { error: updateErr } = await supabase
      .from("drivers")
      .update({
        is_active: approve,
        is_available: approve,
        current_location_name: JSON.stringify(meta),
      })
      .eq("id", driver_id);

    if (updateErr) throw updateErr;

    if (approve) {
      // 3. Send WhatsApp Notification
      const cleanPhone = driver.phone.replace(/\D/g, "");
      try {
        const { data: config } = await supabase
          .from("whatsapp_config")
          .select("phone_number_id, access_token")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (config?.phone_number_id && config?.access_token) {
          const token = isLegacyFormat(config.access_token)
            ? config.access_token
            : decrypt(config.access_token);

          await sendTextMessage({
            phoneNumberId: config.phone_number_id,
            accessToken: token,
            to: cleanPhone,
            text: `🎉 অভিনন্দন! চালক অ্যাকাউন্ট অনুমোদিত হয়েছে! 🎉\n=======================\nনমস্কার ${driver.name}!\nআপনার সুন্দরবন রাইডার চালক অ্যাকাউন্ট ও ডকুমেন্টস সফলভাবে অনুমোদিত হয়েছে।\n\nএখনই অ্যাপে লগইন করে 'অনলাইন যান' অপশনে চাপ দিন এবং রাইড গ্রহণ শুরু করুন! 🛺✨`,
          });
        }
      } catch (waErr) {
        console.warn("[Approve] WhatsApp notification error:", waErr);
      }

      // 4. Send Confirmation Email if email exists
      if (email) {
        await sendDriverApprovalEmail({
          toEmail: email,
          driverName: driver.name,
          totoNumber: driver.toto_number || "WB-96-T-XXXX",
        }).catch((e) => console.warn("[Approve] Email error:", e));
      }
    }

    return NextResponse.json({
      success: true,
      message: approve
        ? "চালক অ্যাকাউন্ট সফলভাবে অনুমোদিত হয়েছে এবং নোটিফিকেশন পাঠানো হয়েছে।"
        : "চালক অ্যাকাউন্ট স্থগিত/প্রত্যাখ্যান করা হয়েছে।",
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
