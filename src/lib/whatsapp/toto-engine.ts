import { createClient } from "@supabase/supabase-js";

// Helper to get Supabase Admin client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface TotoMessageContext {
  fromPhone: string;
  senderName?: string;
  textBody?: string;
  buttonPayload?: string;
  buttonText?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface OutboundWhatsAppAction {
  toPhone: string;
  type: "text" | "interactive_buttons" | "location_request";
  bodyText: string;
  buttons?: Array<{ id: string; title: string }>;
  extraNotifications?: Array<{
    toPhone: string;
    type: "text" | "interactive_buttons";
    bodyText: string;
    buttons?: Array<{ id: string; title: string }>;
  }>;
}

interface CustomerBookingState {
  step: "awaiting_location" | "awaiting_drop";
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  timestamp: number;
}

const customerBookingStates = new Map<string, CustomerBookingState>();

let cachedSettings: Record<string, string> | null = null;
let cachedSettingsTime = 0;
const SETTINGS_TTL_MS = 60 * 1000;

async function getCachedSettings(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettingsTime < SETTINGS_TTL_MS) {
    return cachedSettings;
  }
  try {
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value");

    const settings: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach((s) => {
        settings[s.key] = s.value;
      });
    }
    cachedSettings = settings;
    cachedSettingsTime = now;
    return settings;
  } catch {
    return cachedSettings ?? {};
  }
}

export const DEFAULT_TOTO_CUSTOMER_DISCLAIMER = `বিশেষ দ্রষ্টব্য: ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী
"সুন্দরবন রাইডার" একটি নিবন্ধিত IT & ITES প্ল্যাটফর্ম। রেজিস্ট্রেশন, লাইসেন্স ও GST নিয়মাফিক সুরক্ষিত। এই প্ল্যাটফর্মটি স্থানীয় টোটো চালক ও যাত্রীদের সরাসরি যোগাযোগের মাধ্যম। রাইড বুক করার পূর্বে শর্তাবলি পড়ে নিন:

* দায়বদ্ধতার সীমাবদ্ধতা: যাতায়াতে কোনো মালামালের ক্ষতি, চুরি বা দুর্ঘটনার জন্য ‘সুন্দরবন রাইডার’ কর্তৃপক্ষ কোনোভাবেই দায়ী থাকবে না।

* চালক ও যাত্রীর দায়: চালক স্বাধীনভাবে গাড়ি চালান এবং কাস্টমার সম্পূর্ণ নিজ দায়িত্বে ও ঝুঁকিতে ভ্রমণ করবেন।

* রেট চার্ট ও পেমেন্ট: নির্ধারিত রেট চার্ট অনুযায়ী ভাড়া প্রযোজ্য হবে এবং বুকিংয়ের মাধ্যমেই কাস্টমার এতে সম্মত হচ্ছেন।

> ঘোষণা: সমস্ত শর্তাবলি ও রেট চার্ট দেখে আমি স্বেচ্ছায় রাইড নিচ্ছি এবং প্ল্যাটফর্মটিকে সকল আইনি দায়বদ্ধতা থেকে মুক্ত রাখছি।

💫 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে... "সুন্দরবন রাইডার" 🙏ধন্যবাদ`;

export const DEFAULT_TOTO_WELCOME_MESSAGE = `🙏 সুন্দরবন রাইডারে স্বাগতম 🙏

🚘আমাদের পরিবারে যুক্ত হওয়ার জন্য আপনাকে অসংখ্য ধন্যবাদ ।
আপনার যাত্রা কে আরও সহজ, সুরক্ষিত ও নিশ্চিত করতে, এই প্রথম মাত্র ৫-৭ মিনিটে অনলাইন স্মার্ট টোটো বুকিং সার্ভিস ২৪ x ৭ !

👉 জরুরি প্রয়োজনে নম্বরটি সেভ এবং শেয়ার করুন আপনার প্রিয়জনদের সাথে 🌷

🎯 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে 👉 সুন্দরবন রাইডার 🎯
📞 যোগাযোগ মাধ্যম:
• WhatsApp Only: 8348122122
• Email: sr.rider122@gmail.com

🙏 ধন্যবাদ🙏

━━━━━━━━━━━━━━━━━━━━━
🙏 নমস্কার! "সুন্দরবন রাইডার"-এ আপনাকে স্বাগতম।
আমরা সুন্দরবনের সহজ, দ্রুত ও নিরাপদ টোটো বুকিং প্ল্যাটফর্ম।

অনুগ্রহ করে নিচের অপশন নির্বাচন করুন:`;

