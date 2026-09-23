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
}

/**
 * Main State Engine for Sundarban Riders Toto WhatsApp Dispatch & Bot
 */
export async function processTotoMessage(
  ctx: TotoMessageContext
): Promise<OutboundWhatsAppAction | null> {
  const supabase = getSupabaseAdmin();
  const phone = ctx.fromPhone.replace(/[^0-9+]/g, "");

  // 1. Fetch system settings & Bengali templates
  const { data: settingsData } = await supabase
    .from("system_settings")
    .select("key, value");

  const settings: Record<string, string> = {};
  if (settingsData) {
    settingsData.forEach((s) => {
      settings[s.key] = s.value;
    });
  }

  const helpline = settings.helpline_number || "8348122122";
  const baseFare = parseFloat(settings.base_fare || "20");
  const ratePerKm = parseFloat(settings.rate_per_km || "15");

  // 2. Check if sender is a registered driver
  const { data: driver } = await supabase
    .from("drivers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  // 3. Check / Upsert Customer record
  let { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer } = await supabase
      .from("customers")
      .insert({ phone, name: ctx.senderName || "সুন্দরবন কাস্টমার", cancellation_count: 0 })
      .select()
      .single();
    customer = newCustomer;
  }

  const incomingText = (ctx.textBody || ctx.buttonText || "").toLowerCase().trim();
  const payload = ctx.buttonPayload || "";

  // -------------------------------------------------------------
  // FLOW A: 3-STRIKE CANCELLATION CHECK FOR CUSTOMERS
  // -------------------------------------------------------------
  if (customer && (customer.cancellation_count || 0) >= 3) {
    return {
      toPhone: phone,
      type: "text",
      bodyText: `⚠️ 🚫 দুঃখিত, প্রিয় গ্রাহক,\n❌ ৩ বারের বেশি বুকিং বাতিল করায় আপনার নম্বরটি সাময়িকভাবে স্থগিত করা হয়েছে।\n\nবুকিং পরিষেবা পুনরায় সচল করতে হেল্পলাইনে যোগাযোগ করুন:\n📞 হেল্পলাইন: ${helpline}\n❤️ — সুন্দরবন রাইডার্স — ❤️`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B: DRIVER ACTIONS (Accept, Complete, Cancel)
  // -------------------------------------------------------------
  if (payload.startsWith("driver_accept_")) {
    const bookingId = payload.replace("driver_accept_", "");
    
    // Check if ride is still available
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking || booking.status !== "searching") {
      return {
        toPhone: phone,
        type: "text",
        bodyText: `⚠️ দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
      };
    }

    // Assign to this driver
    await supabase
      .from("bookings")
      .update({
        status: "assigned",
        driver_name: driver?.name || "সুন্দরবন চালক",
        driver_phone: phone,
        toto_number: driver?.toto_number || "WB-96-T-XXXX",
      })
      .eq("id", bookingId);

    // Update driver status to busy
    if (driver) {
      await supabase
        .from("drivers")
        .update({ status: "busy" })
        .eq("id", driver.id);
    }

    return {
      toPhone: phone,
      type: "interactive_buttons",
      bodyText: `✨ বুকিং কনফার্ম হয়েছে ✨\n=======================\n🆔 বুকিং নং : #${booking.booking_no || booking.id.slice(0, 8)}\n📞 কাস্টমার নং : ${booking.customer_phone}\n📍 পিকআপ: ${booking.pickup_location || "পিকআপ পয়েন্ট"}\n🏁 ড্রপ: ${booking.drop_location || "গন্তব্য"}\n💵 ভাড়া: ₹${booking.fare}.00\n=======================`,
      buttons: [
        { id: `driver_complete_${booking.id}`, title: "🏁 ট্রিপ সমাপ্ত" },
        { id: `driver_cancel_${booking.id}`, title: "❌ সমস্যা / বাতিল" },
      ],
    };
  }

  if (payload.startsWith("driver_complete_")) {
    const bookingId = payload.replace("driver_complete_", "");
    await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId);

    if (driver) {
      await supabase
        .from("drivers")
        .update({ status: "online" })
        .eq("id", driver.id);
    }

    return {
      toPhone: phone,
      type: "text",
      bodyText: `✅ ট্রিপ সফলভাবে সম্পন্ন হয়েছে!\nভাড়া সংগৃহীত হয়েছে। আপনি পুনরায় নতুন রাইড গ্রহণের জন্য অনলাইন আছেন। ধন্যবাদ! 🙏`,
    };
  }

  // -------------------------------------------------------------
  // FLOW C: CUSTOMER CANCELLATION HANDLER
  // -------------------------------------------------------------
  if (payload === "cancel_ride" || incomingText === "cancel" || incomingText === "বাতিল") {
    const newCancels = (customer?.cancellation_count || 0) + 1;
    await supabase
      .from("customers")
      .update({
        cancellation_count: newCancels,
        is_blocked: newCancels >= 3,
      })
      .eq("phone", phone);

    return {
      toPhone: phone,
      type: "text",
      bodyText: `⚠️ 🚫 গুরুত্বপূর্ণ তথ্য 🚫 ⚠️\nপ্রিয় গ্রাহক,\n❌ ৩ বারের বেশি বুকিং বাতিল (Cancel) করলে আপনার এই নম্বর থেকে আর সুন্দরবন রাইডারের কোনো গাড়ি 🚖 বুক করতে পারবেন না।\n(আপনার বর্তমান বাতিল সংখ্যা: ${newCancels}/৩)\n\n✅ বুকিং পরিষেবা সচল রাখতে দয়া করে সম্পূর্ণ নিশ্চিত হয়ে বুকিং করুন।\n🤝 আমাদের সাথে থাকার জন্য আপনাকে অসংখ্য ধন্যবাদ।\n❤️ — সুন্দরবন রাইডার — ❤️`,
    };
  }

  // -------------------------------------------------------------
  // FLOW D: CUSTOMER DISCLAIMER ACCEPTANCE & BOOKING CONFIRM
  // -------------------------------------------------------------
  if (payload === "agree_disclaimer" || incomingText.includes("সম্মত আছি") || incomingText === "হ্যাঁ") {
    const bookingRef = `SR-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newBooking } = await supabase
      .from("bookings")
      .insert({
        booking_no: bookingRef,
        customer_phone: phone,
        customer_name: ctx.senderName || "গ্রাহক",
        pickup_location: "গোসাবা ফেরিঘাট",
        drop_location: "পাখিরালা মার্কেট",
        distance_km: 4.5,
        fare: 65,
        status: "searching",
      })
      .select()
      .single();

    return {
      toPhone: phone,
      type: "interactive_buttons",
      bodyText: `✨ আপনার বুকিং গ্রহণ করা হয়েছে! ✨\n=======================\n🆔 বুকিং নং : * ${bookingRef} *\n🔍 আপনার কাছাকাছি টোটো খোঁজা হচ্ছে...\n📞 হেল্পলাইন : ${helpline}\n🙏 সুন্দরবন রাইডার্স-এর সাথে থাকার জন্য ধন্যবাদ!`,
      buttons: [
        { id: "cancel_ride", title: "❌ রাইড বাতিল" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW E: CUSTOMER BOOKING INITIATION & DISCLAIMER
  // -------------------------------------------------------------
  if (payload === "book_toto" || incomingText.includes("টোটো") || incomingText === "book") {
    const disclaimer =
      settings.customer_disclaimer_bengali ||
      `বিশেষ দ্রষ্টব্য: ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী\n"সুন্দরবন রাইডার" একটি নিবন্ধিত আইটি এবং আইটিইএস প্ল্যাটফর্ম। এটি চালক ও কাস্টমারদের মধ্যে সরাসরি যোগাযোগের মাধ্যম। যাতায়াতের সময় মালামালের ক্ষতি বা দুর্ঘটনার জন্য প্ল্যাটফর্ম দায়ী থাকবে না।`;

    return {
      toPhone: phone,
      type: "interactive_buttons",
      bodyText: `📋 সুন্দরবন রাইডার্স — রাইড ডিসক্লেইমার ও শর্তাবলী\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${disclaimer}\n\n> ঘোষণা: উপরের সমস্ত শর্তাবলী পড়ে আমি সম্পূর্ণ রাজি আছি।`,
      buttons: [
        { id: "agree_disclaimer", title: "সম্মত আছি (হ্যাঁ)" },
        { id: "cancel_ride", title: "❌ বাতিল" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW F: DRIVER TERMS AGREEMENT
  // -------------------------------------------------------------
  if (payload === "driver_join" || incomingText.includes("চালক")) {
    const driverTerms =
      settings.driver_terms_bengali ||
      `“ সুন্দরবন রাইডার “ চালক নিবন্ধন শর্তাবলী (৭টি ধারা):\n১. স্বাধীন সেবা প্রদানকারী\n২. দুর্ঘটনা দায়বর্জন\n৩. ট্রাফিক নিয়ম মান্য\n৪. মার্জিত আচরণ\n৫. টেক সাপোর্ট ফি\n৬. আইনি সুরক্ষা সম্মতি\n৭. সম্পূর্ণ শর্তাবলীতে সম্মত।`;

    return {
      toPhone: phone,
      type: "interactive_buttons",
      bodyText: `🚖 সুন্দরবন রাইডার্স চালক নিবন্ধন ও ঘোষণা:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${driverTerms}`,
      buttons: [
        { id: "agree_driver_terms", title: "☑️ সম্মত আছি" },
        { id: "cancel_ride", title: "❌ বাতিল" },
      ],
    };
  }

  // -------------------------------------------------------------
  // DEFAULT: MAIN WELCOME MENU (100% Bengali)
  // -------------------------------------------------------------
  return {
    toPhone: phone,
    type: "interactive_buttons",
    bodyText: `🙏 নমস্কার! "সুন্দরবন রাইডার"-এ আপনাকে স্বাগতম।\nআমরা সুন্দরবনের সহজ, দ্রুত ও নিরাপদ টোটো বুকিং প্ল্যাটফর্ম।\n\nঅনুগ্রহ করে নিচের অপশন নির্বাচন করুন:`,
    buttons: [
      { id: "book_toto", title: "🛺 টোটো বুক করুন" },
      { id: "driver_join", title: "🛵 চালক নিবন্ধন" },
    ],
  };
}
