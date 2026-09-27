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
    defaultText: `🙏🏻 নমস্কার {{name}} 🙏🏻
            "সুন্দরবন রাইডার"  
আপনার যাত্রাকে আরও দ্রুত, সহজ ও সুরক্ষিত করতে মাত্র ৫ মিনিটে অনলাইন স্মার্ট টোটো বুকিং ।
🎯 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে..............
               🙏🏻 সুন্দরবন রাইডার 🙏🏻

Licence No :- 1554
Reg. No :- WB-18-0208526
Email :- sr.rider122@gmail.com
Help No :- {{helpline}} (WhatsApp)`,
  },
  {
    key: "customer_disclaimer",
    nameBengali: "যাত্রী ডিসক্লেইমার ও শর্তাবলী",
    category: "general",
    description: "যাত্রী বুকিং শুরু করার পূর্বে প্রাথমিক নিরাপত্তা ও আইনি নির্দেশিকা।",
    variables: ["{{name}}"],
    defaultText: `📜 *ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী*
"সুন্দরবন রাইডার" একটি নিবন্ধিত IT & ITES প্ল্যাটফর্ম। রেজিস্ট্রেশন, লাইসেন্স ও GST নিয়মাফিক সুরক্ষিত। রাইড বুক করার পূর্বে শর্তাবলি পড়ে নিন:

• যাতায়াতে ক্ষতি/দুর্ঘটনায় ‘সুন্দরবন রাইডার’ দায়ী থাকবে না।
• চালক ও যাত্রী সম্পূর্ণ নিজ দায়িত্বে ও ঝুঁকিতে ভ্রমণ করবেন।
• নির্ধারিত রেট চার্ট অনুযায়ী ভাড়া প্রযোজ্য হবে।

(সম্পূর্ণ আইনি শর্তাবলী ও রেট চার্ট দেখতে 'বিস্তারিত দেখুন' চাপুন)`,
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
      "{{distance_text}}",
    ],
    defaultText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺
=======================
🆔 বুকিং নং: #{{booking_number}}
👤 যাত্রী: {{customer_name}}
👥 যাত্রী সংখ্যা: {{passenger_count}} জন
📞 ফোন: {{customer_phone}}
📍 পিকআপ: {{pickup_location}}{{distance_text}}
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
    nameBengali: "যাত্রী বুকিং তৈরি নিশ্চিতকরণ",
    category: "customer_ride",
    description: "যাত্রী রাইড রিকোয়েস্ট পাঠালে সাথে সাথে এই প্রতিক্রিয়াটি পায়।",
    variables: ["{{booking_number}}", "{{pickup_location}}", "{{drop_location}}"],
    defaultText: `✨ আপনার বুকিং তৈরি হয়েছে! ✨
=======================
🆔 বুকিং নং: *#{{booking_number}}*
📍 পিকআপ: {{pickup_location}}
🏁 গন্তব্য: {{drop_location}}
=======================
🔍 আপনার কাছাকাছি টোটো চালকদের কাছে অনুরোধ পাঠানো হয়েছে... চালক গ্রহণ করলে আপনাকে সাথে সাথে জানানো হবে।`,
  },
  {
    key: "passenger_ride_assigned",
    nameBengali: "চালক রাইড গ্রহণ করলে যাত্রীকে ওটিপি সহ নোটিফিকেশন",
    category: "customer_ride",
    description: "চালক রাইড গ্রহণ করলে যাত্রীর কাছে চালকের বিস্তারিত ও যাত্রা শুরুর ৪ ডিজিটের OTP যায়।",
    variables: [
      "{{booking_number}}",
      "{{driver_name}}",
      "{{driver_phone}}",
      "{{driver_id}}",
      "{{start_otp}}",
    ],
    defaultText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨
=======================
🛺 চালক: {{driver_name}}
📞 ফোন: {{driver_phone}}
🆔 চালক আইডি: {{driver_id}}
=======================
🔐 রাইড শুরুর ওটিপি: *{{start_otp}}*
(চালক পিকআপে পৌঁছালে যাত্রা শুরু করতে এই ওটিপিটি চালককে দিন)
=======================
চালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন।`,
  },
  {
    key: "passenger_trip_started",
    nameBengali: "যাত্রা শুরু নোটিফিকেশন (OTP ভেরিফাইড)",
    category: "customer_ride",
    description: "চালক যাত্রীর কাছ থেকে OTP নিয়ে যাত্রা শুরু করলে যাত্রীকে পাঠানো নোটিফিকেশন।",
    variables: ["{{booking_number}}", "{{driver_name}}"],
    defaultText: `🛺 আপনার সুন্দরবন রাইডার্স যাত্রা শুরু হয়েছে!
=======================
🆔 বুকিং নং: #{{booking_number}}
🛺 চালক: {{driver_name}}
=======================
নিরাপদে ভ্রমণ করুন। যেকোনো জরুরি প্রয়োজনে অ্যাপে SOS হেল্পলাইন ব্যবহার করুন।`,
  },
  {
    key: "passenger_trip_completed",
    nameBengali: "ডিজিটাল রসিদ ও ট্রিপ সমাপ্তি",
    category: "customer_ride",
    description: "গন্তব্যে পৌঁছালে দূরত্ব ও চূড়ান্ত সংগৃহীত ভাড়া সহ রসিদ।",
    variables: ["{{booking_number}}", "{{distance_km}}", "{{final_fare}}"],
    defaultText: `🙏 আপনার যাত্রা সফলভাবে সম্পন্ন হয়েছে! "সুন্দরবন রাইডার"-এ ভ্রমণের জন্য অসংখ্য ধন্যবাদ। "সুন্দরবন রাইডার" আপনার সুস্বাস্থ্য ও নিরাপদ যাত্রা কামনা করে ।🙏
=======================
📍 মোট অতিক্রান্ত দূরত্ব: {{distance_km}} কিমি
💵 সংগৃহীত চূড়ান্ত ভাড়া: ₹{{final_fare}}.00
=======================
🛺 আমাদের পরিষেবাকে আরও উন্নত করতে; আপনার অভিজ্ঞতা, অভিযোগ বা মূল্যবান পরামর্শ জানাতে নিচের বোতামে ক্লিক করুন :`,
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
    nameBengali: "যাত্রী বাতিল সতর্কবার্তা (৩ বার বাতিল নীতি)",
    category: "customer_ride",
    description: "যাত্রী বুকিং বাতিল করলে স্ট্রাইক সংখ্যা এবং অ্যাকাউন্ট স্থগিতের সতর্কতা বার্তা।",
    variables: ["{{strike_count}}", "{{helpline}}"],
    defaultText: `⚠️ সতর্কবার্তা: আপনি এই নিয়ে {{strike_count}} বার বুকিং বাতিল করলেন। ৩ বার বাতিল করলে আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হবে। যেকোনো তথ্যের জন্য হেল্পলাইনে ({{helpline}}) যোগাযোগ করুন।`,
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
  for (const [key, val] of Object.entries(vars)) {
    const rawVal = val === undefined || val === null ? "" : String(val);
    result = result.replaceAll(`{{${key}}}`, rawVal);
  }
  return result;
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
  } catch (err) {
    console.warn(`[templates] Failed to load custom template ${templateKey}:`, err);
  }

  // Also resolve {{helpline}} default if not provided
  if (!vars.helpline) {
    vars.helpline = "8348122122";
  }

  return interpolateTemplate(templateText, vars);
}
