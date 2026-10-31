import type { SupabaseClient } from "@supabase/supabase-js";

export interface WhatsAppTemplateDefinition {
  key: string;
  nameBengali: string;
  category: "customer_ride" | "driver_ride" | "general" | "driver_onboarding";
  description: string;
  defaultText: string;
  variables: string[]; // e.g. ["{{booking_number}}", "{{customer_name}}"]
}

export const ALL_WHATSAPP_TEMPLATES: WhatsAppTemplateDefinition[] = [
  // -------------------------------------------------------------
  // GENERAL / ONBOARDING
  // -------------------------------------------------------------
  {
    key: "welcome_message",
    nameBengali: "স্বাগতম মেসেজ ও প্রধান মেনু",
    category: "general",
    description: "গ্রাহক বা চালক প্রথমবার 'Hi' বা কোনো মেসেজ পাঠালে এই স্বাগতম বার্তাটি যাবে।",
    variables: ["{{name}}", "{{helpline}}"],
    defaultText: `🙏 নমস্কার{{name}},🙏
"সুন্দরবন রাইডার" একটি আধুনিক ডিজিটাল তথ্যপ্রযুক্তিভিত্তিক মধ্যস্থতাকারী প্ল্যাটফর্ম (IT & ITeS Enabler), যা আপনার যাত্রাকে দ্রুত, সহজ ও সুরক্ষিত করতে স্থানীয় অনুমোদিত স্বাধীন টোটো চালকদের সঙ্গে প্রযুক্তিগত সংযোগ স্থাপন পরিষেবা প্রদান করে ।

📲 আমাদের অফিসিয়াল গুগল প্লে-স্টোর অ্যাপ:
👉 https://play.google.com/store/apps/details?id=com.sundarbanriders.app

🏛️ সরকারি স্বীকৃতি ও আইনি তথ্য:
📜 ট্রেড রেজিস্ট্রেশন নং: 1554
🏛️ উদ্যম রেজিস্ট্রেশন নং: UDYAM-WB-18-0208526
📞 হেল্পলাইন: {{helpline}}
📧 ইমেল: sr.rider122@gmail.com

🚨 জরুরি সহায়তা ও নিরাপত্তা নম্বর:
 জাতীয় জরুরি হেল্পলাইন (পুলিশ ও আপদকালীন): 112
নারী সুরক্ষা হেল্পলাইন: 1091 / 181
অ্যাম্বুলেন্স পরিষেবা: 102`,
  },
  {
    key: "customer_disclaimer",
    nameBengali: "আইনি ডিসক্লেইমার ও শর্তাবলী",
    category: "general",
    description: "যাত্রী বুকিং শুরু করার পূর্বে আইনি ডিসক্লেইমার ও শর্তাবলী নির্দেশিকা।",
    variables: ["{{name}}"],
    defaultText: `📜 আইনি ডিসক্লেইমার ও শর্তাবলী 
"সুন্দরবন রাইডার" কেবল একটি ডিজিটাল তথ্যপ্রযুক্তি মধ্যস্থতাকারী প্ল্যাটফর্ম (IT & ITeS Enabler), 
বুকিং করার পূর্বে সংযুক্ত PDF টি পড়ে নিন ।
বুকিং নিশ্চিত করতে "সম্মত আছি" বাটনে চাপ দিন ।`,
  },
  {
    key: "driver_terms",
    nameBengali: "চালক চুক্তি ও শর্তাবলী",
    category: "driver_onboarding",
    description: "চালক রেজিস্ট্রেশনের সময় প্রদর্শিত ৭টি পেশাদার নিয়ম ও শর্তাবলী।",
    variables: [],
    defaultText: `🛺 *সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী* 🛺
==============================
নমস্কার! সুন্দরবন রাইডার প্ল্যাটফর্মে পরিষেবা শুরু করার পূর্বে চালক চুক্তি ও শর্তাবলি পড়ে সম্মতি দিন:

১. আপনি একজন স্বাধীন সেবা প্রদানকারী (Independent Service Provider)।
২. যেকোনো দুর্ঘটনার দায় সম্পূর্ণ চালকের, সুন্দরবন রাইডার্স কোনোভাবেই দায়ী থাকবে না।
৩. যাত্রী নিরাপত্তা ও ট্রাফিক নিয়ম মানা বাধ্যতামূলক।
৪. যাত্রীদের সাথে মার্জিত ও বিনম্র আচরণ বজায় রাখতে হবে।
৫. প্ল্যাটফর্ম টেকনোলজি ফি প্রযোজ্য হতে পারে।
৬. নিয়মানুবর্তিতা ও আইনি সুরক্ষায় সুন্দরবন রাইডার্স পূর্ণ অধিকার সংরক্ষণ করে।

📄 বিস্তারিত অফিসিয়াল চালক চুক্তি PDF ফাইলে সংযুক্ত করা হলো।

> আপনি কি উপরোক্ত সকল শর্তাবলীতে সম্মত আছেন?`,
  },

  // -------------------------------------------------------------
  // DRIVER ALERTS
  // -------------------------------------------------------------
  {
    key: "driver_new_booking_alert",
    nameBengali: "চালকদের নতুন বুকিং রিকোয়েস্ট অ্যালার্ট",
    category: "driver_ride",
    description: "৫ কিমি রেডিয়াসের অনলাইন চালকদের কাছে রাইড গ্রহণের জন্য এই বার্তাটি পাঠানো হয়।",
    variables: [
      "{{booking_number}}",
      "{{customer_name}}",
      "{{customer_phone}}",
      "{{passenger_count}}",
      "{{pickup_location}}",
      "{{drop_location}}",
    ],
    defaultText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺
=======================
🆔 বুকিং নং: #{{booking_number}}
👤 যাত্রী: {{customer_name}}
👥 যাত্রী সংখ্যা: {{passenger_count}} জন
📞 ফোন: {{customer_phone}}
📍 পিকআপ: {{pickup_location}}
🏁 গন্তব্য: {{drop_location}}
=======================
আপনি কি এই রাইডটি গ্রহণ করতে চান?`,
  },
  {
    key: "ride_cancelled_to_driver",
    nameBengali: "যাত্রী বাতিল করলে চালককে নোটিফিকেশন",
    category: "driver_ride",
    description: "যাত্রী কোনো কারণে বুকিং বাতিল করলে চালকের কাছে এই নোটিফিকেশন যায়।",
    variables: ["{{booking_number}}", "{{reason}}"],
    defaultText: `⚠️ যাত্রী রাইড বাতিল করেছেন{{reason}}। বুকিং #{{booking_number}} বাতিল হয়েছে। আপনি পরবর্তী রাইডের জন্য প্রস্তুত।`,
  },

  // -------------------------------------------------------------
  // PASSENGER RIDE LIFECYCLE
  // -------------------------------------------------------------
  {
    key: "passenger_booking_created",
    nameBengali: "নিকটবর্তী চালকের সন্ধান নোটিফিকেশন",
    category: "customer_ride",
    description: "নিকটস্থ ৫ কিমির মধ্যে চালক খোঁজার সময় এই নোটিফিকেশন যাবে।",
    variables: [
      "{{booking_number}}",
      "{{pickup_location}}",
      "{{drop_location}}",
    ],
    defaultText: `✨ নিকটবর্তী চালকের সন্ধান চলছে... ✨
=======================
🆔 বুকিং আইডি: #SR{{booking_number}}
📍 পিক-আপ: {{pickup_location}}
🏁 গন্তব্য: {{drop_location}}
=======================
🔍 আপনার নিকটস্থ ৫ কিমির মধ্যে সক্রিয় অনুমোদিত স্বাধীন চালকদের কাছে অনুরোধ পাঠানো হয়েছে।
⏳ চালক রাইড গ্রহণ করামাত্রই আপনাকে ওটিপি (OTP), চালকের নাম, ফোন নম্বর ও টোটো নম্বর জানিয়ে দেওয়া হবে।
(অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন...)`,
  },
  {
    key: "passenger_ride_assigned",
    nameBengali: "চালক রাইড গ্রহণ করলে যাত্রীকে ওটিপি সহ নোটিফিকেশন",
    category: "customer_ride",
    description: "চালক রাইড গ্রহণ করলে যাত্রীর কাছে বুকিং আইডি, চালকের বিস্তারিত ও যাত্রা শুরুর OTP যায়।",
    variables: [
      "{{booking_id}}",
      "{{booking_number}}",
      "{{driver_name}}",
      "{{driver_phone}}",
      "{{driver_id}}",
      "{{unique_id}}",
      "{{toto_number}}",
      "{{pickup_location}}",
      "{{drop_location}}",
      "{{start_otp}}",
    ],
    defaultText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨
=======================
🆔 বুকিং আইডি: #SR-{{booking_id}}
🛺 চালক: {{driver_name}} (স্বাধীন চালক)
📞 ফোন: {{driver_phone}}
🆔 চালক আইডি: {{driver_id}}
🛺 টোটো নম্বর: {{toto_number}}
=======================
🔐 রাইড শুরুর ওটিপি: *{{start_otp}}*
(চালক পিকআপে পৌঁছালে যাত্রা শুরু করতে এই ওটিপিটি চালককে দিন)
=======================
চালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন।

💰 প্রস্তাবিত ভাড়া (Mutual Fare): চালকের মিটার অনুযায়ী সরাসরি চালককে প্রদান করবেন।
⚠️ সরকারি নিয়মে টোটোতে চালকসহ সর্বোচ্চ ৫ জন অনুমোদিত।`,
  },
  {
    key: "passenger_trip_started",
    nameBengali: "যাত্রা শুরু নোটিফিকেশন (OTP ভেরিফাইড)",
    category: "customer_ride",
    description: "চালক যাত্রীর কাছ থেকে OTP নিয়ে যাত্রা শুরু করলে যাত্রীকে পাঠানো নোটিফিকেশন।",
    variables: ["{{booking_number}}", "{{driver_name}}", "{{helpline}}", "{{sos_number}}"],
    defaultText: `🛺 আপনার সুন্দরবন রাইডার্স যাত্রা শুরু হয়েছে!
=======================
🆔 বুকিং নং: #{{booking_number}}
🛺 চালক: {{driver_name}}
📞 হেল্পলাইন / SOS: 8348122122 / 112
=======================
নিরাপদে ভ্রমণ করুন। যেকোনো জরুরি প্রয়োজনে অ্যাপে SOS হেল্পলাইন ব্যবহার করুন।`,
  },
  {
    key: "passenger_trip_completed",
    nameBengali: "ডিজিটাল রসিদ ও ট্রিপ সমাপ্তি",
    category: "customer_ride",
    description: "গন্তব্যে পৌঁছালে দূরত্ব ও চূড়ান্ত সংগৃহীত ভাড়া সহ রসিদ।",
    variables: ["{{booking_number}}", "{{drop_location}}", "{{final_fare}}"],
    defaultText: `🎉 আপনার যাত্রা সফলভাবে সম্পন্ন হয়েছে!
=======================
🏁 গন্তব্য: {{drop_location}}
💰 মোট প্রদেয় ভাড়া: ₹{{final_fare}}
=======================
ℹ️ ভাড়ার এই হিসাবটি চালকের নিজস্ব এবং তাঁর অ্যাপ থেকে সরাসরি প্রদর্শিত। "সুন্দরবন রাইডার" কেবল ডিজিটাল প্রযুক্তি মধ্যস্থতাকারী (IT  Enabler); তাই নগদ বা UPI-এর মাধ্যমে ভাড়া সরাসরি চালককেই প্রদান করুন।

আপনার মূল্যবান অভিজ্ঞতা ও সেবার মান উন্নত রাখতে নিচের অপশন বেছে নিন:`,
  },
  {
    key: "ride_cancelled_to_passenger",
    nameBengali: "চালক বাতিল করলে যাত্রীকে নোটিফিকেশন",
    category: "customer_ride",
    description: "চালক কোনো কারণে রাইড বাতিল করলে যাত্রীর কাছে এই নোটিফিকেশন যায়।",
    variables: ["{{booking_number}}", "{{driver_name}}", "{{reason}}"],
    defaultText: `⚠️ দুঃখিত! চালক আপনার রাইড বাতিল করেছেন{{reason}}। বুকিং #{{booking_number}} বাতিল হয়েছে। অনুগ্রহ করে পুনরায় বুক করুন।`,
  },
  {
    key: "customer_strike_warning",
    nameBengali: "বুকিং বাতিল সংক্রান্ত বিজ্ঞপ্তি (৩ বার বাতিল নীতি)",
    category: "customer_ride",
    description: "যাত্রী স্বেচ্ছায় বুকিং বাতিল করলে অবশিষ্ট সুযোগ ও সতর্কবার্তা।",
    variables: ["{{remaining_attempts}}", "{{strike_count}}", "{{helpline}}"],
    defaultText: `⚠️ বুকিং বাতিল সংক্রান্ত  বিজ্ঞপ্তি:
=======================
আপনার বর্তমান রাইডের অনুরোধটি বাতিল করা হয়েছে।
দয়া করে মনে রাখবেন, চালকদের মূল্যবান সময় ও প্ল্যাটফর্মের সুষ্ঠু পরিষেবা বজায় রাখতে ঘন ঘন বুকিং বাতিল করা গ্রহণযোগ্য নয়।

🛑 বাতিলকরণের অবশিষ্ট সুযোগ: আর মাত্র {{remaining_attempts}} বার (সর্বোচ্চ ৩ বার বাতিল করা যায়)।
এভাবে বারবার বুকিং বাতিল করলে আপনার নম্বরটি প্ল্যাটফর্মে সাময়িকভাবে স্থগিত (Blocked) হতে পারে। তাই আপনার নম্বর সচল রাখতে এবং নিয়মিত সুবিধা পেতে অনুগ্রহ করে নিশ্চিত হয়েই রাইড বুক করুন।

সুন্দরবন রাইডারের সাথে থাকার জন্য ধন্যবাদ!`,
  },


  // -------------------------------------------------------------
  // DRIVER KYC & APPROVAL
  // -------------------------------------------------------------
  {
    key: "driver_registered_pending",
    nameBengali: "চালক রেজিস্ট্রেশন জমা ও যাচাই পেন্ডিং",
    category: "driver_onboarding",
    description: "চালক রেজিস্ট্রেশন ফর্ম ও ডকুমেন্টস সাবমিট করার পর অবিলম্বে পাঠানো হয়।",
    variables: ["{{driver_name}}", "{{helpline}}"],
    defaultText: `🎉 ধন্যবাদ {{driver_name}}!
আপনার সুন্দরবন রাইডার্স চালক রেজিস্ট্রেশন সফলভাবে জমা হয়েছে।

📋 আমাদের অ্যাডমিন টিম আপনার আধার ও টোটোর নথিপত্র যাচাই করছে। অনুমোদন সম্পন্ন হলে আপনাকে ইউনিক আইডি ও টোটো নম্বর সহ হোয়াটসঅ্যাপে নিশ্চিত করা হবে।

জরুরি প্রয়োজনে যোগাযোগ করুন: {{helpline}}`,
  },
  {
    key: "driver_approved",
    nameBengali: "চালক অনুমোদন অভিনন্দন ও ইউনিক আইডি",
    category: "driver_onboarding",
    description: "অ্যাডমিন প্যানেল থেকে চালক অনুমোদন করলে এই অফিশিয়াল স্বাগত বার্তা যাবে।",
    variables: ["{{driver_name}}", "{{unique_id}}", "{{toto_number}}"],
    defaultText: `🎉 অভিনন্দন {{driver_name}}! 🎉
আপনার সুন্দরবন রাইডার্স চালক অ্যাকাউন্ট সফলভাবে অনুমোদিত হয়েছে!

🆔 চালক আইডি: {{unique_id}}
🛺 টোটো নম্বর: {{toto_number}}
🌟 স্ট্যাটাস: সক্রিয় (Active)

এখন থেকে আপনি অ্যাপ ও হোয়াটসঅ্যাপের মাধ্যমে লাইভ রাইড বুকিং গ্রহণ করতে পারবেন। সুন্দরবন রাইডার্স পরিবারের সাথে নিরাপদ ও সফল যাত্রার শুভেচ্ছা! 🛺✨`,
  },
  {
    key: "driver_rejected",
    nameBengali: "চালক নথি প্রত্যাখ্যান নোটিশ",
    category: "driver_onboarding",
    description: "ডকুমেন্টে সমস্যা থাকলে চালককে কারণ জানিয়ে পুনরায় জমা দেওয়ার অনুরোধ বার্তা।",
    variables: ["{{driver_name}}", "{{reason}}", "{{helpline}}"],
    defaultText: `⚠️ দুঃখিত {{driver_name}}!
আপনার সুন্দরবন রাইডার্স চালক আবেদনটি অনুমোদিত হয়নি।

কারণ: {{reason}}

অনুগ্রহ করে সঠিক নথিপত্র সহ পুনরায় আবেদন করুন অথবা আমাদের হেল্পলাইনে ({{helpline}}) যোগাযোগ করুন।`,
  },
];

