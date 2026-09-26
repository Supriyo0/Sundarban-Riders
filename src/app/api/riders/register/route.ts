import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanPhoneNumber } from "@/lib/whatsapp/otp-service";
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
    const {
      name,
      phone,
      email,
      district,
      block,
      toto_number,
      aadhar_number,
      aadhar_doc,
      secondary_doc,
      secondary_doc_type = "driving_license",
    } = body;

    if (!name || !phone || !aadhar_number) {
      return NextResponse.json(
        { success: false, message: "নাম, ফোন নম্বর এবং আধার নম্বর বাধ্যতামূলক।" },
        { status: 400 }
      );
    }

    const cleanPhone = cleanPhoneNumber(phone);
    const supabase = getSupabaseAdmin();

    // Check if phone already registered in drivers
    const { data: existing } = await supabase
      .from("drivers")
      .select("id, is_active, current_location_name")
      .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace(/^91/, "")}`)
      .maybeSingle();

    const metadata = {
      district: district || "দক্ষিণ ২৪ পরগনা",
      block: block || "কাকদ্বীপ",
      aadhar_no: aadhar_number,
      email: email || "",
      aadhar_card_url: aadhar_doc || null,
      secondary_doc_url: secondary_doc || null,
      secondary_doc_type: secondary_doc_type,
      applied_at: new Date().toISOString(),
      status: "pending_approval",
    };

    let driverId = existing?.id;

    if (existing) {
      // Update existing driver record with new KYC
      const { data: updated, error } = await supabase
        .from("drivers")
        .update({
          name,
          toto_number: toto_number || "WB-96-T-XXXX",
          license_number: aadhar_number,
          is_active: false,
          is_available: false,
          current_location_name: JSON.stringify(metadata),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      driverId = updated.id;
    } else {
      // Insert new driver
      const { data: created, error } = await supabase
        .from("drivers")
        .insert({
          name,
          phone: cleanPhone,
          toto_number: toto_number || "WB-96-T-XXXX",
          vehicle_type: "toto",
          license_number: aadhar_number,
          is_active: false,
          is_available: false,
          rating: 5.0,
          total_trips: 0,
          current_location_name: JSON.stringify(metadata),
        })
        .select()
        .single();

      if (error) throw error;
      driverId = created.id;
    }

    // Try to send WhatsApp confirmation to the driver
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
          text: `⏳ চালক আবেদন জমা হয়েছে ⏳\n=======================\nনমস্কার ${name}!\nআপনার সুন্দরবন রাইডার চালক নিবন্ধন ও ডকুমেন্টস সফলভাবে জমা হয়েছে।\n\nঅ্যাডমিন ভেরিফিকেশন সম্পন্ন হলে আপনি ইমেইল ও নোটিফিকেশন পাবেন। ধন্যবাদ! 🙏`,
        });
      }
    } catch (msgErr) {
      console.warn("Could not dispatch WhatsApp confirmation:", msgErr);
    }

    return NextResponse.json({
      success: true,
      driver_id: driverId,
      message: "আপনার আবেদন সফলভাবে জমা হয়েছে। অ্যাডমিন অনুমোদনের পর ডিউটি শুরু করতে পারবেন।",
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message)
        : JSON.stringify(error) || "Internal Error";
    console.error("Rider register error:", errorMsg);
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
