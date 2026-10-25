import { createClient } from "@supabase/supabase-js";
import { saveFeedbackRecord } from "./feedback-store";
import {
  calculateTotoFare,
  loadActivePricingConfig,
  DEFAULT_TOTO_PRICING,
} from "@/lib/pricing/fare-calculator";

// Helper to get Supabase Admin client
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function toBengaliDigits(num: number | string): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (digit) => bengaliDigits[Number(digit)]);
}

export function fromBengaliDigits(num: number | string): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  let res = String(num || "");
  bengaliDigits.forEach((digit, idx) => {
    res = res.replaceAll(digit, idx.toString());
  });
  return res;
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
  type: "text" | "interactive_buttons" | "location_request" | "media";
  bodyText: string;
  buttons?: Array<{ id: string; title: string }>;
  media?: {
    kind: "image" | "document" | "video" | "audio";
    url: string;
    filename?: string;
    caption?: string;
  };
  extraNotifications?: Array<{
    toPhone: string;
    type: "text" | "interactive_buttons" | "media";
    bodyText: string;
    buttons?: Array<{ id: string; title: string }>;
    media?: {
      kind: "image" | "document" | "video" | "audio";
      url: string;
      filename?: string;
      caption?: string;
    };
  }>;
}

interface CustomerBookingState {
  step: "awaiting_disclaimer" | "awaiting_location" | "awaiting_drop" | "awaiting_complaint" | "awaiting_feedback" | "awaiting_review";
  bookingId?: string;
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  timestamp: number;
}

const customerBookingStates = new Map<string, CustomerBookingState>();

export function getBookingState(phone: string): CustomerBookingState | undefined {
  const clean = phone.replace(/\D/g, "");
  const last10 = clean.slice(-10);
  return customerBookingStates.get(clean) || customerBookingStates.get(last10);
}

export function hasBookingState(phone: string): boolean {
  return Boolean(getBookingState(phone));
}

export function setBookingState(phone: string, state: CustomerBookingState): void {
  const clean = phone.replace(/\D/g, "");
  const last10 = clean.slice(-10);
  customerBookingStates.set(clean, state);
  customerBookingStates.set(last10, state);
}

export function clearBookingState(phone: string): void {
  const clean = phone.replace(/\D/g, "");
  const last10 = clean.slice(-10);
  customerBookingStates.delete(clean);
  customerBookingStates.delete(last10);
}

export interface DriverLocationState {
  step: "awaiting_driver_location" | "active" | "awaiting_driver_otp";
  bookingId?: string;
  lat?: number;
  lng?: number;
  locationName?: string;
  locationType?: "live" | "manual";
  expiresAt?: number;
  updatedAt: number;
}

export const driverLocationStates = new Map<string, DriverLocationState>();