/**
 * Replaces {{variables}} with actual runtime values
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  let result = template;
  const normalizedVars = { ...vars };
  if (normalizedVars.booking_id && !normalizedVars.booking_number) {
    normalizedVars.booking_number = normalizedVars.booking_id;
  } else if (normalizedVars.booking_number && !normalizedVars.booking_id) {
    normalizedVars.booking_id = normalizedVars.booking_number;
  }
  if (normalizedVars.start_otp && !normalizedVars.OTP) {
    normalizedVars.OTP = normalizedVars.start_otp;
  } else if (normalizedVars.OTP && !normalizedVars.start_otp) {
    normalizedVars.start_otp = normalizedVars.OTP;
  }
  if (normalizedVars.driver_name && !normalizedVars["Driver Name"]) {
    normalizedVars["Driver Name"] = normalizedVars.driver_name;
  }
  if (normalizedVars.driver_phone && !normalizedVars["Driver Phone"]) {
    normalizedVars["Driver Phone"] = normalizedVars.driver_phone;
  }
  if (normalizedVars.toto_number && !normalizedVars["Toto Number"]) {
    normalizedVars["Toto Number"] = normalizedVars.toto_number;
  }
  if (normalizedVars.pickup_location && !normalizedVars["Pickup Location"]) {
    normalizedVars["Pickup Location"] = normalizedVars.pickup_location;
  }
  if (normalizedVars.drop_location && !normalizedVars["Drop Location"]) {
    normalizedVars["Drop Location"] = normalizedVars.drop_location;
  }
  if (normalizedVars.final_fare && !normalizedVars["Total Fare"]) {
    normalizedVars["Total Fare"] = normalizedVars.final_fare;
  }
  if (normalizedVars.remaining_attempts !== undefined && !normalizedVars["Remaining Attempts"]) {
    normalizedVars["Remaining Attempts"] = normalizedVars.remaining_attempts;
  }

  for (const [key, val] of Object.entries(normalizedVars)) {
    const rawVal = val === undefined || val === null ? "" : String(val);
    result = result.replaceAll(`{{${key}}}`, rawVal);
  }
  return result;
}

const templateCache = new Map<string, { text: string; timestamp: number }>();
const TEMPLATE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function invalidateTemplateCache() {
  templateCache.clear();
}

/**
 * Loads a template dynamically from database system_settings, or falls back to hardcoded default
 */
