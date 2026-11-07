import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PIN_SALT = process.env.PIN_SALT || "sundarban-riders-secret-pin-salt-2026";

function hashPin(pin: string, phone: string): string {
  return crypto
    .createHmac("sha256", PIN_SALT)
    .update(`${phone}:${pin}`)
    .digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, phone, pin, role = "passenger" } = body;

    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, message: "১০ সংখ্যার সঠিক মোবাইল নম্বর আবশ্যক।" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const settingKey = `user_pin_${cleanPhone}`;

    function parseSettingValue(val: unknown): Record<string, any> | null {
      if (!val) return null;
      if (typeof val === "object") return val as Record<string, any>;
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return null;
    }

    // 1. CHECK IF USER HAS A PIN
    if (action === "check") {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("key", settingKey)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Error checking pin:", error);
      }

      const parsedVal = parseSettingValue(data?.value);
      const hasPin = Boolean(parsedVal && parsedVal.pin_hash);
      return NextResponse.json({ success: true, hasPin });
    }

    // 2. SET OR RESET 4-DIGIT PIN
    if (action === "set") {
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { success: false, message: "৪ সংখ্যার সঠিক সংখ্যাসূচক পিন দিন।" },
          { status: 400 }
        );
      }

      const pinHash = hashPin(pin, cleanPhone);
      const payload = {
        key: settingKey,
        value: {
          pin_hash: pinHash,
          role,
          phone: cleanPhone,
          updated_at: new Date().toISOString(),
        },
        description: `4-Digit Security PIN for ${cleanPhone}`,
        updated_at: new Date().toISOString(),
      };

      // Check if exists to update or insert
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("key", settingKey)
        .maybeSingle();

      let upsertErr;
      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update(payload)
          .eq("id", existing.id);
        upsertErr = error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert([payload]);
        upsertErr = error;
      }

      if (upsertErr) {
        console.error("Error saving PIN to system_settings:", upsertErr);
        return NextResponse.json(
          { success: false, message: "পিন সংরক্ষণ করতে ব্যর্থ হয়েছে।" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "৪ সংখ্যার সিকিউরিটি পিন সফলভাবে সংরক্ষিত হয়েছে!",
      });
    }

    // 3. VERIFY 4-DIGIT PIN & LOGIN
    if (action === "verify") {
      if (!pin || pin.length !== 4) {
        return NextResponse.json(
          { success: false, message: "৪ সংখ্যার পিন লিখুন।" },
          { status: 400 }
        );
      }

      const { data: setting, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();

      const parsedVal = parseSettingValue(setting?.value);
      if (error || !parsedVal || !parsedVal.pin_hash) {
        return NextResponse.json(
          { success: false, message: "এই নম্বরে কোনো পিন সেট করা নেই। OTP দিয়ে লগইন করুন।" },
          { status: 404 }
        );
      }

      const computedHash = hashPin(pin, cleanPhone);
      if (computedHash !== parsedVal.pin_hash) {
        return NextResponse.json(
          { success: false, message: "ভুল পিন কোড! পুনরায় চেষ্টা করুন অথবা পিন রিসেট করুন।" },
          { status: 401 }
        );
      }

      // PIN is valid! Generate session payload
      const last10 = cleanPhone.slice(-10);
      if (role === "rider") {
        const { data: driversList } = await supabase
          .from("drivers")
          .select("id, name, phone, toto_number, unique_id, is_active, is_available, current_location_name, created_at")
          .or(`phone.ilike.%${last10}%,phone.eq.${cleanPhone},phone.eq.91${last10},phone.eq.+91${last10}`)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5);

        const driver = driversList && driversList.length > 0 ? driversList[0] : null;
        const isRegistered = Boolean(driver);
        let isApproved = false;
        if (driver) {
          isApproved = Boolean(driver.is_active);
          if (driver.current_location_name) {
            try {
              const meta = typeof driver.current_location_name === "string" 
                ? JSON.parse(driver.current_location_name) 
                : driver.current_location_name;
              if (meta.status === "approved" || meta.approved_at) {
                isApproved = true;
              } else if (meta.status === "rejected") {
                isApproved = false;
              } else if (meta.status === "pending_approval" && !driver.is_active) {
                isApproved = false;
              }
            } catch {}
          }
        }

        return NextResponse.json({
          success: true,
          message: "পিন সফলভাবে যাচাই হয়েছে!",
          phone: cleanPhone,
          role: "rider",
          is_registered: isRegistered,
          is_approved: isApproved,
          driver: driver ? {
            ...driver,
            is_approved: isApproved,
          } : { phone: cleanPhone, name: "চালক বন্ধু", is_approved: false },
        });
      } else {
        const { data: customerList } = await supabase
          .from("customers")
          .select("id, name, phone, created_at")
          .or(`phone.ilike.%${last10}%,phone.eq.${cleanPhone},phone.eq.91${last10},phone.eq.+91${last10}`)
          .order("created_at", { ascending: false })
          .limit(5);

        const customer = customerList && customerList.length > 0 ? customerList[0] : null;

        return NextResponse.json({
          success: true,
          message: "পিন সফলভাবে যাচাই হয়েছে!",
          phone: cleanPhone,
          role: "passenger",
          customer: customer || { phone: cleanPhone, name: "যাত্রী বন্ধু" },
        });
      }
    }

    return NextResponse.json({ success: false, message: "অবৈধ অ্যাকশন" }, { status: 400 });
  } catch (err: any) {
    console.error("PIN auth error:", err);
    return NextResponse.json({ success: false, message: err?.message || "সার্ভার ত্রুটি" }, { status: 500 });
  }
}