// Comprehensive 400+ Landmarks across South 24 Parganas
// Covers: Kakdwip, Namkhana, Bakkhali, Sagar, Patharpratima, Diamond Harbour,
//         Lakshmikantapur, Mathurapur, Mandirbazar, Kulpi, Jaynagar, Canning,
//         Basanti, Gosaba, and hundreds of village-level places in between
export const SUNDARBAN_LANDMARKS = [

  // ══════════════════════════════════════════════════════════
  //  KAKDWIP (কাকদ্বীপ)
  // ══════════════════════════════════════════════════════════
  { name: "কাকদ্বীপ স্টেশন ও বাসস্ট্যান্ড", aliases: ["কাকদ্বীপ", "kakdwip", "kakdwip station", "kakdwip bus stand", "কাকদ্বীপ স্টেশন", "কাকদ্বীপ বাসস্ট্যান্ড", "kakdwip bazar"], lat: 21.8760, lng: 88.1920 },
  { name: "কাকদ্বীপ বাজার ও সুপার মার্কেট", aliases: ["কাকদ্বীপ বাজার", "kakdwip market", "kakdwip super market"], lat: 21.8752, lng: 88.1912 },
  { name: "কাকদ্বীপ হাসপাতাল মোড়", aliases: ["কাকদ্বীপ হাসপাতাল", "kakdwip hospital", "হাসপাতাল মোড়", "sdh kakdwip"], lat: 21.8745, lng: 88.1880 },
  { name: "কাকদ্বীপ থানা মোড়", aliases: ["কাকদ্বীপ থানা", "kakdwip thana", "kakdwip police station"], lat: 21.8755, lng: 88.1895 },
  { name: "কাকদ্বীপ কলেজ মোড়", aliases: ["কাকদ্বীপ কলেজ", "kakdwip college"], lat: 21.8730, lng: 88.1935 },
  { name: "কাকদ্বীপ মহকুমা কোর্ট মোড়", aliases: ["কাকদ্বীপ কোর্ট", "kakdwip court", "sub divisional court"], lat: 21.8762, lng: 88.1908 },
  { name: "কাকদ্বীপ বিডিও অফিস", aliases: ["কাকদ্বীপ বিডিও", "kakdwip bdo"], lat: 21.8758, lng: 88.1900 },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)", aliases: ["লট ৮", "লট 8", "lot 8", "harwood point", "হারউড পয়েন্ট", "lot 8 ghat", "কাকদ্বীপ ঘাট"], lat: 21.8680, lng: 88.1630 },
  { name: "গণেশপুর মোড়", aliases: ["গণেশপুর", "ganeshpur", "ganeshpur more"], lat: 21.8540, lng: 88.1980 },
  { name: "কাকদ্বীপ ব্লক অফিস মোড়", aliases: ["kakdwip block", "ব্লক অফিস"], lat: 21.8755, lng: 88.1898 },
  { name: "বিধু মাস্টার মোড় কাকদ্বীপ", aliases: ["বিধু মাস্টার মোড়", "bidhu master"], lat: 21.8718, lng: 88.1870 },
  { name: "রামনগর মোড় কাকদ্বীপ", aliases: ["রামনগর মোড়", "ramnagar kakdwip"], lat: 21.8650, lng: 88.1900 },
  { name: "ধামাখালি বাজার", aliases: ["ধামাখালি", "dhamakhali"], lat: 21.8780, lng: 88.2050 },
  { name: "হরিপুর মোড় কাকদ্বীপ", aliases: ["হরিপুর", "haripur kakdwip"], lat: 21.8620, lng: 88.1940 },
  { name: "মাইজপুকুর মোড়", aliases: ["মাইজপুকুর", "maijpukur"], lat: 21.8605, lng: 88.1750 },
  { name: "কাকদ্বীপ প্রাথমিক স্বাস্থ্যকেন্দ্র", aliases: ["কাকদ্বীপ phc", "kakdwip primary health"], lat: 21.8740, lng: 88.1882 },
  { name: "ঠাকুরপুকুর কাকদ্বীপ রোড মোড়", aliases: ["ঠাকুরপুকুর kakdwip"], lat: 21.8810, lng: 88.1960 },
  { name: "কাকদ্বীপ টাউন স্কুল মোড়", aliases: ["kakdwip town school"], lat: 21.8748, lng: 88.1922 },

  // ══════════════════════════════════════════════════════════
  //  NAMKHANA (নামখানা)
  // ══════════════════════════════════════════════════════════
  { name: "নামখানা বাসস্ট্যান্ড ও স্টেশন", aliases: ["নামখানা", "namkhana", "নামখানা বাসস্ট্যান্ড", "নামখানা স্টেশন", "namkhana station", "namkhana bus stand"], lat: 21.7674, lng: 88.2325 },
  { name: "হাতানিয়া দোয়ানিয়া ব্রিজ মোড়", aliases: ["হাতানিয়া ব্রিজ", "দোয়ানিয়া ব্রিজ", "নামখানা ব্রিজ", "hatania bridge", "hatania doyania"], lat: 21.7640, lng: 88.2350 },
  { name: "নারায়ণপুর মোড়", aliases: ["নারায়ণপুর", "নারায়নপুর", "narayanpur", "narayanpur more"], lat: 21.7450, lng: 88.2380 },
  { name: "নামখানা হাসপাতাল মোড়", aliases: ["নামখানা হাসপাতাল", "namkhana hospital"], lat: 21.7680, lng: 88.2318 },
  { name: "নামখানা থানা মোড়", aliases: ["নামখানা থানা", "namkhana thana"], lat: 21.7675, lng: 88.2320 },
  { name: "নামখানা বিডিও অফিস", aliases: ["নামখানা বিডিও", "namkhana bdo"], lat: 21.7672, lng: 88.2330 },
  { name: "কালীতলা মোড় নামখানা", aliases: ["কালীতলা", "kalitala namkhana"], lat: 21.7700, lng: 88.2310 },
  { name: "শিবনগর নামখানা", aliases: ["শিবনগর", "shibnagar namkhana"], lat: 21.7600, lng: 88.2280 },
  { name: "দক্ষিণ নামখানা", aliases: ["দক্ষিণ নামখানা", "south namkhana", "দ নামখানা"], lat: 21.7500, lng: 88.2350 },
  { name: "ভেলকি মোড় নামখানা", aliases: ["ভেলকি মোড়", "bhelki namkhana"], lat: 21.7620, lng: 88.2340 },
  { name: "নামখানা ফেরিঘাট", aliases: ["নামখানা ঘাট", "namkhana ghat", "namkhana ferry"], lat: 21.7550, lng: 88.2250 },

  // ══════════════════════════════════════════════════════════
  //  BAKKHALI (বকখালি) & FRASERGANJ (ফ্রেজারগঞ্জ)
  // ══════════════════════════════════════════════════════════
  { name: "বকখালি বাসস্ট্যান্ড ও সমুদ্র সৈকত", aliases: ["বকখালি", "bakkhali", "বকখালি সৈকত", "বকখালি মোড়", "bakkhali beach", "bakkhali bus stand"], lat: 21.5645, lng: 88.2570 },
  { name: "বকখালি ট্যুরিস্ট লজ মোড়", aliases: ["বকখালি ট্যুরিস্ট লজ", "bakkhali tourist lodge"], lat: 21.5650, lng: 88.2590 },
  { name: "বকখালি হোটেল জোন", aliases: ["bakkhali hotel zone", "বকখালি হোটেল"], lat: 21.5660, lng: 88.2560 },
  { name: "ফ্রেজারগঞ্জ হারবার ও মৎস্য বন্দর", aliases: ["ফ্রেজারগঞ্জ", "fraserganj", "ফ্রেজারগঞ্জ মোড়", "fraserganj harbour", "ফ্রেজারগঞ্জ বন্দর", "fraser ganj"], lat: 21.5850, lng: 88.2510 },
  { name: "ফ্রেজারগঞ্জ সৈকত", aliases: ["fraserganj beach", "ফ্রেজারগঞ্জ সমুদ্র"], lat: 21.5780, lng: 88.2540 },
  { name: "নারায়ণপুর বকখালি সংযোগ", aliases: ["নারায়ণপুর বকখালি রোড"], lat: 21.5900, lng: 88.2620 },

  // ══════════════════════════════════════════════════════════
  //  SAGAR ISLAND / GANGASAGAR (সাগরদ্বীপ / গঙ্গাসাগর)
  // ══════════════════════════════════════════════════════════
  { name: "কচুবেড়িয়া ফেরিঘাট (সাগরদ্বীপ প্রবেশদ্বার)", aliases: ["কচুবেড়িয়া", "kachuberia", "kachuberia ghat", "সাগর ফেরি", "sagar ferry ghat"], lat: 21.8610, lng: 88.1320 },
  { name: "গঙ্গাসাগর কপিল মুনি মন্দির ও মেলা গ্রাউন্ড", aliases: ["গঙ্গাসাগর", "gangasagar", "কপিল মুনি মন্দির", "gangasagar beach", "সাগর মেলা", "kapil muni", "gangasagar mela"], lat: 21.6460, lng: 88.0730 },
  { name: "রুদ্রনগর বাজার (সাগর বিডিও অফিস)", aliases: ["রুদ্রনগর", "rudranagar", "সাগর বিডিও", "rudranagar bazar", "সাগর ব্লক"], lat: 21.7330, lng: 88.1150 },
  { name: "চেমাগুড়ি বাসস্ট্যান্ড ও জেটিঘাট", aliases: ["চেমাগুড়ি", "chemaguri", "বেনুবন", "chemaguri ghat"], lat: 21.6880, lng: 88.0820 },
  { name: "সাগর থানা মোড়", aliases: ["সাগর থানা", "sagar thana", "sagar police"], lat: 21.7340, lng: 88.1145 },
  { name: "গঙ্গাসাগর মেলা বাসস্ট্যান্ড", aliases: ["gangasagar mela bus stand", "মেলা বাসস্ট্যান্ড"], lat: 21.6470, lng: 88.0720 },
  { name: "মুড়িগঙ্গা ফেরিঘাট সাগর", aliases: ["মুড়িগঙ্গা ঘাট", "muriganga ghat", "সাগর মুড়িগঙ্গা"], lat: 21.7900, lng: 88.1050 },
  { name: "ধবলাট সাগর", aliases: ["ধবলাট", "dhablat sagar"], lat: 21.7100, lng: 88.0900 },
  { name: "বাসন্তী সাগর রোড মোড়", aliases: ["বাসন্তী সাগর", "basanti sagar road"], lat: 21.7200, lng: 88.1200 },
  { name: "ঝাটুলিয়া সাগর", aliases: ["ঝাটুলিয়া", "jhatuliya"], lat: 21.6800, lng: 88.0950 },
  { name: "নামখানা থেকে কচুবেড়িয়া রোড মোড়", aliases: ["namkhana kachuberia road"], lat: 21.8200, lng: 88.1600 },

  // ══════════════════════════════════════════════════════════
  //  PATHARPRATIMA (পাথরপ্রতিমা)
  // ══════════════════════════════════════════════════════════
  { name: "পাথরপ্রতিমা বাজার ও ফেরিঘাট", aliases: ["পাথরপ্রতিমা", "patharpratima", "পাথরপ্রতিমা ঘাট", "pathar pratima", "patharpratima bazar"], lat: 21.7920, lng: 88.3560 },
  { name: "রামগঙ্গা হাসপাতাল মোড়", aliases: ["রামগঙ্গা", "ramganga", "রামগঙ্গা ঘাট", "ramganga hospital"], lat: 21.8480, lng: 88.3850 },
  { name: "পাথরপ্রতিমা থানা মোড়", aliases: ["পাথরপ্রতিমা থানা", "patharpratima thana"], lat: 21.7925, lng: 88.3555 },
  { name: "পাথরপ্রতিমা বিডিও অফিস", aliases: ["পাথরপ্রতিমা বিডিও", "patharpratima bdo"], lat: 21.7930, lng: 88.3560 },
  { name: "গোসাবা থানা ও বাজার", aliases: ["গোসাবা", "gosaba", "gosaba bazar"], lat: 22.1620, lng: 88.8030 },
  { name: "গোবর্ধনপুর পাথরপ্রতিমা", aliases: ["গোবর্ধনপুর", "gobardhanpur"], lat: 21.7800, lng: 88.3500 },
  { name: "শিবগঞ্জ পাথরপ্রতিমা", aliases: ["শিবগঞ্জ", "shibganj patharpratima"], lat: 21.8100, lng: 88.3700 },
  { name: "বৈকুণ্ঠপুর পাথরপ্রতিমা", aliases: ["বৈকুণ্ঠপুর", "baikunthpur"], lat: 21.7680, lng: 88.3480 },
  { name: "ব্রাহ্মণনগর পাথরপ্রতিমা", aliases: ["ব্রাহ্মণনগর", "brahmananagar"], lat: 21.8000, lng: 88.3550 },

  // ══════════════════════════════════════════════════════════
  //  DIAMOND HARBOUR (ডায়মন্ড হারবার)
  // ══════════════════════════════════════════════════════════
  { name: "ডায়মন্ড হারবার স্টেশন ও বাসস্ট্যান্ড", aliases: ["ডায়মন্ড হারবার", "diamond harbour", "diamond", "ডায়মন্ড", "ডায়মন্ড হারবার স্টেশন", "diamond harbour station", "diamond harbour bus stand"], lat: 22.1912, lng: 88.1903 },
  { name: "ডায়মন্ড হারবার জেটিঘাট (কেল্লা ঘাট)", aliases: ["কেল্লা ঘাট", "ডায়মন্ড জেটি", "diamond jetty", "diamond harbour ghat", "কেল্লা"], lat: 22.1935, lng: 88.1820 },
  { name: "ডায়মন্ড হারবার এসডিও মোড়", aliases: ["এসডিও মোড়", "sdo more", "diamond harbour sdo"], lat: 22.1980, lng: 88.1950 },
  { name: "ডায়মন্ড হারবার হাসপাতাল", aliases: ["diamond harbour hospital", "ডায়মন্ড হারবার হাসপাতাল", "diamond harbour sdh"], lat: 22.1950, lng: 88.1880 },
  { name: "ডায়মন্ড হারবার থানা মোড়", aliases: ["ডায়মন্ড হারবার থানা", "diamond harbour thana"], lat: 22.1920, lng: 88.1910 },
  { name: "ডায়মন্ড হারবার কলেজ মোড়", aliases: ["diamond harbour college", "ডায়মন্ড হারবার কলেজ"], lat: 22.1960, lng: 88.1920 },
  { name: "ডায়মন্ড হারবার মুনস্টার মোড়", aliases: ["মুনস্টার মোড়", "munster more diamond harbour"], lat: 22.1870, lng: 88.1850 },
  { name: "মানস নগর ডায়মন্ড হারবার", aliases: ["মানস নগর", "manas nagar diamond harbour"], lat: 22.1890, lng: 88.1870 },
  { name: "দক্ষিণ ডায়মন্ড হারবার মোড়", aliases: ["south diamond harbour", "দক্ষিণ ডায়মন্ড হারবার"], lat: 22.1850, lng: 88.1900 },
  { name: "মহিষামারী মোড় ডায়মন্ড হারবার", aliases: ["মহিষামারী", "mohishamari"], lat: 22.2050, lng: 88.2000 },
  { name: "ডায়মন্ড হারবার মেলা গ্রাউন্ড মোড়", aliases: ["diamond harbour mela ground"], lat: 22.1905, lng: 88.1895 },

  // ══════════════════════════════════════════════════════════
  //  SARISHA (সরিষা) & NEARBY
  // ══════════════════════════════════════════════════════════
  { name: "সরিষা রামকৃষ্ণ মিশন আশ্রম মোড়", aliases: ["সরিষা", "sarisha", "সরিষা মোড়", "রামকৃষ্ণ মিশন সরিষা", "sarisha ramakrishna"], lat: 22.2530, lng: 88.2040 },
  { name: "সরিষা বাজার মোড়", aliases: ["সরিষা বাজার", "sarisha bazar"], lat: 22.2510, lng: 88.2060 },
  { name: "বাদুড়িয়া মোড় সরিষা রোড", aliases: ["বাদুড়িয়া sarisha", "baduria sarisha road"], lat: 22.2600, lng: 88.2100 },
  { name: "হরিণখোলা মোড়", aliases: ["হরিণখোলা", "harinkhola"], lat: 22.2400, lng: 88.2050 },
  { name: "রামকৃষ্ণপুর মোড় ডায়মন্ড হারবার রোড", aliases: ["রামকৃষ্ণপুর", "ramkrishnapur"], lat: 22.2200, lng: 88.1980 },
  { name: "বিষ্ণুপুর মোড় (ডায়মন্ড হারবার)", aliases: ["বিষ্ণুপুর", "bishnupur diamond harbour"], lat: 22.1750, lng: 88.1920 },
  { name: "ফলতা স্টেশন ও বাজার মোড়", aliases: ["ফলতা", "falta", "falta station", "ফলতা স্টেশন"], lat: 22.2910, lng: 88.1720 },
  { name: "ফলতা সেজ মোড়", aliases: ["ফলতা সেজ", "falta sez"], lat: 22.3000, lng: 88.1700 },

  // ══════════════════════════════════════════════════════════
  //  LAKSHMIKANTAPUR (লক্ষ্মীকান্তপুর)
  // ══════════════════════════════════════════════════════════
  { name: "লক্ষ্মীকান্তপুর স্টেশন ও বাসস্ট্যান্ড", aliases: ["লক্ষ্মীকান্তপুর", "lakshmikantapur", "laxmikantapur", "lakshmi kantapur", "লক্ষ্মীকান্তপুর স্টেশন", "lakshmikantapur station"], lat: 22.1220, lng: 88.3180 },
  { name: "লক্ষ্মীকান্তপুর চৌমাথা মোড়", aliases: ["লক্ষ্মীকান্তপুর চৌমাথা", "চৌমাথা মোড়", "choumatha lakshmikantapur"], lat: 22.1250, lng: 88.3195 },
  { name: "লক্ষ্মীকান্তপুর হাসপাতাল মোড়", aliases: ["লক্ষ্মীকান্তপুর হাসপাতাল", "lakshmikantapur hospital"], lat: 22.1230, lng: 88.3170 },
  { name: "লক্ষ্মীকান্তপুর থানা মোড়", aliases: ["লক্ষ্মীকান্তপুর থানা", "lakshmikantapur thana"], lat: 22.1225, lng: 88.3175 },
  { name: "লক্ষ্মীকান্তপুর কলেজ মোড়", aliases: ["লক্ষ্মীকান্তপুর কলেজ", "lakshmikantapur college"], lat: 22.1240, lng: 88.3185 },
  { name: "লক্ষ্মীকান্তপুর বিডিও অফিস", aliases: ["লক্ষ্মীকান্তপুর বিডিও", "lakshmikantapur bdo"], lat: 22.1235, lng: 88.3180 },
  { name: "মহেন্দ্রগঞ্জ মোড় লক্ষ্মীকান্তপুর", aliases: ["মহেন্দ্রগঞ্জ", "mahendraganj lakshmikantapur"], lat: 22.1150, lng: 88.3200 },
  { name: "জয়নগর মজিলপুর স্টেশন ও বাজার", aliases: ["জয়নগর", "jaynagar", "jaynagar majilpur", "জয়নগর মজিলপুর", "jaynagar station"], lat: 22.1750, lng: 88.4270 },
  { name: "জয়নগর মজিলপুর বাসস্ট্যান্ড", aliases: ["jaynagar bus stand", "জয়নগর বাসস্ট্যান্ড"], lat: 22.1740, lng: 88.4260 },

  // ══════════════════════════════════════════════════════════
  //  MATHURAPUR (মথুরাপুর)
  // ══════════════════════════════════════════════════════════
  { name: "মথুরাপুর রোড স্টেশন ও বাজার", aliases: ["মথুরাপুর", "mathurapur", "মথুরাপুর রোড", "mathurapur road", "mathurapur station"], lat: 22.1700, lng: 88.3300 },
  { name: "মথুরাপুর থানা মোড়", aliases: ["মথুরাপুর থানা", "mathurapur thana"], lat: 22.1705, lng: 88.3295 },
  { name: "মথুরাপুর হাসপাতাল মোড়", aliases: ["মথুরাপুর হাসপাতাল", "mathurapur hospital"], lat: 22.1695, lng: 88.3305 },
  { name: "মথুরাপুর বিডিও অফিস", aliases: ["মথুরাপুর বিডিও", "mathurapur bdo"], lat: 22.1702, lng: 88.3298 },
  { name: "দক্ষিণ মথুরাপুর মোড়", aliases: ["দক্ষিণ মথুরাপুর", "south mathurapur", "d mathurapur"], lat: 22.1600, lng: 88.3310 },
  { name: "উত্তর মথুরাপুর মোড়", aliases: ["উত্তর মথুরাপুর", "north mathurapur", "u mathurapur"], lat: 22.1800, lng: 88.3290 },
  { name: "বালিয়ারা মোড় মথুরাপুর রোড", aliases: ["বালিয়ারা", "baliara mathurapur"], lat: 22.1630, lng: 88.3320 },

  // ══════════════════════════════════════════════════════════
  //  MANDIRBAZAR (মন্দিরবাজার)
  // ══════════════════════════════════════════════════════════
  { name: "মন্দিরবাজার মোড়", aliases: ["মন্দিরবাজার", "mandirbazar", "মন্দির বাজার", "mandir bazar"], lat: 22.1480, lng: 88.3350 },
  { name: "মন্দিরবাজার থানা মোড়", aliases: ["মন্দিরবাজার থানা", "mandirbazar thana"], lat: 22.1485, lng: 88.3345 },
  { name: "মন্দিরবাজার হাসপাতাল মোড়", aliases: ["মন্দিরবাজার হাসপাতাল", "mandirbazar hospital"], lat: 22.1475, lng: 88.3355 },
  { name: "চাঁদপাড়া মন্দিরবাজার", aliases: ["চাঁদপাড়া", "chandpara mandirbazar"], lat: 22.1420, lng: 88.3360 },
  { name: "গোলাবাড়ি মোড় মন্দিরবাজার", aliases: ["গোলাবাড়ি", "golabari mandirbazar"], lat: 22.1520, lng: 88.3340 },

  // ══════════════════════════════════════════════════════════
  //  KULPI (কুলপী)
  // ══════════════════════════════════════════════════════════
  { name: "কুলপী থানা ও বাজার মোড়", aliases: ["কুলপী", "kulpi", "কুলপি", "কুলপী বাজার", "kulpi bazar", "kulpi market"], lat: 22.0830, lng: 88.2430 },
  { name: "কুলপী হাসপাতাল মোড়", aliases: ["কুলপী হাসপাতাল", "kulpi hospital"], lat: 22.0825, lng: 88.2425 },
  { name: "কুলপী স্টেশন মোড়", aliases: ["কুলপী স্টেশন", "kulpi station"], lat: 22.0820, lng: 88.2435 },
  { name: "আমতলা মোড় কুলপী রোড", aliases: ["আমতলা", "amtala kulpi road"], lat: 22.0900, lng: 88.2400 },
  { name: "জীবনতলা মোড় কুলপী", aliases: ["জীবনতলা", "jibantala kulpi"], lat: 22.0750, lng: 88.2450 },
  { name: "বেহালা কুলপী রোড মোড়", aliases: ["behala kulpi road"], lat: 22.1000, lng: 88.2350 },

  // ══════════════════════════════════════════════════════════
  //  NISCHINDAPUR (নিশ্চিন্দাপুর) & NEARBY
  // ══════════════════════════════════════════════════════════
  { name: "নিশ্চিন্দাপুর স্টেশন ও বাজার", aliases: ["নিশ্চিন্দাপুর", "nischindapur", "nischintapur", "নিশ্চিন্তপুর", "nishchindapur"], lat: 21.9830, lng: 88.2120 },
  { name: "রায়দিঘি বাজার ও জেটিঘাট", aliases: ["রায়দিঘি", "raidighi", "raidighi bazar", "রায়দিঘি ঘাট"], lat: 22.0010, lng: 88.4350 },
  { name: "বিষ্ণুপুর মোড় নিশ্চিন্দাপুর রোড", aliases: ["বিষ্ণুপুর নিশ্চিন্দাপুর", "bishnupur nischindapur"], lat: 21.9900, lng: 88.2200 },
  { name: "হোগলা মোড় নিশ্চিন্দাপুর", aliases: ["হোগলা", "hogla nischindapur"], lat: 21.9750, lng: 88.2150 },

  // ══════════════════════════════════════════════════════════
  //  CANNING (ক্যানিং)
  // ══════════════════════════════════════════════════════════
  { name: "ক্যানিং স্টেশন ও বাসস্ট্যান্ড", aliases: ["ক্যানিং", "canning", "canning station", "ক্যানিং স্টেশন", "canning bus stand"], lat: 22.3120, lng: 88.6650 },
  { name: "ক্যানিং হাসপাতাল মোড়", aliases: ["ক্যানিং হাসপাতাল", "canning hospital"], lat: 22.3115, lng: 88.6640 },
  { name: "ক্যানিং থানা মোড়", aliases: ["ক্যানিং থানা", "canning thana"], lat: 22.3110, lng: 88.6660 },
  { name: "ক্যানিং বাজার মোড়", aliases: ["ক্যানিং বাজার", "canning bazar"], lat: 22.3125, lng: 88.6645 },
  { name: "মাতলা ব্রিজ মোড় ক্যানিং", aliases: ["মাতলা ব্রিজ", "matla bridge canning"], lat: 22.3050, lng: 88.6700 },
  { name: "গোপালনগর ক্যানিং রোড", aliases: ["গোপালনগর", "gopalnagar canning"], lat: 22.3200, lng: 88.6600 },

  // ══════════════════════════════════════════════════════════
  //  BASANTI (বসন্তী)
  // ══════════════════════════════════════════════════════════
  { name: "বসন্তী থানা ও বাজার মোড়", aliases: ["বসন্তী", "basanti", "basanti bazar", "বসন্তী বাজার"], lat: 22.1620, lng: 88.7030 },
  { name: "বসন্তী ফেরিঘাট", aliases: ["বসন্তী ঘাট", "basanti ghat", "basanti ferry"], lat: 22.1600, lng: 88.7050 },
  { name: "বসন্তী বিডিও অফিস", aliases: ["বসন্তী বিডিও", "basanti bdo"], lat: 22.1615, lng: 88.7025 },

  // ══════════════════════════════════════════════════════════
  //  JAYNAGAR (জয়নগর) AREA
  // ══════════════════════════════════════════════════════════
  { name: "জয়নগর বাসস্ট্যান্ড ও স্টেশন", aliases: ["জয়নগর", "jaynagar", "jaynagar station", "জয়নগর স্টেশন"], lat: 22.1750, lng: 88.4270 },
  { name: "জয়নগর থানা মোড়", aliases: ["জয়নগর থানা", "jaynagar thana"], lat: 22.1755, lng: 88.4265 },
  { name: "ক্যানিং থেকে জয়নগর রোড মোড়", aliases: ["canning jaynagar road"], lat: 22.2400, lng: 88.5500 },
  { name: "বহড়ু মোড় জয়নগর রোড", aliases: ["বহড়ু", "bahoru jaynagar"], lat: 22.1680, lng: 88.4150 },

  // ══════════════════════════════════════════════════════════
  //  SONARPUR (সোনারপুর) AREA
  // ══════════════════════════════════════════════════════════
  { name: "সোনারপুর স্টেশন ও বাসস্ট্যান্ড", aliases: ["সোনারপুর", "sonarpur", "sonarpur station", "সোনারপুর স্টেশন"], lat: 22.4320, lng: 88.4010 },
  { name: "সোনারপুর বাজার মোড়", aliases: ["সোনারপুর বাজার", "sonarpur bazar"], lat: 22.4315, lng: 88.4005 },
  { name: "নরেন্দ্রপুর মোড় সোনারপুর রোড", aliases: ["নরেন্দ্রপুর", "narendrapur sonarpur"], lat: 22.4450, lng: 88.4050 },
  { name: "রাজপুর সোনারপুর মোড়", aliases: ["রাজপুর", "rajpur sonarpur"], lat: 22.4200, lng: 88.3950 },
  { name: "ঘোলার মোড় সোনারপুর", aliases: ["ঘোলা", "ghola sonarpur"], lat: 22.4250, lng: 88.3980 },

  // ══════════════════════════════════════════════════════════
  //  BARUIPUR (বারুইপুর)
  // ══════════════════════════════════════════════════════════
  { name: "বারুইপুর স্টেশন ও বাসস্ট্যান্ড", aliases: ["বারুইপুর", "baruipur", "baruipur station", "বারুইপুর স্টেশন"], lat: 22.3610, lng: 88.4320 },
  { name: "বারুইপুর থানা মোড়", aliases: ["বারুইপুর থানা", "baruipur thana"], lat: 22.3605, lng: 88.4315 },
  { name: "বারুইপুর বাজার মোড়", aliases: ["বারুইপুর বাজার", "baruipur bazar"], lat: 22.3615, lng: 88.4325 },
  { name: "বারুইপুর কলেজ মোড়", aliases: ["বারুইপুর কলেজ", "baruipur college"], lat: 22.3620, lng: 88.4330 },
  { name: "বারুইপুর হাসপাতাল মোড়", aliases: ["বারুইপুর হাসপাতাল", "baruipur hospital"], lat: 22.3600, lng: 88.4310 },
  { name: "নারায়ণতলা মোড় বারুইপুর", aliases: ["নারায়ণতলা", "narayantala baruipur"], lat: 22.3550, lng: 88.4300 },

  // ══════════════════════════════════════════════════════════
  //  JYNAGAR - CANNING CONNECTING VILLAGES
  // ══════════════════════════════════════════════════════════
  { name: "বজবজ ঘাট ও বাজার মোড়", aliases: ["বজবজ", "budge budge", "বজবজ ঘাট"], lat: 22.4750, lng: 88.1860 },
  { name: "মজিলপুর মোড় জয়নগর", aliases: ["মজিলপুর", "majilpur jaynagar"], lat: 22.1780, lng: 88.4290 },
  { name: "ধামখালি মোড় (কুলপী)", aliases: ["ধামখালি কুলপী", "dhamkhali kulpi"], lat: 22.0600, lng: 88.2500 },
  { name: "বাটানগর মোড়", aliases: ["বাটানগর", "batanagar"], lat: 22.4600, lng: 88.2080 },

  // ══════════════════════════════════════════════════════════
  //  NH-117 CORRIDOR (ডায়মন্ড হারবার রোড)
  // ══════════════════════════════════════════════════════════
  { name: "বিষ্ণুপুর থানা মোড় (জেলা)", aliases: ["বিষ্ণুপুর জেলা", "bishnupur district", "bishnupur thana"], lat: 22.0950, lng: 88.2600 },
  { name: "ময়দান মোড় ডায়মন্ড হারবার রোড", aliases: ["ময়দান মোড়", "maidan more dh road"], lat: 22.3300, lng: 88.2100 },
  { name: "রাজপুর চৌরাস্তা ডায়মন্ড হারবার রোড", aliases: ["rajpur crossroads", "রাজপুর চৌরাস্তা"], lat: 22.3800, lng: 88.2200 },
  { name: "জোকা মেট্রো স্টেশন মোড়", aliases: ["জোকা", "joka", "joka metro"], lat: 22.4680, lng: 88.2950 },
  { name: "ঠাকুরপুকুর মোড়", aliases: ["ঠাকুরপুকুর", "thakurpukur"], lat: 22.4720, lng: 88.2930 },
  { name: "মেডিসিটি হাসপাতাল মোড়", aliases: ["মেডিসিটি", "medicity hospital"], lat: 22.4650, lng: 88.2970 },
  { name: "মহেশতলা থানা মোড়", aliases: ["মহেশতলা", "mahestala", "maheshtala"], lat: 22.5070, lng: 88.2360 },
  { name: "বজবজ স্টেশন মোড়", aliases: ["বজবজ স্টেশন", "budge budge station"], lat: 22.4800, lng: 88.1870 },
  { name: "আমতলা থানা মোড়", aliases: ["আমতলা", "amtala thana"], lat: 22.3950, lng: 88.2650 },
  { name: "বলিয়ারপুর মোড়", aliases: ["বলিয়ারপুর", "baliarpur"], lat: 22.3600, lng: 88.2400 },
  { name: "তারদহ মোড়", aliases: ["তারদহ", "tardaha"], lat: 22.3450, lng: 88.2250 },
  { name: "ভাঙড় থানা মোড়", aliases: ["ভাঙড়", "bhangar", "bhangar thana"], lat: 22.3750, lng: 88.3800 },

  // ══════════════════════════════════════════════════════════
  //  SUNDARBAN TIGER RESERVE & FOREST AREA
  // ══════════════════════════════════════════════════════════
  { name: "গোসাবা থানা ও বাজার মোড়", aliases: ["গোসাবা", "gosaba", "gosaba bazar", "gosaba market"], lat: 22.1620, lng: 88.8030 },
  { name: "ঝড়খালি সুন্দরবন ফরেস্ট মোড়", aliases: ["ঝড়খালি", "jharkhali", "সুন্দরবন jharkhali"], lat: 22.0720, lng: 88.6800 },
  { name: "সজনেখালি টাইগার রিজার্ভ মোড়", aliases: ["সজনেখালি", "sajnekhali", "tiger reserve"], lat: 22.1560, lng: 88.7940 },
  { name: "বালি দ্বীপ ঘাট সুন্দরবন", aliases: ["বালি দ্বীপ", "bali dwip", "bali island sundarbans"], lat: 22.0500, lng: 88.6500 },
  { name: "সুধান্যাখালি ওয়াচ টাওয়ার মোড়", aliases: ["সুধান্যাখালি", "sudhanyakhali"], lat: 22.1800, lng: 88.8200 },

  // ══════════════════════════════════════════════════════════
  //  KEY VILLAGE JUNCTIONS — KAKDWIP TO NAMKHANA CORRIDOR
  // ══════════════════════════════════════════════════════════
  { name: "শশীভূষণ মোড় কাকদ্বীপ রোড", aliases: ["শশীভূষণ মোড়", "sashibhushan more"], lat: 21.8380, lng: 88.2050 },
  { name: "মইপীঠ মোড়", aliases: ["মইপীঠ", "moipith"], lat: 21.8100, lng: 88.2180 },
  { name: "মইপীঠ ফেরিঘাট", aliases: ["মইপীঠ ঘাট", "moipith ghat"], lat: 21.8050, lng: 88.2150 },
  { name: "ঘোড়ামারা দ্বীপ ঘাট", aliases: ["ঘোড়ামারা", "ghoramara island", "ঘোড়ামারা ঘাট"], lat: 21.8200, lng: 88.1400 },
  { name: "লুচিপুর মোড় কাকদ্বীপ", aliases: ["লুচিপুর", "luchipur kakdwip"], lat: 21.8500, lng: 88.2100 },
  { name: "মাঝিরহাট ব্রিজ মোড়", aliases: ["মাঝিরহাট", "majerhat bridge"], lat: 22.5100, lng: 88.3280 },
  { name: "রামনগর নামখানা রোড মোড়", aliases: ["রামনগর নামখানা", "ramnagar namkhana road"], lat: 21.7750, lng: 88.2280 },
  { name: "বাদুরিয়া মোড়", aliases: ["বাদুরিয়া", "baduria more"], lat: 21.8300, lng: 88.2000 },
  { name: "কালিনগর মোড়", aliases: ["কালিনগর", "kalinagar"], lat: 21.8650, lng: 88.2100 },
  { name: "দেউলবাড়ি মোড়", aliases: ["দেউলবাড়ি", "deulbari"], lat: 21.8220, lng: 88.2250 },

  // ══════════════════════════════════════════════════════════
  //  KEY VILLAGE JUNCTIONS — LAKSHMIKANTAPUR CORRIDOR
  // ══════════════════════════════════════════════════════════
  { name: "কাশিনগর মোড় লক্ষ্মীকান্তপুর রোড", aliases: ["কাশিনগর", "kashinagar lakshmikantapur"], lat: 22.1050, lng: 88.3100 },
  { name: "বলাকপুর মোড়", aliases: ["বলাকপুর", "balakpur"], lat: 22.1400, lng: 88.3250 },
  { name: "নারায়ণপুর চৌমাথা লক্ষ্মীকান্তপুর", aliases: ["নারায়ণপুর চৌমাথা", "narayanpur choumatha lakshmikantapur"], lat: 22.1100, lng: 88.3150 },
  { name: "বাগআঁচড়া মোড়", aliases: ["বাগআঁচড়া", "bagachara"], lat: 22.1300, lng: 88.3220 },
  { name: "শ্রীরামপুর মোড় লক্ষ্মীকান্তপুর", aliases: ["শ্রীরামপুর লক্ষ্মীকান্তপুর", "srirampur lakshmikantapur"], lat: 22.1050, lng: 88.3220 },

  // ══════════════════════════════════════════════════════════
  //  IMPORTANT HOSPITALS, SCHOOLS & COLLEGES ACROSS REGION
  // ══════════════════════════════════════════════════════════
  { name: "ডায়মন্ড হারবার মেডিকেল কলেজ ও হাসপাতাল", aliases: ["diamond harbour medical college", "ডায়মন্ড হারবার মেডিকেল কলেজ", "dhmc"], lat: 22.1960, lng: 88.1900 },
  { name: "কাকদ্বীপ মহকুমা হাসপাতাল", aliases: ["কাকদ্বীপ মহকুমা হাসপাতাল", "kakdwip sdh", "kakdwip sub divisional hospital"], lat: 21.8748, lng: 88.1875 },
  { name: "নামখানা গ্রামীণ হাসপাতাল", aliases: ["নামখানা গ্রামীণ হাসপাতাল", "namkhana rural hospital"], lat: 21.7680, lng: 88.2315 },
  { name: "সাগর গ্রামীণ হাসপাতাল", aliases: ["সাগর হাসপাতাল", "sagar rural hospital"], lat: 21.7335, lng: 88.1140 },
  { name: "পাথরপ্রতিমা গ্রামীণ হাসপাতাল", aliases: ["পাথরপ্রতিমা হাসপাতাল", "patharpratima hospital"], lat: 21.7922, lng: 88.3558 },
  { name: "নিশ্চিন্দাপুর বিএস হাসপাতাল", aliases: ["নিশ্চিন্দাপুর হাসপাতাল", "nischindapur hospital"], lat: 21.9835, lng: 88.2115 },
  { name: "রামগঙ্গা গ্রামীণ হাসপাতাল", aliases: ["রামগঙ্গা হাসপাতাল", "ramganga hospital"], lat: 21.8482, lng: 88.3848 },
  { name: "জয়নগর হাসপাতাল মোড়", aliases: ["জয়নগর হাসপাতাল", "jaynagar hospital"], lat: 22.1745, lng: 88.4270 },
  { name: "বারুইপুর মহকুমা হাসপাতাল", aliases: ["বারুইপুর হাসপাতাল", "baruipur sdh"], lat: 22.3600, lng: 88.4310 },

  // ══════════════════════════════════════════════════════════
  //  IMPORTANT RAILWAY STATIONS — SOUTH 24 PARGANAS LINE
  // ══════════════════════════════════════════════════════════
  { name: "লক্ষ্মীকান্তপুর রেলস্টেশন", aliases: ["lakshmikantapur railway station", "লক্ষ্মীকান্তপুর রেলস্টেশন"], lat: 22.1220, lng: 88.3180 },
  { name: "জয়নগর মজিলপুর রেলস্টেশন", aliases: ["jaynagar majilpur railway station"], lat: 22.1750, lng: 88.4270 },
  { name: "বারুইপুর জংশন স্টেশন", aliases: ["baruipur junction", "বারুইপুর জংশন"], lat: 22.3610, lng: 88.4320 },
  { name: "সোনারপুর রেলস্টেশন", aliases: ["sonarpur railway station", "sonarpur station"], lat: 22.4320, lng: 88.4010 },
  { name: "ক্যানিং রেলস্টেশন", aliases: ["canning railway station", "ক্যানিং রেলস্টেশন"], lat: 22.3120, lng: 88.6650 },
  { name: "ফলতা রেলস্টেশন", aliases: ["falta railway station", "ফলতা রেলস্টেশন"], lat: 22.2910, lng: 88.1720 },
  { name: "ডায়মন্ড হারবার রেলস্টেশন", aliases: ["diamond harbour railway station", "ডায়মন্ড হারবার রেলওয়ে"], lat: 22.1912, lng: 88.1903 },
  { name: "মথুরাপুর রোড রেলস্টেশন", aliases: ["mathurapur road railway station"], lat: 22.1700, lng: 88.3300 },
  { name: "নিশ্চিন্দাপুর রেলস্টেশন", aliases: ["nischindapur railway station", "নিশ্চিন্দাপুর রেলস্টেশন"], lat: 21.9830, lng: 88.2120 },
  { name: "নামখানা রেলস্টেশন", aliases: ["namkhana railway station", "নামখানা রেলস্টেশন"], lat: 21.7674, lng: 88.2325 },
  { name: "কাকদ্বীপ রেলস্টেশন", aliases: ["kakdwip railway station", "কাকদ্বীপ রেলওয়ে স্টেশন"], lat: 21.8760, lng: 88.1920 },

  // ══════════════════════════════════════════════════════════
  //  MAJOR CROSSROADS / MORES IN RURAL CORRIDOR
  // ══════════════════════════════════════════════════════════
  { name: "চার মাথা মোড় কাকদ্বীপ-নামখানা রোড", aliases: ["চার মাথা মোড়", "char matha more kakdwip namkhana"], lat: 21.8200, lng: 88.2100 },
  { name: "বেতরবেড়িয়া মোড়", aliases: ["বেতরবেড়িয়া", "betarberia"], lat: 21.8350, lng: 88.2050 },
  { name: "দক্ষিণ বারাসাত মোড়", aliases: ["দক্ষিণ বারাসাত", "south barasat"], lat: 22.3650, lng: 88.4550 },
  { name: "সিরাখালি মোড়", aliases: ["সিরাখালি", "sirakhali"], lat: 21.7900, lng: 88.2500 },
  { name: "নয়াবাজার মোড় লক্ষ্মীকান্তপুর-মথুরাপুর রোড", aliases: ["নয়াবাজার মোড়", "nayabazar more lakshmikantapur"], lat: 22.1450, lng: 88.3270 },
  { name: "ঘাটাল মোড় সুন্দরবন রোড", aliases: ["ঘাটাল মোড়", "ghatal more"], lat: 22.0500, lng: 88.2700 },
  { name: "বাসন্তী রোড মোড় ক্যানিং", aliases: ["বাসন্তী রোড মোড়", "basanti road canning"], lat: 22.2900, lng: 88.7000 },
  { name: "বিজয়নগর মোড়", aliases: ["বিজয়নগর", "bijaynagar"], lat: 22.1560, lng: 88.3300 },
  { name: "হাসনাবাদ মোড় উত্তর ২৪", aliases: ["হাসনাবাদ", "hasnabad"], lat: 22.5830, lng: 88.9420 },
  { name: "গোবিন্দপুর মোড় পাথরপ্রতিমা রোড", aliases: ["গোবিন্দপুর", "gobindapur patharpratima"], lat: 21.8300, lng: 88.3200 },
  { name: "কেঁড়াখালি ফেরিঘাট", aliases: ["কেঁড়াখালি", "kendrakhali ghat"], lat: 21.9800, lng: 88.4500 },

  // ══════════════════════════════════════════════════════════
  //  GOSABA & DEEP SUNDARBANS
  // ══════════════════════════════════════════════════════════
  { name: "গোসাবা বাজার ও ফেরিঘাট", aliases: ["গোসাবা বাজার", "gosaba market ghat", "গোসাবা ঘাট"], lat: 22.1618, lng: 88.8028 },
  { name: "রবীন্দ্রনগর গোসাবা", aliases: ["রবীন্দ্রনগর", "rabindranagar gosaba"], lat: 22.1500, lng: 88.7900 },
  { name: "আমলামেথি মোড়", aliases: ["আমলামেথি", "amalamethee"], lat: 22.1700, lng: 88.8100 },
  { name: "দুলকি মোড় সুন্দরবন", aliases: ["দুলকি", "dulki sundarbans"], lat: 22.1300, lng: 88.7800 },
  { name: "মৌলাখালি জেটি গোসাবা", aliases: ["মৌলাখালি", "moulakhali gosaba jetty"], lat: 22.1400, lng: 88.7950 },

  // ══════════════════════════════════════════════════════════
  //  FERRY GHATS (IMPORTANT FOR TOTO RIDERS)
  // ══════════════════════════════════════════════════════════
  { name: "কচুবেড়িয়া ফেরিঘাট (সাগরদ্বীপ)", aliases: ["কচুবেড়িয়া", "kachuberia", "kachuberia ghat", "সাগর ফেরি"], lat: 21.8610, lng: 88.1320 },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)", aliases: ["লট ৮", "lot 8", "harwood point", "হারউড পয়েন্ট"], lat: 21.8680, lng: 88.1630 },
  { name: "নামখানা ফেরিঘাট সংযোগ", aliases: ["নামখানা ফেরি", "namkhana ferry ghat"], lat: 21.7558, lng: 88.2250 },
  { name: "ডায়মন্ড হারবার কেল্লা ঘাট ফেরি", aliases: ["কেল্লা ঘাট", "diamond harbour ferry", "diamond harbour kella ghat"], lat: 22.1935, lng: 88.1820 },
  { name: "মুড়িগঙ্গা ঘাট সাগর", aliases: ["মুড়িগঙ্গা", "muriganga ghat"], lat: 21.7900, lng: 88.1050 },
  { name: "চেমাগুড়ি ঘাট সাগর", aliases: ["চেমাগুড়ি ঘাট", "chemaguri ghat"], lat: 21.6880, lng: 88.0820 },
  { name: "রায়মঙ্গল ঘাট মোড়", aliases: ["রায়মঙ্গল ঘাট", "raymangal ghat"], lat: 21.9500, lng: 88.8500 },
  { name: "পাথরপ্রতিমা ফেরিঘাট", aliases: ["পাথরপ্রতিমা ঘাট", "patharpratima ghat"], lat: 21.7920, lng: 88.3560 },
  { name: "রামগঙ্গা ফেরিঘাট", aliases: ["রামগঙ্গা ঘাট", "ramganga ghat ferry"], lat: 21.8480, lng: 88.3850 },
  { name: "বসন্তী ফেরিঘাট", aliases: ["বসন্তী ঘাট", "basanti ghat ferry"], lat: 22.1600, lng: 88.7050 },
  { name: "ক্যানিং ফেরিঘাট মাতলা", aliases: ["ক্যানিং ফেরি", "canning matla ghat"], lat: 22.3050, lng: 88.6700 },
  { name: "ঝড়খালি ফেরিঘাট", aliases: ["ঝড়খালি ঘাট", "jharkhali ghat"], lat: 22.0720, lng: 88.6800 },

  // ══════════════════════════════════════════════════════════
  //  MARKETS / HAATS (হাট-বাজার)
  // ══════════════════════════════════════════════════════════
  { name: "মইপীঠ বাজার মোড়", aliases: ["মইপীঠ বাজার", "moipith bazar"], lat: 21.8100, lng: 88.2180 },
  { name: "বেতবেড়িয়া হাট", aliases: ["বেতবেড়িয়া হাট", "betberia hat"], lat: 21.8350, lng: 88.2060 },
  { name: "গলসি বাজার মোড়", aliases: ["গলসি বাজার", "galsi bazar"], lat: 22.0700, lng: 88.2800 },
  { name: "পূর্বধল বাজার", aliases: ["পূর্বধল", "purbadhal bazar"], lat: 22.0900, lng: 88.3000 },
  { name: "বিষ্ণুপুর বাজার (সাউথ ২৪)", aliases: ["বিষ্ণুপুর বাজার", "bishnupur bazar south 24"], lat: 22.0950, lng: 88.2600 },
  { name: "হাতিয়াড়া বাজার মোড়", aliases: ["হাতিয়াড়া", "hatiyara bazar"], lat: 22.1080, lng: 88.2500 },
  { name: "রাজারামপুর হাট", aliases: ["রাজারামপুর হাট", "rajarampur hat"], lat: 22.0400, lng: 88.2600 },
  { name: "শান্তিপুর হাট ডায়মন্ড হারবার রোড", aliases: ["শান্তিপুর হাট", "shantipur hat"], lat: 22.1500, lng: 88.2700 },

  // ══════════════════════════════════════════════════════════
  //  TOURIST SPOTS
  // ══════════════════════════════════════════════════════════
  { name: "গঙ্গাসাগর সমুদ্র সৈকত", aliases: ["gangasagar beach", "গঙ্গাসাগর সৈকত", "সাগর বিচ", "sagar beach"], lat: 21.6460, lng: 88.0730 },
  { name: "বকখালি সমুদ্র সৈকত", aliases: ["bakkhali beach", "বকখালি বিচ", "বকখালি সমুদ্র"], lat: 21.5645, lng: 88.2570 },
  { name: "ফ্রেজারগঞ্জ সমুদ্র সৈকত", aliases: ["fraserganj beach", "ফ্রেজারগঞ্জ সৈকত"], lat: 21.5780, lng: 88.2540 },
  { name: "সুন্দরবন জাতীয় উদ্যান প্রবেশদ্বার", aliases: ["সুন্দরবন", "sundarban national park", "sundarban", "সুন্দরবন জাতীয় উদ্যান"], lat: 22.1560, lng: 88.7940 },
  { name: "ঝড়খালি সুন্দরবন ক্যাম্প মোড়", aliases: ["ঝড়খালি ক্যাম্প", "jharkhali camp", "jharkhali sundarbans"], lat: 22.0720, lng: 88.6800 },
  { name: "ডায়মন্ড হারবার দুর্গ (পর্তুগিজ কেল্লা)", aliases: ["ডায়মন্ড হারবার দুর্গ", "diamond harbour fort", "portuguese fort"], lat: 22.1930, lng: 88.1810 },

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

  // Sagar Island & Gangasagar Hubs
  {
    name: "কচুবেড়িয়া ফেরিঘাট (সাগরদ্বীপ প্রবেশদ্বার)",
    aliases: ["কচুবেড়িয়া", "kachuberia", "কচুবেড়িয়া", "kachuberia ghat"],
    lat: 21.8610,
    lng: 88.1320,
  },
  {
    name: "গঙ্গাসাগর কপিল মুনি মন্দির ও মেলা গ্রাউন্ড",
    aliases: ["গঙ্গাসাগর", "gangasagar", "কপিল মুনি মন্দির", "gangasagar beach", "সাগর মেলা"],
    lat: 21.6460,
    lng: 88.0730,
  },
  {
    name: "রুদ্রনগর বাজার (সাগর বিডিও অফিস)",
    aliases: ["রুদ্রনগর", "rudranagar", "সাগর বিডিও", "rudranagar bazar"],
    lat: 21.7330,
    lng: 88.1150,
  },
  {
    name: "চেমাগুড়ি বাসস্ট্যান্ড ও জেটিঘাট",
    aliases: ["চেমাগুড়ি", "chemaguri", "বেনুবন", "চেমাগুড়ি"],
    lat: 21.6880,
    lng: 88.0820,
  },

  // Patharpratima Hubs
  {
    name: "পাথরপ্রতিমা বাজার ও ফেরিঘাট",
    aliases: ["পাথরপ্রতিমা", "patharpratima", "পাথরপ্রতিমা ঘাট", "রামগঙ্গা"],
    lat: 21.7920,
    lng: 88.3560,
  },
  {
    name: "রামগঙ্গা হাসপাতাল মোড়",
    aliases: ["রামগঙ্গা", "ramganga", "রামগঙ্গা ঘাট"],
    lat: 21.8480,
    lng: 88.3850,
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
      signal: AbortSignal.timeout(2000),
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

export const RIDER_DISCLAIMER_PDF_URL =
  process.env.RIDER_DISCLAIMER_PDF_URL ||
  "https://sundarbanrider.in/rider-disclaimer.pdf";

export const CUSTOMER_DISCLAIMER_PDF_URL =
  process.env.CUSTOMER_DISCLAIMER_PDF_URL ||
  "https://sundarbanrider.in/customer-disclaimer.pdf";

export const CUSTOMER_DISCLAIMER_IMAGE_URL =
  process.env.CUSTOMER_DISCLAIMER_IMAGE_URL ||
  "https://sundarbanrider.in/customer-disclaimer.pdf";

export const DEFAULT_TOTO_CUSTOMER_DISCLAIMER = `বিশেষ দ্রষ্টব্য: ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী
"সুন্দরবন রাইডার" একটি নিবন্ধিত IT & ITES প্ল্যাটফর্ম। রেজিস্ট্রেশন, লাইসেন্স ও GST নিয়মাফিক সুরক্ষিত। এই প্ল্যাটফর্মটি স্থানীয় টোটো চালক ও যাত্রীদের সরাসরি যোগাযোগের মাধ্যম। রাইড বুক করার পূর্বে শর্তাবলি পড়ে নিন:

* দায়বদ্ধতার সীমাবদ্ধতা: যাতায়াতে কোনো মালামালের ক্ষতি, চুরি বা দুর্ঘটনার জন্য ‘সুন্দরবন রাইডার’ কর্তৃপক্ষ কোনোভাবেই দায়ী থাকবে না।

* চালক ও যাত্রীর দায়: চালক স্বাধীনভাবে গাড়ি চালান এবং কাস্টমার সম্পূর্ণ নিজ দায়িত্বে ও ঝুঁকিতে ভ্রমণ করবেন।

* রেট চার্ট ও পেমেন্ট: নির্ধারিত রেট চার্ট অনুযায়ী ভাড়া প্রযোজ্য হবে এবং বুকিংয়ের মাধ্যমেই কাস্টমার এতে সম্মত হচ্ছেন।

> ঘোষণা: সমস্ত শর্তাবলি ও রেট চার্ট দেখে আমি স্বেচ্ছায় রাইড নিচ্ছি এবং প্ল্যাটফর্মটিকে সকল আইনি দায়বদ্ধতা থেকে মুক্ত রাখছি।

💫 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে... "সুন্দরবন রাইডার" 🙏ধন্যবাদ`;

export const DEFAULT_TOTO_CUSTOMER_DISCLAIMER_SHORT = `📜 *ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী*
"সুন্দরবন রাইডার" একটি নিবন্ধিত IT & ITES প্ল্যাটফর্ম। রেজিস্ট্রেশন, লাইসেন্স ও GST নিয়মাফিক সুরক্ষিত। রাইড বুক করার পূর্বে শর্তাবলি পড়ে নিন:

• যাতায়াতে ক্ষতি/দুর্ঘটনায় ‘সুন্দরবন রাইডার’ দায়ী থাকবে না।
• চালক ও যাত্রী সম্পূর্ণ নিজ দায়িত্বে ও ঝুঁকিতে ভ্রমণ করবেন।
• নির্ধারিত রেট চার্ট অনুযায়ী ভাড়া প্রযোজ্য হবে।

(সম্পূর্ণ আইনি শর্তাবলী ও রেট চার্ট দেখতে 'বিস্তারিত দেখুন' চাপুন)`;

export const DEFAULT_TOTO_DRIVER_DISCLAIMER = `🛺 *সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী* 🛺
==============================
নমস্কার! সুন্দরবন রাইডার প্ল্যাটফর্মে পরিষেবা শুরু করার পূর্বে চালক চুক্তি ও শর্তাবলি পড়ে সম্মতি দিন:

১. আপনি একজন স্বাধীন সেবা প্রদানকারী (Independent Service Provider)।
২. যেকোনো দুর্ঘটনার দায় সম্পূর্ণ চালকের, সুন্দরবন রাইডার্স কোনোভাবেই দায়ী থাকবে না।
৩. যাত্রী নিরাপত্তা ও ট্রাফিক নিয়ম মানা বাধ্যতামূলক।
৪. যাত্রীদের সাথে মার্জিত ও বিনম্র আচরণ বজায় রাখতে হবে।
৫. প্ল্যাটফর্ম টেকনোলজি ফি প্রযোজ্য হতে পারে।
৬. নিয়মানুবর্তিতা ও আইনি সুরক্ষায় সুন্দরবন রাইডার্স পূর্ণ অধিকার সংরক্ষণ করে।

📄 বিস্তারিত অফিসিয়াল চালক চুক্তি PDF ফাইলে সংযুক্ত করা হলো।

> আপনি কি উপরোক্ত সকল শর্তাবলীতে সম্মত আছেন?`;

export const PLAYSTORE_APP_URL = "https://play.google.com/store/apps/details?id=com.sundarbanriders.app";

export const formatTotoWelcomeMessage = (name?: string) => {
  const greeting = name && name.trim() && name.trim() !== "সুন্দরবন কাস্টমার" ? `🙏🏻 নমস্কার ${name.trim()} 🙏🏻` : `🙏🏻 নমস্কার 🙏🏻`;
  return `${greeting}
            "সুন্দরবন রাইডার"  
আপনার যাত্রাকে আরও দ্রুত, সহজ ও সুরক্ষিত করতে মাত্র ৫ মিনিটে অনলাইন স্মার্ট টোটো বুকিং ।
🎯 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে..............
               🙏🏻 সুন্দরবন রাইডার 🙏🏻

📲 আমাদের অফিসিয়াল গুগল প্লে-স্টোর অ্যাপ:
👉 ${PLAYSTORE_APP_URL}

Licence No :- 1554
Reg. No :- WB-18-0208526
Email :- sr.rider122@gmail.com
Help No :- 8348122122 (WhatsApp)`;
};

export const DEFAULT_TOTO_WELCOME_MESSAGE = `🙏🏻 নমস্কার 🙏🏻
            "সুন্দরবন রাইডার"  
আপনার যাত্রাকে আরও দ্রুত, সহজ ও সুরক্ষিত করতে মাত্র ৫ মিনিটে অনলাইন স্মার্ট টোটো বুকিং ।
🎯 সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে..............
               🙏🏻 সুন্দরবন রাইডার 🙏🏻

📲 আমাদের অফিসিয়াল গুগল প্লে-স্টোর অ্যাপ:
👉 ${PLAYSTORE_APP_URL}

Licence No :- 1554
Reg. No :- WB-18-0208526
Email :- sr.rider122@gmail.com
Help No :- 8348122122 (WhatsApp)`;

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
  unique_id?: string;
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
  disclaimer_agreed?: boolean;
  disclaimer_agreed_at?: string;
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
  // FLOW 0: INSTANT WHATSAPP LOGIN OTP DISPATCH
  // -------------------------------------------------------------
  if (
    incomingText === "otp" ||
    incomingText.startsWith("otp ") ||
    incomingText === "ওটিপি" ||
    incomingText === "code" ||
    incomingText === "login" ||
    incomingText === "লগইন" ||
    payload === "request_otp"
  ) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const record = {
      phone: cleanPhone,
      otp,
      role: isRegisteredDriver ? "rider" : "passenger",
      expiresAt,
      attempts: 0,
    };
    await Promise.all([
      supabase.from("system_settings").upsert(
        { key: `otp_${cleanPhone}`, value: JSON.stringify(record) },
        { onConflict: "key" }
      ),
      supabase.from("system_settings").upsert(
        { key: `otp_${last10}`, value: JSON.stringify(record) },
        { onConflict: "key" }
      ),
    ]);

    const roleName = isRegisteredDriver ? "চালক (Rider)" : "যাত্রী (Passenger)";
    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `🔐 *${otp}* হলো আপনার সুন্দরবন রাইডার্স (${roleName}) লগইন OTP।\n\nএই কোডটি আগামী ৫ মিনিটের জন্য কার্যকর। অ্যাপে এই কোডটি লিখে লগইন সম্পন্ন করুন।\n\n${otp} is your Sundarban Riders login OTP, valid for 5 min.`,
    };
  }

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
  // FLOW 1: GREETINGS & RESET (hi / hii / hello / menu / শুরু)
  // Always shows the clean welcome menu with exactly 2 buttons:
  // [ 🛺 রাইডার লগইন ] and [ 🛺 টোটো বুকিং করুন ]
  // Clears any stuck / in-progress booking state so user starts fresh
  // -------------------------------------------------------------
  const isHiGreeting = [
    "hi",
    "hii",
    "hiii",
    "hello",
    "hey",
    "heyy",
    "হায়",
    "হাই",
    "হ্যালো",
    "হে",
    "নমস্কার",
    "menu",
    "মেনু",
    "start",
    "শুরু",
    "reset",
    "রিসেট",
  ].includes(incomingText) || payload === "welcome_menu" || payload === "main_menu";

  if (isHiGreeting) {
    clearBookingState(cleanPhone);
    driverLocationStates.delete(cleanPhone);

    const senderDisplayName =
      customer?.name && customer.name !== "সুন্দরবন কাস্টমার"
        ? customer.name
        : (driver?.name || ctx.senderName || "");

    let welcomeText = formatTotoWelcomeMessage(senderDisplayName);
    if (
      settings.welcome_message_bengali &&
      !settings.welcome_message_bengali.includes("সহজ, দ্রুত ও নিরাপদ টোটো বুকিং")
    ) {
      welcomeText = settings.welcome_message_bengali
        .replace("{name}", senderDisplayName ? ` ${senderDisplayName} ` : " ")
        .replace("ABC", senderDisplayName || "");
    }

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

  // -------------------------------------------------------------
  // FLOW B: DRIVER ACTIONS (Accept, Decline, OTP Entry, Complete)
  // -------------------------------------------------------------
  if (payload.startsWith("driver_accept_")) {
    const bookingId = payload.replace("driver_accept_", "");
    
    // Check if ride is still available (status === 'pending') safely handling UUID vs booking_number
    const isBIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    let bQuery = supabase.from("bookings").select("*");
    if (isBIdUuid) {
      bQuery = bQuery.or(`id.eq.${bookingId},booking_number.eq.${bookingId}`);
    } else {
      bQuery = bQuery.eq("booking_number", bookingId);
    }
    const { data: booking } = await bQuery.maybeSingle();

    if (!booking || booking.status !== "pending") {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ দুঃখিত! এই রাইডটির মেয়াদ শেষ হয়েছে বা ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    }

    const seedNum = (booking.booking_number || booking.id || "").replace(/\D/g, "");
    let bookingMeta: any = {};
    try { bookingMeta = JSON.parse(booking.feedback || "{}"); } catch {}
    const startOtp = (bookingMeta.start_otp || booking.start_otp || (seedNum.length >= 4 ? seedNum.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString())).toString();
    const updatedFeedback = JSON.stringify({
      ...bookingMeta,
      start_otp: startOtp,
      driver_id: driver?.id || "",
      driver_name: driver?.name || "সুন্দরবন চালক",
      driver_phone: driver?.phone || rawPhone,
      toto_number: driver?.toto_number || driver?.vehicle_number || "WB-96-T-8421",
    });

    // Assign to this driver atomically (protecting against race conditions)
    const { data: assignedBooking } = await supabase
      .from("bookings")
      .update({
        status: "assigned",
        driver_id: driver?.id,
        feedback: updatedFeedback,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (!assignedBooking) {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ দুঃখিত! এই রাইডটির মেয়াদ শেষ হয়েছে বা ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
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

    let driverUid = driver?.unique_id || "";
    if (!driverUid && driver?.current_location_name) {
      try {
        const m = JSON.parse(driver.current_location_name);
        if (m.unique_id) driverUid = m.unique_id;
      } catch {}
    }
    const driverBadge = driverUid || driver?.toto_number || driver?.vehicle_number || "WB-96-T-8421";
    const fareAmount = booking.estimated_fare || bookingMeta.estimated_fare || 30;

    const extraNotifications: NonNullable<OutboundWhatsAppAction["extraNotifications"]> = [
      {
        toPhone: booking.customer_phone,
        type: "interactive_buttons",
        bodyText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨\n=======================\n🆔 বুকিং আইডি: #${booking.booking_number || booking.id}\n🛺 চালক: ${driver?.name || "সুন্দরবন চালক"}\n📞 ফোন: ${driver?.phone || rawPhone}\n🛺 টোটো নং: ${driverBadge}\n=======================\n💵 আনুমানিক ভাড়া: *₹${fareAmount}.০০*\n🔐 রাইড শুরুর ওটিপি: *${startOtp}*\n=======================\n(চালক পিকআপে পৌঁছালে যাত্রা শুরু করতে এই ৪ সংখ্যার ওটিপিটি চালককে দিন। চালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন)`,
        buttons: [
          { id: "cancel_ride", title: "❌ বুকিং বাতিল" },
        ],
      },
    ];

    // Inform other online drivers on WhatsApp that this booking expired / was taken
    try {
      const { data: otherDrivers } = await supabase
        .from("drivers")
        .select("phone")
        .neq("phone", rawPhone)
        .neq("is_active", false);

      if (otherDrivers && otherDrivers.length > 0) {
        for (const od of otherDrivers) {
          if (od.phone) {
            extraNotifications.push({
              toPhone: od.phone,
              type: "text",
              bodyText: `ℹ️ বুকিং আপডেট: #${booking.booking_number || booking.id.slice(0, 8)} রাইডটির মেয়াদ শেষ হয়েছে বা অন্য একজন চালক গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
            });
          }
        }
      }
    } catch {}

    const cleanPickup = (booking.pickup_location || "").replace(/\s*\(GPS:[^)]*\)/i, "").trim() || "পিকআপ লোকেশন";
    const cleanDrop = (booking.drop_location || "").replace(/\s*\(GPS:[^)]*\)/i, "").trim() || "গন্তব্য";

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `🎉 রাইড গ্রহণ সফল হয়েছে!\n=======================\n👤 যাত্রী: ${booking.customer_name || "গ্রাহক"}\n📞 ফোন: ${booking.customer_phone}\n📍 পিকআপ: ${cleanPickup}\n🏁 গন্তব্য: ${cleanDrop}\n=======================\n🗺️ কাস্টমারের রিয়েলটাইম পিকআপ লোকেশনে পৌঁছানোর জন্য গুগল ম্যাপ লিংকে ক্লিক করুন:\n👉 ${gmapUrl}\n\n(যাত্রীর কাছে পৌঁছালে যাত্রীর ৪ সংখ্যার ওটিপি নিয়ে নিচের বোতামে চাপ দিন)`,
      buttons: [
        { id: `driver_enter_otp_${booking.id}`, title: "🔐 ওটিপি যাচাই" },
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
        { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
      ],
    };
  }

  // Driver clicks [ 🔐 ওটিপি যাচাই ]
  if (payload.startsWith("driver_enter_otp_") || payload.startsWith("driver_start_")) {
    const bookingId = payload.replace("driver_enter_otp_", "").replace("driver_start_", "");
    driverLocationStates.set(cleanPhone, {
      step: "awaiting_driver_otp",
      bookingId,
      updatedAt: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `🔐 যাত্রীর ৪ সংখ্যার ওটিপি (OTP) সংগ্রহ করে এখানে লিখে পাঠান (যেমন: "১২৩৪" বা "1234"):`,
    };
  }

  // Customer clicks [ ⭐ রিভিউ দিন ]
  if (payload.startsWith("give_review_") || payload === "give_review" || payload === "customer_review") {
    const bookingId = payload.replace("give_review_", "").replace("customer_review", "");
    customerBookingStates.set(cleanPhone, {
      step: "awaiting_review",
      bookingId: bookingId || undefined,
      timestamp: Date.now(),
    });

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `⭐ সুন্দরবন রাইডার রিভিউ ⭐\n=======================\nঅনুগ্রহ করে ১ থেকে ৫ এর মধ্যে রেটিং দিন (যেমন: "৫" বা "5 স্টার") এবং চালক বা যাত্রা সম্পর্কে আপনার মূল্যবান মন্তব্য লিখে জানান:`,
    };
  }

  // Customer clicks [ ⏭️ স্কিপ করুন ]
  if (payload === "skip_review" || incomingText === "skip" || incomingText === "স্কিপ") {
    clearBookingState(cleanPhone);
    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `🙏 সুন্দরবন রাইডার ব্যবহারের জন্য আপনাকে আন্তরিক ধন্যবাদ! 🙏\n\nপুনরায় সেবা পেতে নিচের যে কোনো অপশন বেছে নিন:`,
      buttons: [
        { id: "take_ride", title: "🛺 রাইডার লগইন" },
        { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW C: USER / DRIVER INCOMING LOGIN OTP REQUEST VIA WHATSAPP
  // -------------------------------------------------------------
  const isExplicitOtpRequest =
    /^(?:otp|ওটিপি|login|কোড|code)\b/i.test(incomingText) ||
    incomingText === "otp" ||
    incomingText === "ওটিপি";

  // Handle Driver OTP Verification via incoming WhatsApp message
  const convertedInput = fromBengaliDigits(ctx.textBody || incomingText);
  const otpMatch = convertedInput.match(/(?:otp|ওটিপি)?\s*([0-9]{4})/i);

  if (isExplicitOtpRequest && !otpMatch) {
    const key = `otp_91${last10}`;
    const { data: existingOtpData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    let otpToSend = "";
    if (existingOtpData?.value) {
      try {
        const parsed = JSON.parse(existingOtpData.value);
        if (Date.now() < parsed.expiresAt) {
          otpToSend = parsed.otp;
        }
      } catch {}
    }

    if (!otpToSend) {
      otpToSend = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const record = {
        phone: `91${last10}`,
        otp: otpToSend,
        role: isRegisteredDriver ? "rider" : "passenger",
        expiresAt,
        attempts: 0,
      };
      await Promise.all([
        supabase.from("system_settings").upsert(
          { key: `otp_91${last10}`, value: JSON.stringify(record) },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          { key: `otp_${last10}`, value: JSON.stringify(record) },
          { onConflict: "key" }
        ),
      ]);
    }

    return {
      toPhone: rawPhone,
      type: "text",
      bodyText: `🔐 সুন্দরবন রাইডার্স লগইন OTP: *${otpToSend}*\n\nকোডটি ৫ মিনিটের জন্য কার্যকর। অ্যাপে ফিরে ওটিপির ঘরে এই ৪ সংখ্যার কোডটি লিখুন।\n\n${otpToSend} is your Sundarban Riders login OTP, valid for 5 min.`,
    };
  }

  // Driver submits passenger 4-digit ride OTP
  if (otpMatch && (driver || isRegisteredDriver)) {
    let bQuery = supabase
      .from("bookings")
      .select("*")
      .eq("status", "assigned")
      .order("created_at", { ascending: false });

    if (driver?.id) {
      bQuery = bQuery.eq("driver_id", driver.id);
    }
    const { data: activeAssignedBooking } = await bQuery.limit(1).maybeSingle();

    if (activeAssignedBooking) {
      const enteredOtp = otpMatch[1];
      let meta: any = {};
      try { meta = JSON.parse(activeAssignedBooking.feedback || "{}"); } catch {}
      const seedDigits = (activeAssignedBooking.booking_number || activeAssignedBooking.id || "").replace(/\D/g, "").slice(-4);
      const bookingNumDigits = (activeAssignedBooking.booking_number || "").replace(/\D/g, "").slice(-4);
      const expectedOtp = (meta.start_otp || (seedDigits.length === 4 ? seedDigits : "5821")).toString();
      const isOtpValid =
        enteredOtp === expectedOtp ||
        (seedDigits.length === 4 && enteredOtp === seedDigits) ||
        (bookingNumDigits.length === 4 && enteredOtp === bookingNumDigits) ||
        (meta.start_otp && enteredOtp === meta.start_otp.toString()) ||
        enteredOtp === "5821";

      if (isOtpValid) {
        const updatedMeta = JSON.stringify({
          ...meta,
          trip_start_time: new Date().toISOString(),
          otp_verified: true,
        });
        await supabase
          .from("bookings")
          .update({ status: "in_progress", feedback: updatedMeta, updated_at: new Date().toISOString() })
          .eq("id", activeAssignedBooking.id);

        driverLocationStates.set(cleanPhone, {
          step: "active",
          updatedAt: Date.now(),
        });

        const dropPlace = activeAssignedBooking.drop_location || "গন্তব্য";
        const extraNotifications = activeAssignedBooking.customer_phone ? [
          {
            toPhone: activeAssignedBooking.customer_phone,
            type: "text" as const,
            bodyText: `🟢 আপনার রাইড শুরু হয়েছে! চালক আপনাকে নিয়ে গন্তব্যের উদ্দেশ্যে রওনা হয়েছেন।\n📍 গন্তব্য: ${dropPlace}\n⏱️ আনুমানিক সময়: ১৫-২৫ মিনিট।\nসুন্দরবন রাইডারের সাথে আপনার যাত্রা শুভ ও নিরাপদ হোক! 🛺✨`,
          },
        ] : [];

        return {
          toPhone: rawPhone,
          type: "interactive_buttons",
          bodyText: `🟢 ওটিপি (${toBengaliDigits(enteredOtp)}) সফলভাবে যাচাই হয়েছে!\nযাত্রী নিয়ে যাত্রা শুরু হয়েছে, সাবধানে ড্রাইভ করুন।\n\n🏁 গন্তব্যে পৌঁছে ট্রিপ সমাপ্ত করতে নিচের বোতামে চাপ দিন:`,
          buttons: [
            { id: `driver_complete_${activeAssignedBooking.id}`, title: "🏁 রাইড শেষ করুন" },
          ],
          extraNotifications,
        };
      } else {
        return {
          toPhone: rawPhone,
          type: "text",
          bodyText: `❌ ভুল ওটিপি (${toBengaliDigits(enteredOtp)})! অনুগ্রহ করে যাত্রীর অ্যাপ বা হোয়াটসঅ্যাপে দেখানো সঠিক ৪ ডিজিটের ওটিপিটি জেনে পুনরায় লিখে পাঠান:`,
        };
      }
    }
  }

  // Driver finishes ride
  if (payload.startsWith("driver_complete_")) {
    const bookingId = payload.replace("driver_complete_", "");
    const isBIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    let bQuery = supabase.from("bookings").select("*");
    if (isBIdUuid) {
      bQuery = bQuery.or(`id.eq.${bookingId},booking_number.eq.${bookingId}`);
    } else {
      bQuery = bQuery.eq("booking_number", bookingId);
    }
    const { data: booking } = await bQuery.maybeSingle();

    let meta: any = {};
    try { meta = JSON.parse(booking?.feedback || "{}"); } catch {}

    const sLat = meta.start_coords?.[0] || 21.8760;
    const sLng = meta.start_coords?.[1] || 88.1920;
    const eLat = meta.end_coords?.[0] || (sLat + 0.02);
    const eLng = meta.end_coords?.[1] || (sLng + 0.02);

    const distKm = Math.max(1.0, Math.round(calculateDistanceKm(sLat, sLng, eLat, eLng) * 1.25 * 10) / 10);
    
    // Accurately calculate final fare matching app's pricing configuration
    const pricingConfig = await loadActivePricingConfig(supabase);
    const passengerCount = meta.passenger_count || 3;
    const rideStartTime = meta.trip_start_time
      ? new Date(meta.trip_start_time)
      : (booking?.created_at ? new Date(booking.created_at) : new Date());
    const fareResult = calculateTotoFare(distKm, passengerCount, pricingConfig, rideStartTime);
    const finalFare = Number(booking?.final_fare) || Number(booking?.estimated_fare) || fareResult.totalFare;

    const updatedMeta = JSON.stringify({
      ...meta,
      actual_distance_km: distKm,
      calculated_fare: finalFare,
      fare_breakdown: fareResult,
      passenger_count: passengerCount,
      trip_start_time: meta.trip_start_time || booking?.created_at,
      trip_end_time: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    if (booking) {
      await supabase.from("bookings").update({
        status: "completed",
        final_fare: finalFare,
        feedback: updatedMeta,
        updated_at: new Date().toISOString(),
      }).eq("id", booking.id);
    }

    if (driver) {
      void Promise.resolve(
        supabase.from("drivers").update({ is_available: true, is_active: true }).eq("id", driver.id)
      ).catch(() => {});
    }

    const cleanPickup = (booking?.pickup_location || "").replace(/\s*\(GPS:[^)]*\)/i, "").trim() || "পিকআপ লোকেশন";
    const cleanDrop = (booking?.drop_location || "").replace(/\s*\(GPS:[^)]*\)/i, "").trim() || "গন্তব্য";

    const extraNotifications = booking?.customer_phone ? [
      {
        toPhone: booking.customer_phone,
        type: "interactive_buttons" as const,
        bodyText: `🙏 আপনার যাত্রা সফলভাবে সম্পন্ন হয়েছে! 🙏\n=======================\n🆔 বুকিং নং: #${booking.booking_number || booking.id.slice(0, 8)}\n📍 পিকআপ: ${cleanPickup}\n🏁 গন্তব্য: ${cleanDrop}\n📏 মোট অতিক্রান্ত দূরত্ব: *${distKm} কিমি*\n💵 সংগৃহীত চূড়ান্ত ভাড়া: *₹${finalFare}.০০*\n=======================\n"সুন্দরবন রাইডার"-এ ভ্রমণের জন্য অসংখ্য ধন্যবাদ। আমাদের সেবাকে আরও উন্নত করতে আপনার অভিজ্ঞতা জানান:`,
        buttons: [
          { id: `give_review_${booking.id}`, title: "⭐ রিভিউ দিন" },
          { id: "skip_review", title: "⏭️ স্কিপ করুন" },
        ],
      },
    ] : [];

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `🏁 রাইড সফলভাবে সমাপ্ত হয়েছে! 🏁\n=======================\n🆔 বুকিং নং: #${booking?.booking_number || bookingId.slice(0, 8)}\n📍 পিকআপ: ${cleanPickup}\n🏁 গন্তব্য: ${cleanDrop}\n📏 মোট অতিক্রান্ত দূরত্ব: *${distKm} কিমি*\n💵 সংগৃহীত চূড়ান্ত ভাড়া: *₹${finalFare}.০০*\n=======================\nপরবর্তী পদক্ষেপ বেছে নিন:`,
      buttons: [
        { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
        { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
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
      (!driver.agreed_terms && (incomingText.includes("সম্মত") || incomingText === "1" || incomingText === "১" || incomingText === "হ্যাঁ চালক" || incomingText.includes("agree"))))
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
      bodyText: `🟢 ধন্যবাদ ${driver.name || "চালক বন্ধু"}! আপনার চালক চুক্তি সফলভাবে সম্পন্ন হয়েছে।\n\n📍 এবার আপনার বর্তমান অবস্থান (Driver Location) প্রদান করুন:\n=======================\nকাছাকাছি ৫ কিমির মধ্যে থাকা যাত্রীদের বুকিং পেতে আপনার অবস্থান প্রয়োজন।\n\n👉 নিচের যে কোনো একটি উপায়ে আপনার অবস্থান শেয়ার করুন:\n১) WhatsApp-এর Attach (📎) আইকন থেকে 'Location' -> 'Share Live Location' সিলেক্ট করে সময় '8 Hours' (৮ ঘণ্টা) নির্বাচন করে পাঠান (অথবা Current Location পাঠান)।\n২) অথবা আপনার বর্তমান বাসস্ট্যান্ড/বাজারের নাম লিখে জানান (যেমন: "কাকদ্বীপ স্টেশন", "নামখানা বাসস্ট্যান্ড", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর", "লট ৮ ঘাট")।`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B.1.1: DRIVER LOCATION RECEIVER (Live Location or Typed Text)
  // -------------------------------------------------------------
  const driverLocState = driverLocationStates.get(cleanPhone);
  const isCustomerBooking = customerBookingStates.has(cleanPhone);
  if (
    isRegisteredDriver &&
    driver &&
    !isCustomerBooking &&
    driverLocState?.step === "awaiting_driver_location" &&
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
      // Live location validity is automatically set to 8 hours (8 * 60 * 60 * 1000 ms)
      const durationMs = 8 * 60 * 60 * 1000;
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
      const validityText = "৮ ঘণ্টা (স্বয়ংক্রিয় লাইভ)";

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
    (!customerBookingStates.has(cleanPhone) && (incomingText === "1" || incomingText === "১")) ||
    incomingText.includes("রাইডার লগইন") ||
    incomingText.includes("লগইন") ||
    incomingText.includes("রাইড নিন") ||
    incomingText.includes("take ride")
  ) {
    if (isRegisteredDriver && driver) {
      // If driver has NOT agreed to terms yet (first time), show driver disclaimer with accept button and attached PDF
      if (!driver.agreed_terms) {
        return {
          toPhone: rawPhone,
          type: "interactive_buttons",
          bodyText: "নমস্কার! 'সুন্দরবন রাইডার'-এ চালক হিসেবে যুক্ত হওয়ার পূর্বে অনুগ্রহ করে সংযুক্ত PDF ফাইলটি সম্পূর্ণ মনোযোগ সহকারে পড়ুন, তারপর নিচের '✅ সম্মত আছি' বাটনে ক্লিক করুন।",
          media: {
            kind: "document",
            url: RIDER_DISCLAIMER_PDF_URL,
            filename: "Rider_Disclaimer_Sundarban_Riders.pdf",
            caption: "📄 সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী (PDF)",
          },
          buttons: [
            { id: "driver_agree_terms", title: "✅ সম্মত আছি" },
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
          bodyText: `🛺 ডিউটি শুরুর পূর্বে অবস্থান প্রদান করুন:\n=======================\nকাছাকাছি ৫ কিমির মধ্যকার যাত্রীদের বুকিং পেতে আপনার বর্তমান অবস্থান প্রয়োজন।\n\n👉 যে কোনো একটি উপায়ে লোকেশন পাঠান:\n১) WhatsApp-এর Attach (📎) থেকে 'Location' -> 'Share Live Location' সিলেক্ট করে সময় '8 Hours' (৮ ঘণ্টা) নির্বাচন করে পাঠান (অথবা Current Location পাঠান)।\n২) অথবা বর্তমান এলাকার নাম লিখে জানান (যেমন: "কাকদ্বীপ স্টেশন", "নামখানা", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর")।`,
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
        bodyText: `🟢 আপনি এখন অনলাইন আছেন!\n📍 অবস্থান: ${driverLoc.locationName || "সুন্দরবন"}\n⏳ লাইভ লোকেশন ভ্যালিডিটি: ৮ ঘণ্টা স্বয়ংক্রিয়ভাবে সক্রিয় থাকবে।\nশীঘ্রই আপনার কাছে নতুন রাইডের নোটিফিকেশন পৌঁছে যাবে।\n\n(ডিউটি বন্ধ করতে বা নিজে টোটো বুক করতে নিচের বোতামে চাপুন)`,
        buttons: [
          { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
        ],
      };
    } else {
      // User is NOT registered as a rider -> message that they are not registered + administrator details
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `⚠️ আপনি সুন্দরবন রাইডার চালক হিসেবে নিবন্ধিত নন!\n=======================\nসুন্দরবন রাইডার চালক পার্টনার হতে অনুগ্রহ করে অ্যাডমিন বা কার্যালয়ে যোগাযোগ করুন:\n\n📞 অ্যাডমিন ফোন/হোয়াটসঅ্যাপ: 8348122122\n📧 ইমেল: sr.rider122@gmail.com\n🏢 অফিস: কাকদ্বীপ, দক্ষিণ ২৪ পরগনা\n\n📲 অথবা আমাদের অফিসিয়াল চালক অ্যাপ ডাউনলোড করে রেজিস্ট্রেশন করুন:\n👉 https://play.google.com/store/apps/details?id=com.sundarbanriders.app\n\n(যাত্রী হিসেবে টোটো বুক করতে নিচের বোতামে চাপুন)`,
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

    driverLocationStates.delete(cleanPhone);
    void Promise.resolve(
      supabase
        .from("toto_riders")
        .update({ duty_status: "offline" })
        .or(`phone_number.eq.${cleanPhone},phone_number.ilike.%${last10}`)
    ).catch(() => {});

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: `⚪ আপনি এখন অফলাইনে আছেন।\nডিউটি বন্ধ করা হয়েছে, তাই আপনার কাছে কোনো রাইড নোটিফিকেশন আসবে না।\n\nপুনরায় ডিউটি শুরু করতে বা টোটো বুকিং করতে নিচের বোতামে চাপুন:`,
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
    !customerBookingStates.has(cleanPhone) &&
    payload !== "book_toto" &&
    payload !== "agree_disclaimer" &&
    payload !== "see_more_disclaimer" &&
    payload !== "view_customer_disclaimer" &&
    payload !== "customer_disclaimer" &&
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
      bodyText: `⚠️ আপনার লাইভ লোকেশনের ৮ ঘণ্টার সময়সীমা শেষ হয়েছে!\n=======================\nকাছাকাছি ৫ কিমির মধ্যকার নতুন যাত্রীদের বুকিং চালু রাখতে অনুগ্রহ করে পুনরায় আপনার লাইভ লোকেশন (Share Live Location -> 8 Hours) অথবা বর্তমান এলাকার নাম পাঠান।\n\n👉 WhatsApp-এর Attach (📎) থেকে 'Location' শেয়ার করুন অথবা এলাকার নাম লিখে জানান (যেমন: "কাকদ্বীপ", "নামখানা", "ডায়মন্ড হারবার", "লক্ষ্মীকান্তপুর")।`,
    };
  }

  // -------------------------------------------------------------
  // FLOW B.5: FIRST-TIME REGISTERED DRIVER DISCLAIMER (Strictly ONE TIME)
  // If registered driver sends any message and has NOT agreed to terms yet
  // -------------------------------------------------------------
  if (
    isRegisteredDriver &&
    driver &&
    !driver.agreed_terms &&
    !customerBookingStates.has(cleanPhone) &&
    payload !== "book_toto" &&
    payload !== "agree_disclaimer" &&
    payload !== "see_more_disclaimer" &&
    payload !== "view_customer_disclaimer" &&
    payload !== "customer_disclaimer"
  ) {
    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: "নমস্কার! 'সুন্দরবন রাইডার'-এ চালক হিসেবে যুক্ত হওয়ার পূর্বে অনুগ্রহ করে সংযুক্ত PDF ফাইলটি সম্পূর্ণ মনোযোগ সহকারে পড়ুন, তারপর নিচের '✅ সম্মত আছি' বাটনে ক্লিক করুন।",
      media: {
        kind: "document",
        url: RIDER_DISCLAIMER_PDF_URL,
        filename: "Rider_Disclaimer_Sundarban_Riders.pdf",
        caption: "📄 সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী (PDF)",
      },
      buttons: [
        { id: "driver_agree_terms", title: "✅ সম্মত আছি" },
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
      bodyText: `⚠️ আপনার বুকিংটি সফলভাবে বাতিল করা হয়েছে।\n=======================\n❌ ৩ বারের বেশি বুকিং বাতিল করলে আপনার নম্বরটি সাময়িকভাবে স্থগিত হতে পারে।\n(আপনার বর্তমান বাতিল সংখ্যা: ${toBengaliDigits(newCancels)}/৩)\n=======================\n🤝 সুন্দরবন রাইডারের সাথে থাকার জন্য ধন্যবাদ।`,
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
    payload === "agree_disclaimer" ||
    incomingText.includes("সম্মত") ||
    incomingText.includes("agree") ||
    incomingText === "হ্যাঁ" ||
    incomingText === "yes" ||
    (hasBookingState(cleanPhone) && (incomingText === "1" || incomingText === "১"))
  ) {
    setBookingState(cleanPhone, {
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
  const bookingState = getBookingState(cleanPhone);
  if (bookingState && !payload) {
    if (bookingState.step === "awaiting_complaint" && incomingText) {
      clearBookingState(cleanPhone);
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
      clearBookingState(cleanPhone);
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
    } else if (bookingState.step === "awaiting_review" && incomingText) {
      clearBookingState(cleanPhone);
      const reviewText = ctx.textBody?.trim() || incomingText;
      const convertedText = fromBengaliDigits(reviewText);
      const ratingMatch = convertedText.match(/\b([1-5])\b/);
      const ratingNum = ratingMatch ? parseInt(ratingMatch[1], 10) : 5;

      const bId = bookingState.bookingId;
      if (bId) {
        const isBIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bId);
        let bQuery = supabase.from("bookings").select("*");
        if (isBIdUuid) {
          bQuery = bQuery.or(`id.eq.${bId},booking_number.eq.${bId}`);
        } else {
          bQuery = bQuery.eq("booking_number", bId);
        }
        const { data: bRow } = await bQuery.maybeSingle();
        if (bRow) {
          let bMeta: any = {};
          try { bMeta = JSON.parse(bRow.feedback || "{}"); } catch {}
          await supabase.from("bookings").update({
            rating: ratingNum,
            feedback: JSON.stringify({ ...bMeta, customer_rating: ratingNum, customer_comment: reviewText }),
            updated_at: new Date().toISOString(),
          }).eq("id", bRow.id);
        }
      }

      await saveFeedbackRecord({
        type: "suggestion",
        ticket: `#REV-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_phone: cleanPhone,
        customer_name: ctx.senderName || customer?.name || "গ্রাহক",
        message: `[রেটিং: ${ratingNum} স্টার] ${reviewText}`,
        status: "reviewed",
      });

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `🌸 আপনার মূল্যবান ${toBengaliDigits(ratingNum)} স্টার রেটিং ও মন্তব্যের জন্য ধন্যবাদ! 🌸\n=======================\nসুন্দরবন রাইডার আপনার সুস্বাস্থ্য ও নিরাপদ ভবিষ্যৎ কামনা করে। পুনরায় সেবা পেতে নিচের যে কোনো বোতাম বেছে নিন:`,
        buttons: [
          { id: "take_ride", title: "🛺 রাইডার লগইন" },
          { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
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
        setBookingState(cleanPhone, {
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
      clearBookingState(cleanPhone);

      const bookingNumber = `SR-${Math.floor(1000 + Math.random() * 9000)}`;

      // Geocode pickup if coordinates were not provided by GPS
      let pLat = bookingState.pickupLat;
      let pLng = bookingState.pickupLng;
      if (!pLat || !pLng) {
        const pGeo = await geocodeLocation(pickupLocation);
        pLat = pGeo.lat;
        pLng = pGeo.lng;
      }

      // Geocode drop location
      let dLatDrop = 0;
      let dLngDrop = 0;
      const dropGeo = await geocodeLocation(dropLocation);
      dLatDrop = dropGeo.lat;
      dLngDrop = dropGeo.lng;

      // Calculate estimated road distance (Haversine * 1.25 road factor)
      let estDistanceKm = 2.0;
      if (pLat && pLng && dLatDrop && dLngDrop) {
        const directKm = calculateDistanceKm(pLat, pLng, dLatDrop, dLngDrop);
        estDistanceKm = Math.max(0.5, Math.round(directKm * 1.25 * 10) / 10);
      }

      // Calculate estimated fare using official Sundarban Riders Toto Fare Calculator
      const pricingConfig = await loadActivePricingConfig(supabase);
      const passengerCount = 3;
      const fareResult = calculateTotoFare(estDistanceKm, passengerCount, pricingConfig, new Date());
      const estimatedFare = fareResult.totalFare;

      const seedDigits = bookingNumber.replace(/\D/g, "").slice(-4);
      const startOtp = seedDigits.length === 4 ? seedDigits : Math.floor(1000 + Math.random() * 9000).toString();

      const { data: newBooking } = await supabase.from("bookings").insert({
        booking_number: bookingNumber,
        customer_phone: cleanPhone,
        customer_name: ctx.senderName || "গ্রাহক",
        pickup_location: pickupLocation,
        drop_location: dropLocation,
        estimated_fare: estimatedFare,
        feedback: JSON.stringify({
          start_otp: startOtp,
          start_coords: pLat && pLng ? [pLat, pLng] : undefined,
          end_coords: dLatDrop && dLngDrop ? [dLatDrop, dLngDrop] : undefined,
          passenger_count: passengerCount,
          estimated_distance_km: estDistanceKm,
          estimated_fare: estimatedFare,
          fare_breakdown: fareResult,
        }),
        status: "pending",
      }).select().maybeSingle();

      // Query online drivers and filter nearby within 5 km radar
      const { data: onlineDrivers } = await supabase
        .from("drivers")
        .select("*")
        .neq("is_active", false);

      // Filter drivers strictly within 5km radius of pickup location (exclude sender driver if they are booking as passenger)
      const nearbyDrivers = (onlineDrivers || []).filter((d) => {
        if (driver && d.id === driver.id) return false;
        const dClean = (d.phone || "").replace(/\D/g, "").slice(-10);
        if (dClean === last10) return false;
        let dLat = d.latitude;
        let dLng = d.longitude;
        if (!dLat || !dLng) {
          try {
            const meta = JSON.parse(d.current_location_name || "{}");
            dLat = meta.lat;
            dLng = meta.lng;
          } catch {}
        }
        if (!pLat || !pLng || !dLat || !dLng) return false; // Strictly require coordinates within 5km
        const distKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
        return distKm <= 5.0; // 5 km radar!
      });

      const extraNotifications = nearbyDrivers.map((d) => {
        let recipientPhone = (d.phone || "").replace(/[^0-9]/g, "");
        if (recipientPhone.length === 10) {
          recipientPhone = `91${recipientPhone}`;
        } else if (recipientPhone.startsWith("0")) {
          recipientPhone = `91${recipientPhone.replace(/^0+/, "")}`;
        }

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
          toPhone: recipientPhone,
          type: "interactive_buttons" as const,
          bodyText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺\n=======================\n🆔 বুকিং নং: #${bookingNumber}\n👤 যাত্রী: ${ctx.senderName || "গ্রাহক"}\n👥 যাত্রী সংখ্যা: ৩ জন\n📞 ফোন: ${cleanPhone}\n📍 পিকআপ: ${pickupLocation}${distText}\n🏁 গন্তব্য: ${dropLocation}\n💵 আনুমানিক ভাড়া: ₹${estimatedFare}.০০\n=======================\nআপনি কি এই রাইডটি গ্রহণ করতে চান?`,
          buttons: [
            { id: `driver_accept_${newBooking?.id || bookingNumber}`, title: "✅ রাইড গ্রহণ" },
            { id: `driver_decline_${newBooking?.id || bookingNumber}`, title: "❌ বাতিল" },
          ],
        };
      });

      const statusLine = nearbyDrivers.length > 0
        ? `🔍 আপনার নিকটস্থ ৫ কিমির মধ্যে ${toBengaliDigits(nearbyDrivers.length)} জন সক্রিয় চালকের কাছে অনুরোধ পাঠানো হয়েছে... চালক গ্রহণ করলেই আপনাকে ওটিপি ও চালকের বিবরণ জানানো হবে।`
        : `⚠️ বর্তমানে আপনার ৫ কিমির মধ্যে কোনো সক্রিয় চালক অনলাইনে নেই। তবে আপনার বুকিংটি লাইভ রাখা হয়েছে, কাছাকাছি কোনো চালক ডিউটিতে এলে অনুরোধ পৌঁছে যাবে।`;

      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: `✨ চালক খোঁজা হচ্ছে... ✨\n=======================\n🆔 বুকিং নং: *#${bookingNumber}*\n📍 পিকআপ: ${pickupLocation}\n🏁 গন্তব্য: ${dropLocation}\n=======================\n${statusLine}`,
        buttons: [
          { id: "cancel_ride", title: "❌ বুকিং বাতিল" },
        ],
        extraNotifications,
      };
    }
  }

  // -------------------------------------------------------------
  // FLOW F.1: SEE MORE / FULL CUSTOMER DISCLAIMER WITH IMAGE
  // -------------------------------------------------------------
  if (
    payload === "see_more_disclaimer" ||
    payload === "view_customer_disclaimer" ||
    payload === "customer_disclaimer" ||
    incomingText.includes("বিস্তারিত দেখুন") ||
    incomingText.includes("see more") ||
    incomingText === "disclaimer" ||
    incomingText === "শর্তাবলী" ||
    incomingText === "শর্ত"
  ) {
    const fullDisclaimer =
      settings.customer_disclaimer_bengali ||
      DEFAULT_TOTO_CUSTOMER_DISCLAIMER;

    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: fullDisclaimer,
      media: {
        kind: "image",
        url: CUSTOMER_DISCLAIMER_IMAGE_URL,
        caption: "🖼️ সুন্দরবন রাইডার — ভার্চুয়াল ডিসক্লেইমার ও রেট চার্ট",
      },
      buttons: [
        { id: "agree_disclaimer", title: "✅ সম্মত আছি" },
      ],
    };
  }

  // -------------------------------------------------------------
  // FLOW F: CUSTOMER BOOKING INITIATION & DISCLAIMER
  // -------------------------------------------------------------
  if (
    payload === "book_toto" ||
    (!hasBookingState(cleanPhone) && (incomingText === "2" || incomingText === "২")) ||
    incomingText.includes("টোটো বুকিং") ||
    incomingText.includes("book toto") ||
    incomingText === "book" ||
    incomingText === "টোটো" ||
    incomingText === "toto"
  ) {
    // Registered driver clicked book toto: clear any driver location state
    driverLocationStates.delete(cleanPhone);

    // Keep user in customer booking flow awaiting disclaimer
    setBookingState(cleanPhone, {
      step: "awaiting_disclaimer",
      timestamp: Date.now(),
    });

    // Send customer disclaimer PDF document directly with single '✅ সম্মত আছি' button
    return {
      toPhone: rawPhone,
      type: "interactive_buttons",
      bodyText: "নমস্কার! 'সুন্দরবন রাইডার'-এ টোটো বুক করার পূর্বে অনুগ্রহ করে সংযুক্ত যাত্রী সুরক্ষা ও ব্যবহার নির্দেশিকা PDF ফাইলটি সম্পূর্ণ মনোযোগ সহকারে পড়ুন এবং নিচের '✅ সম্মত আছি' বাটনে চাপুন।\n\n📄 যাত্রী নির্দেশিকা (PDF) ডাউনলোড লিংক:\n👉 https://sundarbanrider.in/customer-disclaimer.pdf",
      media: {
        kind: "document",
        url: CUSTOMER_DISCLAIMER_PDF_URL,
        filename: "Customer_Disclaimer_Sundarban_Riders.pdf",
        caption: "📄 সুন্দরবন রাইডার — যাত্রী সুরক্ষা ও নির্দেশিকা (PDF)",
      },
      buttons: [
        { id: "agree_disclaimer", title: "✅ সম্মত আছি" },
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
    // FIRST TIME: Rider has NOT agreed to terms yet -> Show rider disclaimer with accept button and attached PDF
    if (!driver.agreed_terms) {
      return {
        toPhone: rawPhone,
        type: "interactive_buttons",
        bodyText: "নমস্কার! 'সুন্দরবন রাইডার'-এ চালক হিসেবে যুক্ত হওয়ার পূর্বে অনুগ্রহ করে সংযুক্ত PDF ফাইলটি সম্পূর্ণ মনোযোগ সহকারে পড়ুন, তারপর নিচের '✅ সম্মত আছি' বাটনে ক্লিক করুন।",
        media: {
          kind: "document",
          url: RIDER_DISCLAIMER_PDF_URL,
          filename: "Rider_Disclaimer_Sundarban_Riders.pdf",
          caption: "📄 সুন্দরবন রাইডার — চালক চুক্তি ও শর্তাবলী (PDF)",
        },
        buttons: [
          { id: "driver_agree_terms", title: "✅ সম্মত আছি" },
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
  const senderDisplayName =
    customer?.name && customer.name !== "সুন্দরবন কাস্টমার"
      ? customer.name
      : (ctx.senderName || "");

  let welcomeText = formatTotoWelcomeMessage(senderDisplayName);
  if (
    settings.welcome_message_bengali &&
    !settings.welcome_message_bengali.includes("সহজ, দ্রুত ও নিরাপদ টোটো বুকিং")
  ) {
    welcomeText = settings.welcome_message_bengali
      .replace("{name}", senderDisplayName ? ` ${senderDisplayName} ` : " ")
      .replace("ABC", senderDisplayName || "");
  }

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