export async function getCustomWhatsAppMessage(
  admin: SupabaseClient,
  templateKey: string,
  vars: Record<string, string | number | undefined | null> = {}
): Promise<string> {
  const def = ALL_WHATSAPP_TEMPLATES.find((t) => t.key === templateKey);
  let templateText = def?.defaultText || "";

  const cached = templateCache.get(templateKey);
  if (cached && Date.now() - cached.timestamp < TEMPLATE_CACHE_TTL) {
    templateText = cached.text;
  } else {
    try {
      const settingKey = `wa_tpl_${templateKey}`;
      const { data } = await admin
        .from("system_settings")
        .select("value")
        .eq("key", settingKey)
        .maybeSingle();

      if (data?.value && data.value.trim().length > 0) {
        templateText = data.value;
      }
      templateCache.set(templateKey, { text: templateText, timestamp: Date.now() });
    } catch (err) {
      console.warn(`[templates] Failed to load custom template ${templateKey}:`, err);
    }
  }

  // Also resolve {{helpline}} and {{sos_number}} default if not provided
  if (!vars.helpline) {
    vars.helpline = "8348122122";
  }
  if (!vars.sos_number) {
    vars.sos_number = "8348122122 / 112";
  }

  // Ensure toto_number is present in passenger_ride_assigned
  if (templateKey === "passenger_ride_assigned") {
    if (!templateText.includes("{{toto_number}}") && !templateText.includes("টোটো নম্বর")) {
      if (templateText.includes("{{driver_id}}")) {
        templateText = templateText.replace(
          /(🆔 চালক আইডি:.*?\n)/,
          `$1🛺 টোটো নম্বর: {{toto_number}}\n`
        );
      } else if (templateText.includes("{{driver_phone}}")) {
        templateText = templateText.replace(
          /(📞.*?{{driver_phone}}.*?\n)/,
          `$1🛺 টোটো নম্বর: {{toto_number}}\n`
        );
      }
    }
  }

  // Ensure SOS numbers are present in passenger_trip_started
  if (templateKey === "passenger_trip_started") {
    if (!templateText.includes("8348122122") && !templateText.includes("112")) {
      templateText = templateText.replace(
        /(=======================[\s\S]*?=======================)/,
        `$1\n📞 হেল্পলাইন / SOS: 8348122122 / 112`
      );
    }
  }

  return interpolateTemplate(templateText, vars);
}