interface DriverRecord {
  id: string;
  name?: string;
  phone: string;
  status?: string;
  is_approved?: boolean;
  is_blocked?: boolean;
  is_online?: boolean;
  toto_number?: string;
  vehicle_number?: string;
}

interface CustomerRecord {
  id: string;
  phone: string;
  name?: string;
  cancellation_count?: number;
  is_blocked?: boolean;
}

/**
 * Main State Engine for Sundarban Riders Toto WhatsApp Dispatch & Bot
 */
export async function processTotoMessage(
  ctx: TotoMessageContext
): Promise<OutboundWhatsAppAction | null> {
  const supabase = getSupabaseAdmin();
  const rawPhone = ctx.fromPhone.replace(/[^0-9+]/g, "");
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  const last10 = cleanPhone.slice(-10);

  let driverQuery = Promise.resolve<{ data: DriverRecord | null; error: unknown }>({ data: null, error: null });
  try {
    driverQuery = Promise.resolve(
      supabase
        .from("drivers")
        .select("*")
        .or(`phone.eq.${rawPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${last10}`)
        .limit(1)
        .maybeSingle()
    ).catch(() => ({ data: null, error: null }));
  } catch {
    driverQuery = Promise.resolve({ data: null, error: null });
  }

  let customerQuery = Promise.resolve<{ data: CustomerRecord | null; error: unknown }>({ data: null, error: null });
  try {
    customerQuery = Promise.resolve(
      supabase
        .from("customers")
        .select("*")
        .or(`phone.eq.${rawPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${last10}`)
        .limit(1)
        .maybeSingle()
    ).catch(() => ({ data: null, error: null }));
  } catch {
    customerQuery = Promise.resolve({ data: null, error: null });
  }

  // 1 & 2 & 3. Parallel fetch: Cached system settings, driver check, customer check
  const [settings, driverRes, customerRes] = await Promise.all([
    getCachedSettings(supabase),
    driverQuery,
    customerQuery,
  ]);

  const helpline = settings.helpline_number || "8348122122";
  const driver = (driverRes?.data as DriverRecord | null) ?? null;
  const customer = (customerRes?.data as CustomerRecord | null) ?? null;

  // Background customer sync (non-blocking)
  if (!customer) {
    void Promise.resolve(
      supabase
        .from("customers")
        .insert({ phone: cleanPhone, name: ctx.senderName || "সুন্দরবন কাস্টমার", cancellation_count: 0 })
    ).catch(() => {});
  }

  const incomingText = (ctx.textBody || ctx.buttonText || "").toLowerCase().trim();
  const payload = ctx.buttonPayload || "";

  // -------------------------------------------------------------
  // FLOW A: 3-STRIKE CANCELLATION CHECK FOR CUSTOMERS
  // -------------------------------------------------------------
  if (customer && (customer.cancellation_count || 0) >= 3) {
    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `⚠️ 🚫 দুঃখিত, প্রিয় গ্রাহক,\n❌ ৩ বারের বেশি বুকিং বাতিল করায় আপনার নম্বরটি সাময়িকভাবে স্থগিত করা হয়েছে।\n\nবুকিং পরিষেবা পুনরায় সচল করতে হেল্পলাইনে যোগাযোগ করুন:\n📞 হেল্পলাইন: ${helpline}\n❤️ — সুন্দরবন রাইডার্স — ❤️`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B: DRIVER ACTIONS (Accept, Decline, Start, Complete)
  // -------------------------------------------------------------
  if (payload.startsWith("driver_accept_")) {
    const bookingId = payload.replace("driver_accept_", "");
    
    // Check if ride is still available (status === 'pending')
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .or(`id.eq.${bookingId},booking_number.eq.${bookingId}`)
      .maybeSingle();

    if (!booking || booking.status !== "pending") {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
        buttons: [{ id: "driver_go_offline", title: "🔴 অফলাইন যান" }],
      };
    }

    // Assign to this driver
    await supabase
      .from("bookings")
      .update({
        status: "assigned",
        driver_id: driver?.id,
      })
      .eq("id", booking.id);

    if (driver) {
      void Promise.resolve(
        supabase.from("drivers").update({ is_available: false, is_active: true }).eq("id", driver.id)
      ).catch(() => {});
    }

    const pickupLoc = booking.pickup_location || "পিকআপ পয়েন্ট";
    const isCoords = pickupLoc.includes(",") && !isNaN(Number(pickupLoc.split(",")[0]));
    const gmapUrl = isCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${pickupLoc.replace(/\s+/g, '')}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickupLoc)}`;

    const extraNotifications = [
      {
        toPhone: booking.customer_phone,
        type: "text" as const,
        bodyText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨\n=======================\n🛺 চালক: ${driver?.name || "সুন্দরবন চালক"}\n📞 ফোন: ${driver?.phone || rawPhone}\n🚘 টোটো নম্বর: ${driver?.toto_number || driver?.vehicle_number || "WB-96-T-XXXX"}\n=======================\nচালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন।`,
      },
    ];

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `🎉 রাইড গ্রহণ সফল হয়েছে!\n=======================\n👤 যাত্রী: ${booking.customer_name || "গ্রাহক"}\n📞 ফোন: ${booking.customer_phone}\n📍 পিকআপ: ${booking.pickup_location}\n🏁 গন্তব্য: ${booking.drop_location}\n💵 ভাড়া: ₹${booking.estimated_fare}.00\n=======================\n🗺️ কাস্টমারের রিয়েলটাইম পিকআপ লোকেশনে পৌঁছানোর জন্য নিচের গুগল ম্যাপ লিংকে ক্লিক করুন:\n👉 ${gmapUrl}\n\n(যাত্রী গাড়িতে উঠলে নিচের 'যাত্রা শুরু' বোতামে চাপ দিন)`,
      buttons: [
        { id: `driver_start_${booking.id}`, title: "🚀 যাত্রা শুরু" },
      ],
      extraNotifications,
    };
  }

  if (payload.startsWith("driver_decline_")) {
    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `❌ আপনি রাইডটি প্রত্যাখ্যান করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
      buttons: [
        { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
      ],
    };
  }

  if (payload.startsWith("driver_start_")) {
    const bookingId = payload.replace("driver_start_", "");
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .or(`id.eq.${bookingId},booking_number.eq.${bookingId}`)
      .maybeSingle();

    if (booking) {
      await supabase.from("bookings").update({ status: "in_progress" }).eq("id", booking.id);
    }

    const extraNotifications = booking?.customer_phone ? [
      {
        toPhone: booking.customer_phone,
        type: "text" as const,
        bodyText: `🛺 আপনার যাত্রা শুরু হয়েছে! সুন্দরবন রাইডারের সাথে আপনার যাত্রা শুভ ও নিরাপদ হোক।`,
      },
    ] : [];

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `🟢 যাত্রা শুরু হয়েছে! সাবধানে ড্রাইভ করুন।\n\n🏁 গন্তব্যে পৌঁছে ট্রিপ সমাপ্ত করতে নিচের বোতামে চাপ দিন:`,
      buttons: [
        { id: `driver_complete_${booking?.id || bookingId}`, title: "🏁 ট্রিপ সমাপ্ত" },
      ],
      extraNotifications,
    };
  }

  if (payload.startsWith("driver_complete_")) {
    const bookingId = payload.replace("driver_complete_", "");
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .or(`id.eq.${bookingId},booking_number.eq.${bookingId}`)
      .maybeSingle();

    if (booking) {
      await supabase.from("bookings").update({
        status: "completed",
        final_fare: booking.estimated_fare,
      }).eq("id", booking.id);
    }

    if (driver) {
      void Promise.resolve(
        supabase.from("drivers").update({ is_available: true, is_active: true }).eq("id", driver.id)
      ).catch(() => {});
    }

    const extraNotifications = booking?.customer_phone ? [
      {
        toPhone: booking.customer_phone,
        type: "interactive_buttons" as const,
        bodyText: `🙏 সুন্দরবন রাইডার ব্যবহারের জন্য অসংখ্য ধন্যবাদ!\n=======================\n🧾 রাইড রসিদ (Ride Receipt)\n🆔 বুকিং নং: #${booking.booking_number || booking.id.slice(0, 8)}\n📍 পিকআপ: ${booking.pickup_location}\n🏁 গন্তব্য: ${booking.drop_location}\n💵 পরিশোধিত ভাড়া: ₹${booking.estimated_fare}.00\n=======================\nআপনার যাত্রা সুখকর ও নিরাপদ হয়েছে আশা করি। আবার দেখা হবে! 🌷`,
        buttons: [
          { id: "book_toto", title: "🛺 নতুন টোটো বুকিং" },
        ],
      },
    ] : [];

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `✅ ট্রিপ সফলভাবে সম্পন্ন হয়েছে!\n=======================\n💵 ভাড়া সংগৃহীত: ₹${booking?.estimated_fare || 50}.00\n=======================\nআপনি পুনরায় নতুন রাইড গ্রহণের জন্য অনলাইন আছেন। ধন্যবাদ! 🙏`,
      buttons: [
        { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
      ],
      extraNotifications,
    };
  }

  // -------------------------------------------------------------
  // FLOW C: CUSTOMER CANCELLATION HANDLER
  // -------------------------------------------------------------
  if (payload === "cancel_ride" || incomingText === "cancel" || incomingText === "বাতিল") {
    customerBookingStates.delete(cleanPhone);
    const newCancels = (customer?.cancellation_count || 0) + 1;
    void Promise.resolve(
      supabase
        .from("customers")
        .update({
          cancellation_count: newCancels,
          is_blocked: newCancels >= 3,
        })
        .eq("phone", cleanPhone)
    ).catch(() => {});

    // Cancel any pending booking
    void Promise.resolve(
      supabase
        .from("bookings")
        .update({ status: "cancelled", cancelled_by: "customer" })
        .eq("customer_phone", cleanPhone)
        .eq("status", "pending")
    ).catch(() => {});

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `⚠️ 🚫 গুরুত্বপূর্ণ তথ্য 🚫 ⚠️\nপ্রিয় গ্রাহক,\n❌ ৩ বারের বেশি বুকিং বাতিল (Cancel) করলে আপনার এই নম্বর থেকে আর সুন্দরবন রাইডারের কোনো গাড়ি 🚖 বুক করতে পারবেন না।\n(আপনার বর্তমান বাতিল সংখ্যা: ${newCancels}/৩)\n\n✅ বুকিং পরিষেবা সচল রাখতে দয়া করে সম্পূর্ণ নিশ্চিত হয়ে বুকিং করুন।\n🤝 আমাদের সাথে থাকার জন্য আপনাকে অসংখ্য ধন্যবাদ।\n❤️ — সুন্দরবন রাইডার — ❤️`,
    };
  }

  // -------------------------------------------------------------
  // FLOW D: CUSTOMER DISCLAIMER ACCEPTED -> ASK FOR PICKUP LOCATION
  // -------------------------------------------------------------
  if (
    payload === "agree_disclaimer" ||
    (incomingText.includes("সম্মত আছি") && !incomingText.includes("চালক")) ||
    incomingText === "হ্যাঁ"
  ) {
    customerBookingStates.set(cleanPhone, {
      step: "awaiting_location",
      timestamp: Date.now(),
    });

    void Promise.resolve(
      supabase.from("customers").upsert(
        {
          phone: cleanPhone,
          name: ctx.senderName || "গ্রাহক",
          disclaimer_agreed: true,
          disclaimer_agreed_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      )
    ).catch(() => {});

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `📍 আপনার বর্তমান অবস্থান (Current Pickup Location) প্রয়োজন:\n\nদয়া করে নিচের মতো করে আপনার পিকআপ লোকেশন শেয়ার করুন:\n👉 WhatsApp-এর Attach (📎) আইকনে ক্লিক করে 'Location' সিলেক্ট করুন এবং আপনার Current Location সেন্ড করুন।\n\n(অথবা আপনার পিকআপ জায়গার নাম লিখে পাঠান, যেমন: "গোসাবা ফেরিঘাট")`,
    };
  }

  // -------------------------------------------------------------
  // FLOW E: LOCATION & DESTINATION INPUT FROM CUSTOMER
  // -------------------------------------------------------------
  const bookingState = customerBookingStates.get(cleanPhone);
  if (bookingState && !payload) {
    if (bookingState.step === "awaiting_location") {
      let pickup = "";
      if (ctx.location?.latitude && ctx.location?.longitude) {
        pickup = ctx.location.name || ctx.location.address || `${ctx.location.latitude}, ${ctx.location.longitude}`;
      } else if (incomingText) {
        pickup = ctx.textBody?.trim() || incomingText;
      }

      if (pickup) {
        customerBookingStates.set(cleanPhone, {
          step: "awaiting_drop",
          pickupLocation: pickup,
          pickupLat: ctx.location?.latitude,
          pickupLng: ctx.location?.longitude,
          timestamp: Date.now(),
        });

        return {
          toPhone: rawPhone,
          type: "text",
          bodyText: `📍 পিকআপ লোকেশন গ্রহণ করা হয়েছে:\n"${pickup}"\n\n🏁 এবার অনুগ্রহ করে আপনার গন্তব্যের নাম (Drop Location) লিখে পাঠান (যেমন: "পাখিরালা বাজার"):`,
        };
      }
    } else if (bookingState.step === "awaiting_drop" && incomingText) {
      const dropLocation = ctx.textBody?.trim() || incomingText;
      const pickupLocation = bookingState.pickupLocation || "পিকআপ লোকেশন";
      customerBookingStates.delete(cleanPhone);

      const bookingNumber = `SR-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: newBooking } = await supabase.from("bookings").insert({
        booking_number: bookingNumber,
        customer_phone: cleanPhone,
        customer_name: ctx.senderName || "গ্রাহক",
        pickup_location: pickupLocation,
        drop_location: dropLocation,
        estimated_fare: 50,
        status: "pending",
      }).select().maybeSingle();

      // Query online drivers
      const { data: onlineDrivers } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .eq("is_available", true);

      const extraNotifications = (onlineDrivers || []).map((d) => ({
        toPhone: d.phone,
        type: "interactive_buttons" as const,
        bodyText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺\n=======================\n🆔 বুকিং নং: #${bookingNumber}\n👤 যাত্রী: ${ctx.senderName || "গ্রাহক"}\n📞 ফোন: ${cleanPhone}\n📍 পিকআপ: ${pickupLocation}\n🏁 গন্তব্য: ${dropLocation}\n💵 আনুমানিক ভাড়া: ₹50.00\n=======================\nআপনি কি এই রাইডটি গ্রহণ করতে চান?`,
        buttons: [
          { id: `driver_accept_${newBooking?.id || bookingNumber}`, title: "✅ রাইড গ্রহণ" },
          { id: `driver_decline_${newBooking?.id || bookingNumber}`, title: "❌ প্রত্যাখ্যান" },
        ],
      }));

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `✨ আপনার বুকিং তৈরি হয়েছে! ✨\n=======================\n🆔 বুকিং নং: * #${bookingNumber} *\n📍 পিকআপ: ${pickupLocation}\n🏁 গন্তব্য: ${dropLocation}\n💵 আনুমানিক ভাড়া: ₹50.00\n=======================\n🔍 আপনার কাছাকাছি টোটো চালকদের কাছে অনুরোধ পাঠানো হয়েছে... চালক গ্রহণ করলে আপনাকে সাথে সাথে জানানো হবে।`,
        buttons: [
          { id: "cancel_ride", title: "❌ বুকিং বাতিল" },
        ],
        extraNotifications,
      };
    }
  }

  // -------------------------------------------------------------
  // FLOW F: CUSTOMER BOOKING INITIATION & DISCLAIMER (Only Accept Button)
  // -------------------------------------------------------------
  if (
    payload === "book_toto" ||
    incomingText.includes("টোটো") ||
    incomingText.includes("toto") ||
    incomingText === "book"
  ) {
    const disclaimer =
      settings.customer_disclaimer_bengali ||
      DEFAULT_TOTO_CUSTOMER_DISCLAIMER;

    if (disclaimer.length <= 1024) {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: disclaimer,
        buttons: [
          { id: "agree_disclaimer", title: "✅ সম্মত আছি" },
        ],
      };
    }

    // Disclaimer exceeds Meta's 1024 char interactive body limit:
    // 1. Send the full legal terms as text (Meta allows up to 4096 chars)
    // 2. Immediately follow with the interactive confirmation button
    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: disclaimer,
      extraNotifications: [
        {
          toPhone: rawPhone,
          type: "interactive_buttons",
          bodyText: "👆 উপরের ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলীতে আপনি কি রাজি আছেন?\n\nবুকিং এগিয়ে নিতে নিচের বোতামে চাপুন:",
          buttons: [
            { id: "agree_disclaimer", title: "✅ সম্মত আছি" },
          ],
        },
      ],
    };
  }

  // Check if driver is registered and approved
  const isRegisteredDriver = Boolean(
    driver &&
    driver.is_approved !== false &&
    driver.is_blocked !== true &&
    driver.status !== "blocked"
  );

  // -------------------------------------------------------------
  // FLOW G: TAKE RIDE (RIDER / DRIVER FLOW)
  // -------------------------------------------------------------
  if (
    payload === "take_ride" ||
    payload === "driver_join" ||
    incomingText.includes("রাইড নিন") ||
    incomingText.includes("take ride")
  ) {
    if (isRegisteredDriver && driver) {
      // Driver is registered -> turn online and show offline toggle button
      void Promise.resolve(
        supabase
          .from("drivers")
          .update({ is_active: true, is_available: true })
          .eq("id", driver.id)
      ).catch(() => {});

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🟢 আপনি এখন অনলাইন আছেন!\nশীঘ্রই আপনার কাছে নতুন রাইড বা বুকিংয়ের নোটিফিকেশন পৌঁছে যাবে।\n\n(ডিউটি সাময়িকভাবে বন্ধ করতে নিচের 'অফলাইন যান' বোতামে চাপুন)`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
        ],
      };
    } else {
      // User is NOT registered as a rider -> loop back to welcome menu
      const welcomeText = settings.welcome_message_bengali || DEFAULT_TOTO_WELCOME_MESSAGE;
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: welcomeText,
        buttons: [
          { id: "book_toto", title: "🛺 টোটো বুক করুন" },
          { id: "take_ride", title: "🛵 রাইড নিন" },
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // FLOW H: DRIVER GO OFFLINE
  // -------------------------------------------------------------
  if (
    payload === "driver_go_offline" ||
    incomingText.includes("অফলাইন") ||
    incomingText.includes("offline")
  ) {
    if (driver) {
      void Promise.resolve(
        supabase
          .from("drivers")
          .update({ is_active: false, is_available: false })
          .eq("id", driver.id)
      ).catch(() => {});
    }

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `⚪ আপনি এখন অফলাইনে আছেন।\nপুনরায় ডিউটি শুরু করতে নিচের '🛵 রাইড নিন' বোতামে চাপুন।`,
      buttons: [
        { id: "take_ride", title: "🛵 রাইড নিন" },
      ],
    };
  }

  // -------------------------------------------------------------
  // DEFAULT: MAIN WELCOME MENU (100% Bengali)
  // -------------------------------------------------------------
  const welcomeText = settings.welcome_message_bengali || DEFAULT_TOTO_WELCOME_MESSAGE;

  return {
    toPhone: rawPhone,
    type: "interactive_buttons",
    bodyText: welcomeText,
    buttons: [
      { id: "book_toto", title: "🛺 টোটো বুক করুন" },
      { id: "take_ride", title: "🛵 রাইড নিন" },
    ],
  };
}
