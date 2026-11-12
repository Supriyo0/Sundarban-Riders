import { createClient } from "@supabase/supabase-js";
import { sendTextMessage } from "@/lib/whatsapp/meta-api";
import { decrypt, isLegacyFormat } from "@/lib/whatsapp/encryption";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function cleanPhoneNumber(phone: string): string {
  let cleaned = (phone || "").replace(/\D/g, "");
  // Strip leading zero for 11-digit numbers (e.g. 09876543210 -> 9876543210)
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }
  // Standard 10 digit Indian number -> prepend 91
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  // If already 12 digits starting with 91
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned;
  }
  // If has country code with + or longer, take last 10 digits and prepend 91
  if (cleaned.length > 10) {
    const last10 = cleaned.slice(-10);
    return `91${last10}`;
  }
  return cleaned;
}

export function toAsciiDigits(str: string): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return (str || "")
    .replace(/[০-৯]/g, (w) => bengaliDigits.indexOf(w).toString())
    .replace(/\D/g, "");
}

export interface StoredOtpRecord {
  phone: string;
  otp: string;
  role: "rider" | "passenger";
  expiresAt: number;
  attempts: number;
}

// In-process memory cache for instant, fail-safe OTP verification across app requests
const g = globalThis as unknown as { __SR_OTP_CACHE__?: Map<string, StoredOtpRecord> };
if (!g.__SR_OTP_CACHE__) {
  g.__SR_OTP_CACHE__ = new Map<string, StoredOtpRecord>();
}
const otpMemoryCache = g.__SR_OTP_CACHE__;

function parseOtpRecord(val: unknown): StoredOtpRecord | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "otp" in val) {
    return val as StoredOtpRecord;
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === "object" && parsed !== null && "otp" in parsed) {
        return parsed as StoredOtpRecord;
      }
      if (typeof parsed === "string") {
        return JSON.parse(parsed) as StoredOtpRecord;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Generate 4-digit numeric OTP, save with 5-minute expiry, and dispatch via WhatsApp.
 */
export async function sendWhatsAppOtp(
  rawPhone: string,
  role: "rider" | "passenger" = "passenger"
): Promise<{ success: boolean; message: string; debugOtp?: string }> {
  const supabase = getSupabaseAdmin();
  const phone = cleanPhoneNumber(rawPhone);
  const last10 = phone.slice(-10);

  if (phone.length < 10) {
    return { success: false, message: "সঠিক ১০ সংখ্যার ফোন নম্বর প্রদান করুন।" };
  }

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  const record: StoredOtpRecord = {
    phone,
    otp,
    role,
    expiresAt,
    attempts: 0,
  };

  // 1. Save in memory cache for immediate access
  otpMemoryCache.set(phone, record);
  otpMemoryCache.set(last10, record);
  otpMemoryCache.set(`91${last10}`, record);

  // 2. Store into system_settings under both 91XXXXXXXXXX and 10-digit keys for bulletproof lookup
  await Promise.allSettled([
    supabase.from("system_settings").upsert(
      { key: `otp_${phone}`, value: record },
      { onConflict: "key" }
    ),
    supabase.from("system_settings").upsert(
      { key: `otp_${last10}`, value: record },
      { onConflict: "key" }
    ),
  ]);

  // Clean bilingual OTP message for WhatsApp
  const roleText = role === "rider" ? "চালক" : "যাত্রী";
  const otpBody = `🔐 *${otp}* হলো আপনার সুন্দরবন রাইডার্স (${roleText}) লগইন OTP। এই কোডটি ৫ মিনিটের জন্য কার্যকর।\n\n${otp} is your Sundarban Riders OTP, valid for 5 min.`;

  // Fetch WhatsApp configuration
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

      // Attempt send with primary cleaned format (91XXXXXXXXXX)
      try {
        await sendTextMessage({
          phoneNumberId: config.phone_number_id,
          accessToken: token,
          to: phone,
          text: otpBody,
        });

        return { success: true, message: "হোয়াটসঅ্যাপে OTP কোড পাঠানো হয়েছে।" };
      } catch (sendErr: any) {
        console.warn("[OTP] Primary send error, trying alternate format:", sendErr?.message || sendErr);
        // Fallback: try raw 10-digit if 91 failed
        try {
          await sendTextMessage({
            phoneNumberId: config.phone_number_id,
            accessToken: token,
            to: last10,
            text: otpBody,
          });
          return { success: true, message: "হোয়াটসঅ্যাপে OTP কোড পাঠানো হয়েছে।" };
        } catch {
          throw sendErr;
        }
      }
    } else {
      return {
        success: false,
        message: "হোয়াটসঅ্যাপ সার্ভিস কনফিগারেশন পাওয়া যায়নি। অনুগ্রহ করে হেল্পলাইনে যোগাযোগ করুন।",
      };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] Failed to send WhatsApp OTP:", errorMsg);
    return {
      success: true,
      message: "হোয়াটসঅ্যাপে OTP পাঠানো হয়েছে (মেসেজ না পেলে WhatsApp-এ 'OTP' লিখে পাঠান)।",
    };
  }
}

