import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWhatsAppOtp, cleanPhoneNumber } from "@/lib/whatsapp/otp-service";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, otp, role = "passenger" } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, message: "ফোন নম্বর ও OTP আবশ্যক।" },
        { status: 400 }
      );
    }

    const verification = await verifyWhatsAppOtp(phone, otp);
    if (!verification.success) {
      return NextResponse.json(verification, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cleanPhone = cleanPhoneNumber(phone);

    // Generate secure session payload
    const sessionToken = Buffer.from(
      JSON.stringify({
        phone: cleanPhone,
        role,
        verifiedAt: Date.now(),
      })
    ).toString("base64");

    if (role === "rider") {
      // Check if driver is already registered in `drivers` table
      const { data: driver } = await supabase
        .from("drivers")
        .select("*")
        .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace(/^91/, "")}`)
        .maybeSingle();

      if (!driver) {
        return NextResponse.json({
          success: true,
          role: "rider",
          is_registered: false,
          phone: cleanPhone,
          sessionToken,
          message: "OTP সফল! অনুগ্রহ করে চালকের তথ্য ও ডকুমেন্ট সাবমিট করুন।",
        });
      }

      let isApproved = Boolean(driver.is_active);
      if (driver.current_location_name) {
        try {
          const meta = JSON.parse(driver.current_location_name);
          if (meta.status === "pending_approval") {
            isApproved = false;
          } else if (meta.status === "approved") {
            isApproved = true;
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        role: "rider",
        is_registered: true,
        is_approved: isApproved,
        driver: {
          ...driver,
          is_approved: isApproved,
        },
        sessionToken,
        message: "লগইন সফল হয়েছে!",
      });
    } else {
      // Role is passenger -> Find or upsert in `customers` table
      let { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", cleanPhone)
        .maybeSingle();

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({
            phone: cleanPhone,
            name: "সুন্দরবন যাত্রী",
            cancellation_count: 0,
          })
          .select()
          .maybeSingle();
        customer = newCustomer;
      }

      return NextResponse.json({
        success: true,
        role: "passenger",
        is_registered: true,
        customer,
        sessionToken,
        message: "লগইন সফল হয়েছে!",
      });
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
