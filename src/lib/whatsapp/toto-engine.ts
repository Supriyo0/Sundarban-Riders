import { createClient } from "@supabase/supabase-js";
import { saveFeedbackRecord } from "./feedback-store";

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
  step: "awaiting_location" | "awaiting_drop" | "awaiting_complaint" | "awaiting_feedback";
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  timestamp: number;
}

const customerBookingStates = new Map<string, CustomerBookingState>();

export interface DriverLocationState {
  step: "awaiting_driver_location" | "active";
  lat?: number;
  lng?: number;
  locationName?: string;
  locationType?: "live" | "manual";
  expiresAt?: number;
  updatedAt: number;
}

export const driverLocationStates = new Map<string, DriverLocationState>();

// Known Hubs & Landmarks around Namkhana, Kakdwip, Diamond Harbour, Lakshmikantapur
export const SUNDARBAN_LANDMARKS = [
  // Kakdwip Hubs
  {
    name: "কাকদ্বীপ স্টেশন রোড",
    aliases: ["কাকদ্বীপ", "kakdwip", "kakdwip station", "কাকদ্বীপ স্টেশন", "কাকদ্বীপ বাজার"],
    lat: 21.8760,
    lng: 88.1920,
  },
  {
    name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)",
    aliases: ["লট ৮", "লট 8", "হারউড পয়েন্ট", "lot 8", "harwood point", "lot 8 ghat", "কাকদ্বীপ ঘাট"],
    lat: 21.8680,
    lng: 88.1630,
  },
  {
    name: "কাকদ্বীপ হাসপাতাল মোড়",
    aliases: ["কাকদ্বীপ হাসপাতাল", "হাসপাতাল মোড়", "kakdwip hospital"],
    lat: 21.8745,
    lng: 88.1880,
  },
  {
    name: "গণেশপুর মোড়",
    aliases: ["গণেশপুর", "ganeshpur", "ganeshpur more"],
    lat: 21.8540,
    lng: 88.1980,
  },

  // Namkhana Hubs
  {
    name: "নামখানা বাসস্ট্যান্ড ও স্টেশন",
    aliases: ["নামখানা", "namkhana", "নামখানা বাসস্ট্যান্ড", "নামখানা স্টেশন"],
    lat: 21.7674,
    lng: 88.2325,
  },
  {
    name: "হাতানিয়া দোয়ানিয়া ব্রিজ মোড়",
    aliases: ["হাতানিয়া ব্রিজ", "দোয়ানিয়া ব্রিজ", "নামখানা ব্রিজ", "hatania bridge"],
    lat: 21.7640,
    lng: 88.2350,
  },
  {
    name: "নারায়ণপুর মোড়",
    aliases: ["নারায়ণপুর", "নারায়নপুর", "narayanpur", "নারায়নপুর মোড়"],
    lat: 21.7450,
    lng: 88.2380,
  },
  {
    name: "বকখালি বাসস্ট্যান্ড",
    aliases: ["বকখালি", "bakkhali", "বকখালি সৈকত", "বকখালি মোড়"],
    lat: 21.5645,
    lng: 88.2570,
  },
  {
    name: "ফ্রেজারগঞ্জ হারবার",
    aliases: ["ফ্রেজারগঞ্জ", "fraserganj", "ফ্রেজারগঞ্জ মোড়"],
    lat: 21.5850,
    lng: 88.2510,
  },

  // Diamond Harbour Hubs
  {
    name: "ডায়মন্ড হারবার স্টেশন ও বাসস্ট্যান্ড",
    aliases: ["ডায়মন্ড হারবার", "diamond harbour", "diamond", "ডায়মন্ড", "ডায়মন্ড হারবার স্টেশন"],
    lat: 22.1912,
    lng: 88.1903,
  },
  {
    name: "ডায়মন্ড হারবার জেটিঘাট (কেল্লা ঘাট)",
    aliases: ["কেল্লা ঘাট", "ডায়মন্ড জেটি", "diamond jetty", "diamond harbour ghat"],
    lat: 22.1935,
    lng: 88.1820,
  },
  {
    name: "ডায়মন্ড হারবার এসডিও মোড়",
    aliases: ["এসডিও মোড়", "sdo more", "diamond hospital"],
    lat: 22.1980,
    lng: 88.1950,
  },
  {
    name: "সরিষা আশ্রম মোড়",
    aliases: ["সরিষা", "sarisha", "সরিষা মোড়", "রামকৃষ্ণ মিশন সরিষা"],
    lat: 22.2530,
    lng: 88.2040,
  },

  // Lakshmikantapur Hubs
  {
    name: "লক্ষ্মীকান্তপুর স্টেশন বাজার",
    aliases: ["লক্ষ্মীকান্তপুর", "lakshmikantapur", "লক্ষ্মীকান্তপুর স্টেশন", "laxmikantapur"],
    lat: 22.1220,
    lng: 88.3180,
  },
  {
    name: "লক্ষ্মীকান্তপুর চৌমাথা মোড়",
    aliases: ["লক্ষ্মীকান্তপুর চৌমাথা", "চৌমাথা মোড়", "choumatha"],
    lat: 22.1250,
    lng: 88.3195,
  },
  {
    name: "মথুরাপুর রোড স্টেশন বাজার",
    aliases: ["মথুরাপুর", "mathurapur", "মথুরাপুর রোড", "mathurapur road"],
    lat: 22.1700,
    lng: 88.3300,
  },
  {
    name: "মন্দিরবাজার মোড়",
    aliases: ["মন্দিরবাজার", "mandirbazar", "মন্দির বাজার"],
    lat: 22.1480,
    lng: 88.3350,
  },
  {
    name: "কুলপী থানা ও বাজার মোড়",
    aliases: ["কুলপী", "kulpi", "কুলপি", "কুলপী বাজার"],
    lat: 22.0830,
    lng: 88.2430,
  },
  {
    name: "নিশ্চিন্দাপুর স্টেশন বাজার",
    aliases: ["নিশ্চিন্দাপুর", "nischindapur", "নিশ্চিন্তপুর"],
    lat: 21.9830,
    lng: 88.2120,
  },
  {
    name: "রায়দিঘি বাজার ও জেটিঘাট",
    aliases: ["রায়দিঘি", "raidighi", "রায়দিঘি"],
    lat: 22.0010,
    lng: 88.4350,
  },
];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function getNearestLandmark(lat: number, lng: number): string {
  let closest = SUNDARBAN_LANDMARKS[0];
  let minD = 999999;
  for (const lm of SUNDARBAN_LANDMARKS) {
    const d = calculateDistanceKm(lat, lng, lm.lat, lm.lng);
    if (d < minD) {
      minD = d;
      closest = lm;
    }
  }
  if (minD < 1.5) {
    return closest.name;
  }
  return `অবস্থান (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export async function geocodeLocation(query: string): Promise<{ lat: number; lng: number; name: string }> {
  const cleanQ = query.toLowerCase().trim();
  // 1. Check known Sundarban landmarks
  for (const lm of SUNDARBAN_LANDMARKS) {
    if (cleanQ.includes(lm.name.toLowerCase()) || lm.aliases.some((a) => cleanQ.includes(a.toLowerCase()))) {
      return { lat: lm.lat, lng: lm.lng, name: lm.name };
    }
  }

  // 2. Query Google Maps Geocoding API if configured (with regional bounding box bias)
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query + ", South 24 Parganas, West Bengal, India"
      )}&bounds=21.5,88.10|22.3,88.50&key=${googleKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const loc = data.results[0].geometry.location;
        const name = data.results[0].formatted_address || query;
        return { lat: loc.lat, lng: loc.lng, name: name.split(",")[0] || query };
      }
    } catch {}
  }

  // 3. Fallback: OpenStreetMap Nominatim with Regional Viewbox
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query + ", South 24 Parganas, West Bengal"
    )}&viewbox=88.1,22.3,88.5,21.5&bounded=0&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SundarbanRiders/1.0 (dispatch@sundarbanriders.com)" },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        name: data[0].display_name?.split(",")[0] || query,
      };
    }
  } catch {}

  // 4. Default to center of Kakdwip Station Road if completely unknown
  return { lat: 21.8760, lng: 88.1920, name: query };
}

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

export const DEFAULT_TOTO_DRIVER_DISCLAIMER = `🛺 *সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী* 🛺
==============================
নমস্কার! সুন্দরবন রাইডার প্ল্যাটফর্মে পরিষেবা শুরু করার পূর্বে চালক চুক্তি ও শর্তাবলি পড়ে সম্মতি দিন:

১. আপনি একজন স্বাধীন সেবা প্রদানকারী (Independent Service Provider)।
২. যেকোনো দুর্ঘটনার দায় সম্পূর্ণ চালকের, সুন্দরবন রাইডার্স কোনোভাবেই দায়ী থাকবে না।
৩. যাত্রী নিরাপত্তা ও ট্রাফিক নিয়ম মানা বাধ্যতামূলক।
৪. যাত্রীদের সাথে মার্জিত ও বিনম্র আচরণ বজায় রাখতে হবে।
৫. প্ল্যাটফর্ম টেকনোলজি ফি প্রযোজ্য হতে পারে।
৬. নিয়মানুবর্তিতা ও আইনি সুরক্ষায় সুন্দরবন রাইডার্স পূর্ণ অধিকার সংরক্ষণ করে।

> আপনি কি উপরোক্ত সকল শর্তাবলীতে সম্মত আছেন?`;

export const DEFAULT_TOTO_WELCOME_MESSAGE = `🙏 নমস্কার! "সুন্দরবন রাইডার"-এ আপনাকে স্বাগতম।
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
  is_active?: boolean;
  is_available?: boolean;
  agreed_terms?: boolean;
  agreed_at?: string;
  toto_number?: string;
  vehicle_number?: string;
  latitude?: number;
  longitude?: number;
  current_location_name?: string;
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
        .or(`phone.eq.${rawPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${last10},phone.ilike.%${last10}`)
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
        .or(`phone.eq.${rawPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${last10},phone.ilike.%${last10}`)
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

  // Check if sender is a registered and approved driver
  const isRegisteredDriver = Boolean(
    driver &&
    driver.is_approved !== false &&
    driver.is_blocked !== true &&
    driver.status !== "blocked"
  );

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

    // Assign to this driver atomically (protecting against race conditions)
    const { data: assignedBooking } = await supabase
      .from("bookings")
      .update({
        status: "assigned",
        driver_id: driver?.id,
      })
      .eq("id", booking.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (!assignedBooking) {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
        buttons: [{ id: "driver_go_offline", title: "🔴 অফলাইন যান" }],
      };
    }

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

    const extraNotifications: NonNullable<OutboundWhatsAppAction["extraNotifications"]> = [
      {
        toPhone: booking.customer_phone,
        type: "interactive_buttons",
        bodyText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨\n=======================\n🛺 চালক: ${driver?.name || "সুন্দরবন চালক"}\n📞 ফোন: ${driver?.phone || rawPhone}\n🚘 টোটো নম্বর: ${driver?.toto_number || driver?.vehicle_number || "WB-96-T-XXXX"}\n=======================\nচালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন।`,
        buttons: [
          { id: "cancel_ride", title: "❌ বুকিং বাতিল" },
        ],
      },
    ];

    // Inform other online drivers on WhatsApp that this booking was taken
    try {
      const { data: otherDrivers } = await supabase
        .from("drivers")
        .select("phone")
        .neq("phone", rawPhone);

      if (otherDrivers && otherDrivers.length > 0) {
        for (const od of otherDrivers) {
          if (od.phone) {
            extraNotifications.push({
              toPhone: od.phone,
              type: "text",
              bodyText: `ℹ️ বুকিং আপডেট: #${booking.booking_number} রাইডটি চালক ${driver?.name || "অন্য একজন চালক"} গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
            });
          }
        }
      }
    } catch {}

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
        bodyText: `🙏 আপনার যাত্রা সফলভাবে সম্পন্ন হয়েছে! "সুন্দরবন রাইডার"-এ ভ্রমণের জন্য অসংখ্য ধন্যবাদ। "সুন্দরবন রাইডার" আপনার সুস্বাস্থ্য ও নিরাপদ যাত্রা কামনা করে ।🙏\n\n🛺 আমাদের পরিষেবাকে আরও উন্নত করতে; আপনার অভিজ্ঞতা, অভিযোগ বা মূল্যবান পরামর্শ জানাতে —\nক্লিক করুন :`,
        buttons: [
          { id: "customer_complaint", title: "↩️ অভিযোগ জানান" },
          { id: "customer_feedback", title: "↩️ মতামত বা পরামর্শ" },
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
  // FLOW B.1: DRIVER AGREE TO TERMS (Strictly ONE TIME Acceptance)
  // -------------------------------------------------------------
  if (
    isRegisteredDriver &&
    driver &&
    (payload === "driver_agree_terms" ||
      payload === "agree_disclaimer" ||
      (!driver.agreed_terms && (incomingText.includes("সম্মত") || incomingText === "হ্যাঁ")))
  ) {
    // Clear any accidental customer booking state
    customerBookingStates.delete(cleanPhone);

    // Save one-time agreement in database
    await supabase
      .from("drivers")
      .update({
        agreed_terms: true,
        agreed_at: new Date().toISOString(),
      })
      .eq("id", driver.id);

    driver.agreed_terms = true;

    // Immediately prompt for driver location (Live or Typed)
    driverLocationStates.set(cleanPhone, {
      step: "awaiting_driver_location",
      updatedAt: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `🟢 ধন্যবাদ ${driver.name || "চালক বন্ধু"}! আপনার চালক চুক্তি সফলভাবে সম্পন্ন হয়েছে।\n\n📍 এবার আপনার বর্তমান অবস্থান (Driver Location) প্রদান করুন:\n=======================\nকাছাকাছি ৫ কিমির মধ্যে থাকা যাত্রীদের বুকিং পেতে আপনার অবস্থান প্রয়োজন।\n\n👉 নিচের যে কোনো একটি উপায়ে আপনার অবস্থান শেয়ার করুন:\n১) WhatsApp-এর Attach (📎) আইকন থেকে 'Location' -> 'Share Live Location' বা Current Location পাঠান।\n২) অথবা আপনার বর্তমান বাসস্ট্যান্ড/বাজারের নাম লিখে জানান (যেমন: "কাকদ্বীপ স্টেশন", "নামখানা বাসস্ট্যান্ড", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর", "লট ৮ ঘাট")।`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B.1.1: DRIVER LOCATION RECEIVER (Live Location or Typed Text)
  // -------------------------------------------------------------
  const driverLocState = driverLocationStates.get(cleanPhone);
  if (
    isRegisteredDriver &&
    driver &&
    (driverLocState?.step === "awaiting_driver_location" || ctx.location) &&
    payload !== "cancel_ride" &&
    payload !== "driver_go_offline" &&
    payload !== "book_toto" &&
    !payload.startsWith("driver_accept_") &&
    !payload.startsWith("driver_decline_") &&
    !payload.startsWith("driver_start_") &&
    !payload.startsWith("driver_complete_")
  ) {
    let lat: number | undefined;
    let lng: number | undefined;
    let locName: string | undefined;
    let locType: "live" | "manual" = "manual";

    if (ctx.location?.latitude && ctx.location?.longitude) {
      lat = ctx.location.latitude;
      lng = ctx.location.longitude;
      locType = "live";
      locName = ctx.location.name || ctx.location.address || getNearestLandmark(lat, lng);
    } else if (incomingText && incomingText !== "লগইন" && incomingText !== "রাইডার লগইন") {
      const typedQuery = ctx.textBody?.trim() || incomingText;
      const geocoded = await geocodeLocation(typedQuery);
      lat = geocoded.lat;
      lng = geocoded.lng;
      locName = geocoded.name;
      locType = "manual";
    }

    if (lat !== undefined && lng !== undefined && locName) {
      const durationMs = locType === "live" ? 15 * 60 * 1000 : 30 * 60 * 1000;
      const expiresAt = Date.now() + durationMs;

      driverLocationStates.set(cleanPhone, {
        step: "active",
        lat,
        lng,
        locationName: locName,
        locationType: locType,
        expiresAt,
        updatedAt: Date.now(),
      });

      const metaObj = {
        name: locName,
        lat,
        lng,
        type: locType,
        expiresAt: new Date(expiresAt).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await supabase
          .from("drivers")
          .update({
            latitude: lat,
            longitude: lng,
            current_location_name: JSON.stringify(metaObj),
            is_active: true,
            is_available: true,
          })
          .eq("id", driver.id);
      } catch {
        await supabase
          .from("drivers")
          .update({
            current_location_name: JSON.stringify(metaObj),
            is_active: true,
            is_available: true,
          })
          .eq("id", driver.id);
      }

      void Promise.resolve(
        supabase.from("toto_riders").update({
          last_known_lat: lat,
          last_known_lng: lng,
          last_location_updated_at: new Date().toISOString(),
          duty_status: "online_available",
        }).eq("phone_number", cleanPhone)
      ).catch(() => {});

      const typeLabel = locType === "live" ? "লাইভ লোকেশন" : "ম্যাপ লোকেশন";
      const validityText = locType === "live" ? "১৫ মিনিট (WhatsApp লাইভ)" : "৩০ মিনিট";

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🟢 আপনার ${typeLabel} সফলভাবে যুক্ত হয়েছে!\n=======================\n📍 বর্তমান অবস্থান: ${locName}\n🗺️ ম্যাপ কোঅর্ডিনেট: (${lat.toFixed(4)}, ${lng.toFixed(4)})\n⏱️ লোকেশন মেয়াদ: ${validityText}\n🛺 ডিউটি স্ট্যাটাস: অনলাইন ও প্রস্তুত\n=======================\nকাছাকাছি ৫ কিমির মধ্যে কোনো যাত্রী বুকিং করলে আপনি সঙ্গে সঙ্গে নোটিফিকেশন পাবেন।`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // FLOW B.2: DRIVER DUTY ON (Rider Login)
  // -------------------------------------------------------------
  if (
    payload === "take_ride" ||
    payload === "rider_login" ||
    payload === "driver_join" ||
    incomingText.includes("রাইডার লগইন") ||
    incomingText.includes("লগইন") ||
    incomingText.includes("রাইড নিন") ||
    incomingText.includes("take ride")
  ) {
    if (isRegisteredDriver && driver) {
      // If driver has NOT agreed to terms yet (first time), show driver disclaimer with accept button
      if (!driver.agreed_terms) {
        const driverTerms =
          settings.driver_terms_bengali ||
          DEFAULT_TOTO_DRIVER_DISCLAIMER;

        return {
          toPhone: rawPhone,
          type: "interactive_buttons",
          bodyText: driverTerms,
          buttons: [
            { id: "driver_agree_terms", title: "✅ চালক শর্তে সম্মত" },
          ],
        };
      }

      // Check if location is expired or missing
      const driverLoc = driverLocationStates.get(cleanPhone);
      const isLocationExpired = !driverLoc || (driverLoc.expiresAt && Date.now() > driverLoc.expiresAt);

      if (isLocationExpired) {
        driverLocationStates.set(cleanPhone, {
          step: "awaiting_driver_location",
          updatedAt: Date.now(),
        });

        return {
          toPhone: rawPhone,
          type: "text",
          bodyText: `🛺 ডিউটি শুরুর পূর্বে অবস্থান প্রদান করুন:\n=======================\nকাছাকাছি ৫ কিমির মধ্যকার যাত্রীদের বুকিং পেতে আপনার বর্তমান অবস্থান প্রয়োজন।\n\n👉 যে কোনো একটি উপায়ে লোকেশন পাঠান:\n১) WhatsApp-এর Attach (📎) থেকে 'Location' -> 'Share Live Location' বা Current Location পাঠান।\n২) অথবা বর্তমান এলাকার নাম লিখে জানান (যেমন: "কাকদ্বীপ স্টেশন", "নামখানা", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর")।`,
        };
      }

      // Driver has valid location -> turn online and show offline toggle & booking button
      void Promise.resolve(
        supabase
          .from("drivers")
          .update({ is_active: true, is_available: true })
          .eq("id", driver.id)
      ).catch(() => {});

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🟢 আপনি এখন অনলাইন আছেন!\n📍 অবস্থান: ${driverLoc.locationName || "সুন্দরবন"}\nশীঘ্রই আপনার কাছে নতুন রাইডের নোটিফিকেশন পৌঁছে যাবে।\n\n(ডিউটি বন্ধ করতে বা নিজে টোটো বুক করতে নিচের বোতামে চাপুন)`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    } else {
      // User is NOT registered as a rider -> inform them and allow booking
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ দুঃখিত! আপনার নম্বরটি চালক হিসেবে নিবন্ধিত নয়। সুন্দরবন রাইডার চালক হিসেবে যুক্ত হতে হেল্পলাইনে (${helpline}) যোগাযোগ করুন।\n\nআপনি চাইলে এখনই টোটো বুক করতে পারেন:`,
        buttons: [
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // FLOW B.3: DRIVER GO OFFLINE
  // -------------------------------------------------------------
  if (
    payload === "driver_go_offline" ||
    incomingText.includes("অফলাইন") ||
    incomingText.includes("offline")
  ) {
    if (driver) {
      await supabase
        .from("drivers")
        .update({ is_active: false, is_available: false })
        .eq("id", driver.id);
    }

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `⚪ আপনি এখন অফলাইনে আছেন।\nপুনরায় ডিউটি শুরু করতে বা টোটো বুকিং করতে নিচের বোতামে চাপুন:`,
      buttons: [
        { id: "take_ride", title: "🛺 রাইডার লগইন" },
        { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW B.4: CHECK IF LIVE LOCATION TIME HAS EXPIRED
  // -------------------------------------------------------------
  const existingDriverLoc = driverLocationStates.get(cleanPhone);
  const isLocExpired =
    existingDriverLoc &&
    existingDriverLoc.expiresAt &&
    Date.now() > existingDriverLoc.expiresAt;

  if (
    isRegisteredDriver &&
    driver &&
    driver.agreed_terms &&
    isLocExpired &&
    payload !== "book_toto" &&
    payload !== "driver_go_offline" &&
    !payload.startsWith("driver_accept_") &&
    !payload.startsWith("driver_decline_") &&
    !payload.startsWith("driver_start_") &&
    !payload.startsWith("driver_complete_")
  ) {
    driverLocationStates.set(cleanPhone, {
      step: "awaiting_driver_location",
      updatedAt: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `⚠️ আপনার লাইভ লোকেশনের সময় শেষ হয়েছে!\n=======================\nকাছাকাছি ৫ কিমির মধ্যকার নতুন যাত্রীদের বুকিং চালু রাখতে অনুগ্রহ করে পুনরায় আপনার লাইভ লোকেশন অথবা বর্তমান এলাকার নাম পাঠান।\n\n👉 WhatsApp-এর Attach (📎) থেকে 'Location' শেয়ার করুন অথবা এলাকার নাম লিখে জানান (যেমন: "কাকদ্বীপ", "নামখানা", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর")।`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B.5: FIRST-TIME REGISTERED DRIVER DISCLAIMER (Strictly ONE TIME)
  // If registered driver sends any message and has NOT agreed to terms yet
  // -------------------------------------------------------------
  if (isRegisteredDriver && driver && !driver.agreed_terms && payload !== "book_toto") {
    const driverTerms =
      settings.driver_terms_bengali ||
      DEFAULT_TOTO_DRIVER_DISCLAIMER;

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: driverTerms,
      buttons: [
        { id: "driver_agree_terms", title: "✅ চালক শর্তে সম্মত" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW C: CUSTOMER CANCELLATION HANDLER (Immediate Driver Alert)
  // -------------------------------------------------------------
  if (payload === "cancel_ride" || incomingText === "cancel" || incomingText === "বাতিল") {
    customerBookingStates.delete(cleanPhone);

    // 1. Fetch latest active booking (pending, assigned, confirmed)
    const { data: activeBooking } = await supabase
      .from("bookings")
      .select("*, drivers(*)")
      .eq("customer_phone", cleanPhone)
      .in("status", ["pending", "assigned", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const extraNotifications: Array<{
      toPhone: string;
      type: "text" | "interactive_buttons";
      bodyText: string;
      buttons?: Array<{ id: string; title: string }>;
    }> = [];

    if (activeBooking) {
      // Mark booking cancelled
      await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_by: "customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeBooking.id);

      // If a driver was assigned, immediately free the driver and notify them via WhatsApp!
      if (activeBooking.driver_id) {
        await supabase
          .from("drivers")
          .update({ is_available: true, is_active: true })
          .eq("id", activeBooking.driver_id);

        let driverPhone = activeBooking.drivers?.phone;
        if (!driverPhone) {
          const { data: dRow } = await supabase
            .from("drivers")
            .select("phone")
            .eq("id", activeBooking.driver_id)
            .maybeSingle();
          driverPhone = dRow?.phone;
        }

        if (driverPhone) {
          extraNotifications.push({
            toPhone: driverPhone,
            type: "interactive_buttons" as const,
            bodyText: `⚠️ রাইড বাতিল নোটিফিকেশন ⚠️\n=======================\n🆔 বুকিং নং: #${activeBooking.booking_number || activeBooking.id.slice(0, 8)}\n👤 যাত্রী: ${activeBooking.customer_name || "গ্রাহক"}\n📍 পিকআপ: ${activeBooking.pickup_location || "পিকআপ পয়েন্ট"}\n=======================\n❌ যাত্রী এই রাইডটি বাতিল করেছেন।\n🟢 আপনার ডিউটি স্ট্যাটাস পুনরায় অনলাইন করা হয়েছে এবং আপনি নতুন বুকিং গ্রহণের জন্য প্রস্তুত আছেন।`,
            buttons: [
              { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
            ],
          });
        }
      }
    }

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

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `⚠️ আপনার বুকিংটি সফলভাবে বাতিল করা হয়েছে।\n=======================\n❌ ৩ বারের বেশি বুকিং বাতিল করলে আপনার নম্বরটি সাময়িকভাবে স্থগিত হতে পারে।\n(আপনার বর্তমান বাতিল সংখ্যা: ${newCancels}/৩)\n=======================\n🤝 সুন্দরবন রাইডারের সাথে থাকার জন্য ধন্যবাদ।`,
      buttons: [
        { id: "book_toto", title: "🛺 নতুন টোটো বুকিং" },
      ],
      extraNotifications,
    };
  }

  // -------------------------------------------------------------
  // FLOW D: CUSTOMER DISCLAIMER ACCEPTED -> ASK FOR PICKUP LOCATION
  // -------------------------------------------------------------
  if (
    !isRegisteredDriver &&
    (payload === "agree_disclaimer" ||
      (incomingText.includes("সম্মত আছি") && !incomingText.includes("চালক")) ||
      incomingText === "হ্যাঁ")
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
      bodyText: `📍 আপনার বর্তমান অবস্থান (Current Pickup Location) প্রয়োজন:\n\nদয়া করে নিচের মতো করে আপনার পিকআপ লোকেশন শেয়ার করুন:\n👉 WhatsApp-এর Attach (📎) আইকনে ক্লিক করে 'Location' সিলেক্ট করুন এবং আপনার Current Location সেন্ড করুন।\n\n(অথবা আপনার পিকআপ জায়গার নাম লিখে পাঠান, যেমন: "কাকদ্বীপ স্টেশন", "নামখানা বাসস্ট্যান্ড", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর")`,
    };
  }

  // -------------------------------------------------------------
  // FLOW E: LOCATION & DESTINATION INPUT FROM CUSTOMER & FEEDBACK
  // -------------------------------------------------------------
  const bookingState = customerBookingStates.get(cleanPhone);
  if (bookingState && !payload) {
    if (bookingState.step === "awaiting_complaint" && incomingText) {
      customerBookingStates.delete(cleanPhone);
      const complaintText = ctx.textBody?.trim() || incomingText;
      const ticketNo = `CMP-${Math.floor(1000 + Math.random() * 9000)}`;

      await saveFeedbackRecord({
        type: "complaint",
        ticket: `#${ticketNo}`,
        customer_phone: cleanPhone,
        customer_name: ctx.senderName || customer?.name || "গ্রাহক",
        message: complaintText,
        status: "pending",
      });

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `✅ আপনার অভিযোগটি সফলভাবে নথিভুক্ত করা হয়েছে!\n=======================\n🆔 টিকেট নং: #${ticketNo}\n📞 কন্টাক্ট: ${cleanPhone}\n=======================\nআমাদের অ্যাডমিন টিম দ্রুত বিষয়টি পর্যালোচনা করে ব্যবস্থা নেবে। সুন্দরবন রাইডারের সাথে থাকার জন্য ধন্যবাদ! 🙏`,
        buttons: [
          { id: "book_toto", title: "🛺 নতুন টোটো বুকিং" },
        ],
      };
    } else if (bookingState.step === "awaiting_feedback" && incomingText) {
      customerBookingStates.delete(cleanPhone);
      const feedbackText = ctx.textBody?.trim() || incomingText;
      const ticketNo = `SUG-${Math.floor(1000 + Math.random() * 9000)}`;

      await saveFeedbackRecord({
        type: "suggestion",
        ticket: `#${ticketNo}`,
        customer_phone: cleanPhone,
        customer_name: ctx.senderName || customer?.name || "গ্রাহক",
        message: feedbackText,
        status: "reviewed",
      });

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🌷 অসংখ্য ধন্যবাদ! 🌷\n=======================\nআপনার মূল্যবান পরামর্শ ও মতামতের জন্য আমরা আন্তরিকভাবে কৃতজ্ঞ। সুন্দরবন রাইডারকে আরও উন্নত করতে আপনার পরামর্শটি গুরুত্বের সাথে বিবেচনা করা হবে। 🙏✨`,
        buttons: [
          { id: "book_toto", title: "🛺 নতুন টোটো বুকিং" },
        ],
      };
    } else if (bookingState.step === "awaiting_location") {
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
          bodyText: `📍 পিকআপ লোকেশন গ্রহণ করা হয়েছে:\n"${pickup}"\n\n🏁 এবার অনুগ্রহ করে আপনার গন্তব্যের নাম (Drop Location) লিখে পাঠান (যেমন: "লট ৮ ফেরিঘাট", "কাকদ্বীপ", "নামখানা", "ডায়মন্ড হারবার"):`,
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

      // Geocode pickup if coordinates were not provided by GPS
      let pLat = bookingState.pickupLat;
      let pLng = bookingState.pickupLng;
      if (!pLat || !pLng) {
        const pGeo = await geocodeLocation(pickupLocation);
        pLat = pGeo.lat;
        pLng = pGeo.lng;
      }

      // Query online drivers and filter nearby within 5 km radar
      const { data: onlineDrivers } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .eq("is_available", true);

      // Filter drivers within 5km radius of pickup location
      const nearbyDrivers = (onlineDrivers || []).filter((d) => {
        if (!pLat || !pLng) return true;
        let dLat = d.latitude;
        let dLng = d.longitude;
        if (!dLat || !dLng) {
          try {
            const meta = JSON.parse(d.current_location_name || "{}");
            dLat = meta.lat;
            dLng = meta.lng;
          } catch {}
        }
        if (!dLat || !dLng) return true; // Include if unknown coordinates
        const distKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
        return distKm <= 5.0; // 5 km radar!
      });

      const extraNotifications = nearbyDrivers.map((d) => {
        let distText = "";
        if (pLat && pLng) {
          let dLat = d.latitude;
          let dLng = d.longitude;
          if (!dLat || !dLng) {
            try {
              const meta = JSON.parse(d.current_location_name || "{}");
              dLat = meta.lat;
              dLng = meta.lng;
            } catch {}
          }
          if (dLat && dLng) {
            const dKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
            distText = ` [${dKm} কিমি দূরে]`;
          }
        }

        return {
          toPhone: d.phone,
          type: "interactive_buttons" as const,
          bodyText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺\n=======================\n🆔 বুকিং নং: #${bookingNumber}\n👤 যাত্রী: ${ctx.senderName || "গ্রাহক"}\n📞 ফোন: ${cleanPhone}\n📍 পিকআপ: ${pickupLocation}${distText}\n🏁 গন্তব্য: ${dropLocation}\n💵 আনুমানিক ভাড়া: ₹50.00\n=======================\nআপনি কি এই রাইডটি গ্রহণ করতে চান?`,
          buttons: [
            { id: `driver_accept_${newBooking?.id || bookingNumber}`, title: "✅ রাইড গ্রহণ" },
            { id: `driver_decline_${newBooking?.id || bookingNumber}`, title: "❌ প্রত্যাখ্যান" },
          ],
        };
      });

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

  // -------------------------------------------------------------
  // FLOW I: CUSTOMER COMPLAINTS & FEEDBACK TRIGGERS
  // -------------------------------------------------------------
  if (
    payload === "customer_complaint" ||
    incomingText.includes("অভিযোগ") ||
    incomingText === "complaint"
  ) {
    customerBookingStates.set(cleanPhone, {
      step: "awaiting_complaint",
      timestamp: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `📢 অভিযোগ নিবন্ধন 📢\n=======================\nঅনুগ্রহ করে আপনার অভিযোগ বা সমস্যার কথা এখানে বিস্তারিত লিখে পাঠান। আমাদের কাস্টমার সাপোর্ট টিম দ্রুত বিষয়টি সমাধান করবে:`,
    };
  }

  if (
    payload === "customer_feedback" ||
    incomingText.includes("পরামর্শ") ||
    incomingText.includes("মতামত") ||
    incomingText === "feedback" ||
    incomingText === "suggestion"
  ) {
    customerBookingStates.set(cleanPhone, {
      step: "awaiting_feedback",
      timestamp: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `💡 মতামত ও পরামর্শ 💡\n=======================\nআমাদের সেবাকে আরও উন্নত করতে আপনার মূল্যবান মতামত বা পরামর্শটি এখানে লিখে জানান:`,
    };
  }

  // -------------------------------------------------------------
  // DEFAULT: MAIN WELCOME MENU (100% Bengali)
  // -------------------------------------------------------------
  if (isRegisteredDriver && driver) {
    // FIRST TIME: Rider has NOT agreed to terms yet -> Show rider disclaimer with accept button
    if (!driver.agreed_terms) {
      const driverTerms =
        settings.driver_terms_bengali ||
        DEFAULT_TOTO_DRIVER_DISCLAIMER;

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: driverTerms,
        buttons: [
          { id: "driver_agree_terms", title: "✅ চালক শর্তে সম্মত" },
        ],
      };
    }

    // FROM NEXT TIME: Rider has already agreed to terms -> Show rider duty status and booking options
    const isOnline = Boolean(driver.is_active && driver.is_available);
    if (isOnline) {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🟢 নমস্কার ${driver.name || "চালক বন্ধু"}!\nআপনি বর্তমানে সুন্দরবন রাইডার-এ অনলাইনে আছেন এবং নতুন বুকিং গ্রহণের জন্য প্রস্তুত।`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    } else {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🙏 নমস্কার ${driver.name || "চালক বন্ধু"}!\nআজকের ডিউটি শুরু করতে বা টোটো বুকিং করতে নিচের অপশন বেছে নিন:`,
        buttons: [
          { id: "take_ride", title: "🛺 রাইডার লগইন" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    }
  }

  // Regular Customer Welcome Menu
  const welcomeText = settings.welcome_message_bengali || DEFAULT_TOTO_WELCOME_MESSAGE;

  return {
    toPhone: rawPhone,
    type: "interactive_buttons",
    bodyText: welcomeText,
    buttons: [
      { id: "take_ride", title: "🛺 রাইডার লগইন" },
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ],
  };
}