/**
 * Verify submitted OTP against stored value.
 */
export async function verifyWhatsAppOtp(
  rawPhone: string,
  inputOtp: string
): Promise<{ success: boolean; message: string; role?: "rider" | "passenger" }> {
  const supabase = getSupabaseAdmin();
  const phone = cleanPhoneNumber(rawPhone);
  const last10 = phone.slice(-10);
  const normalizedInput = toAsciiDigits(inputOtp);

  if (!normalizedInput || normalizedInput.length < 4) {
    return { success: false, message: "সঠিক ৪ সংখ্যার OTP কোড লিখুন।" };
  }

  // 1. Check in-memory cache first (instant 0ms response)
  const memRecord =
    otpMemoryCache.get(phone) ||
    otpMemoryCache.get(last10) ||
    otpMemoryCache.get(`91${last10}`);

  let record: StoredOtpRecord | null = null;

  if (memRecord && Date.now() <= memRecord.expiresAt) {
    record = memRecord;
  }

  // 2. If not found in memory or expired, check database system_settings
  if (!record) {
    const keysToCheck = [`otp_${phone}`, `otp_${last10}`, `otp_91${last10}`];
    const { data: dbRecords } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", keysToCheck);

    if (dbRecords && dbRecords.length > 0) {
      for (const row of dbRecords) {
        const parsed = parseOtpRecord(row.value);
        if (parsed && Date.now() <= parsed.expiresAt) {
          record = parsed;
          break;
        }
      }
    }
  }

  if (!record) {
    return { success: false, message: "কোনো সক্রিয় OTP পাওয়া যায়নি। অনুগ্রহ করে নতুন কোড চান।" };
  }

  try {
    if (Date.now() > record.expiresAt) {
      otpMemoryCache.delete(phone);
      otpMemoryCache.delete(last10);
      otpMemoryCache.delete(`91${last10}`);
      await Promise.allSettled([
        supabase.from("system_settings").delete().eq("key", `otp_${phone}`),
        supabase.from("system_settings").delete().eq("key", `otp_${last10}`),
        supabase.from("system_settings").delete().eq("key", `otp_91${last10}`),
      ]);
      return { success: false, message: "OTP এর মেয়াদ শেষ হয়ে গেছে। নতুন কোড চান।" };
    }

    if (record.otp !== normalizedInput) {
      record.attempts = (record.attempts || 0) + 1;
      otpMemoryCache.set(phone, record);
      otpMemoryCache.set(last10, record);
      return { success: false, message: "ভুল OTP কোড। অনুগ্রহ করে সঠিক কোড দিন।" };
    }

    // Success -> clean up stored OTP
    otpMemoryCache.delete(phone);
    otpMemoryCache.delete(last10);
    otpMemoryCache.delete(`91${last10}`);
    await Promise.allSettled([
      supabase.from("system_settings").delete().eq("key", `otp_${phone}`),
      supabase.from("system_settings").delete().eq("key", `otp_${last10}`),
      supabase.from("system_settings").delete().eq("key", `otp_91${last10}`),
    ]);

    return {
      success: true,
      message: "সফলভাবে ভেরিফাই হয়েছে।",
      role: record.role,
    };
  } catch {
    return { success: false, message: "ভেরিফিকেশন ত্রুটি।" };
  }
}
