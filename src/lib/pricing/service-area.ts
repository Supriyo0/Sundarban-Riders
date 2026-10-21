/**
 * Sundarban Riders Official Service Area Definition
 * Currently strictly operates in the South Section of South 24 Parganas:
 * From Diamond Harbour and Lakshmikantapur down to Kakdwip, Namkhana, Sagar Island (Gangasagar),
 * Bakkhali, Fraserganj, Kulpi, and Patharpratima.
 */

export interface ServiceAreaBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Geographic bounding box strictly covering South 24 Parganas Toto Corridor:
// Diamond Harbour, Lakshmikantapur, Kulpi down to Kakdwip, Namkhana, Sagar Island, Bakkhali, Fraserganj & Patharpratima
// (Strictly excludes Sealdah, Howrah, Kolkata, and outside territories)
export const SUNDARBAN_SERVICE_BOUNDS: ServiceAreaBounds = {
  minLat: 21.45, // Bay of Bengal / Bakkhali & Sagar Island Coast
  maxLat: 22.25, // Diamond Harbour, Lakshmikantapur & Kulpi (Strictly excludes Sealdah, Howrah, Kolkata)
  minLng: 88.00, // Hooghly River / Western Sagar Island
  maxLng: 88.60, // Patharpratima & Raidighi Eastern Corridor
};

export const DEFAULT_CENTRAL_HUB = {
  name: "Kakdwip Central Station Hub",
  full_address: "Kakdwip Station Road, Kakdwip, South 24 Parganas, West Bengal 743347",
  coords: [21.876, 88.192] as [number, number],
  lat: 21.876,
  lng: 88.192,
};

export const SERVICE_COVERED_ZONES = [
  "Diamond Harbour (ডায়মন্ড হারবার)",
  "Lakshmikantapur (লক্ষ্মীকান্তপুর)",
  "Kulpi & Nischindapur (কুলপী ও নিশ্চিন্দাপুর)",
  "Kakdwip & Lot 8 (কাকদ্বীপ ও লট ৮ ঘাট)",
  "Namkhana & Hatania Doania (নামখানা)",
  "Sagar Island & Gangasagar (সাগরদ্বীপ ও গঙ্গাসাগর)",
  "Bakkhali & Fraserganj (বকখালি ও ফ্রেজারগঞ্জ)",
  "Patharpratima & Ramganga (পাথরপ্রতিমা ও রামগঙ্গা)",
  "Mousuni Island (মৌসুনি দ্বীপ)",
];

export const SERVICE_UNAVAILABLE_MESSAGE =
  "⚠️ Sundarban Riders operates strictly in South 24 Parganas (Diamond Harbour, Lakshmikantapur, Kulpi, Kakdwip, Namkhana, Sagar Island, Bakkhali, Patharpratima).";

export interface RiverCrossingInfo {
  requiresFerry: boolean;
  barrierName: string;
  notice: string;
  noticeBn: string;
  ferryPoints?: {
    originGhat: { name: string; lat: number; lng: number };
    destGhat: { name: string; lat: number; lng: number };
  };
}

/**
 * Detects if a route crosses unbridged water bodies (like Muriganga River to Sagar Island)
 * where Totos cannot directly drive and passenger must take a vessel/ferry.
 */
export function checkRiverBarrierCrossings(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): RiverCrossingInfo | null {
  // Sagar Island Bounding Box: 21.55 <= lat <= 21.88, 88.01 <= lng <= 88.158
  const isFromSagar = fromLat >= 21.55 && fromLat <= 21.88 && fromLng >= 88.01 && fromLng <= 88.158;
  const isToSagar = toLat >= 21.55 && toLat <= 21.88 && toLng >= 88.01 && toLng <= 88.158;

  if (isFromSagar !== isToSagar) {
    const mainlandToSagar = !isFromSagar && isToSagar;
    return {
      requiresFerry: true,
      barrierName: "Muriganga River (মুড়িগঙ্গা নদী)",
      notice: mainlandToSagar
        ? "⛴️ Ferry Required: Direct road across Muriganga River is not possible. Toto drops at Lot 8 Ghat. Board vessel/ferry to Kachuberia Ghat (Sagar Island)."
        : "⛴️ Ferry Required: Direct road across Muriganga River is not possible. Toto drops at Kachuberia Ghat. Board vessel/ferry to Lot 8 Ghat (Kakdwip).",
      noticeBn: mainlandToSagar
        ? "⛴️ ফেরি পারাপার প্রয়োজন: মুড়িগঙ্গা নদীতে সরাসরি টোটো যাওয়ার রাস্তা নেই। টোটো লট ৮ ঘাটে নামিয়ে দেবে। সেখান থেকে কচুবেড়িয়া ভেসেল/ফেরি নিতে হবে।"
        : "⛴️ ফেরি পারাপার প্রয়োজন: মুড়িগঙ্গা নদীতে সরাসরি টোটো যাওয়ার রাস্তা নেই। টোটো কচুবেড়িয়া ঘাটে নামিয়ে দেবে। সেখান থেকে লট ৮ ভেসেল/ফেরি নিতে হবে।",
      ferryPoints: mainlandToSagar
        ? {
            originGhat: { name: "Lot 8 (Harwood Point) Ferry Ghat", lat: 21.8680, lng: 88.1630 },
            destGhat: { name: "Kachuberia Ferry Ghat (Sagar Island)", lat: 21.8650, lng: 88.1380 },
          }
        : {
            originGhat: { name: "Kachuberia Ferry Ghat (Sagar Island)", lat: 21.8650, lng: 88.1380 },
            destGhat: { name: "Lot 8 (Harwood Point) Ferry Ghat", lat: 21.8680, lng: 88.1630 },
          },
    };
  }

  // G-Plot / L-Plot Island crossing (Mridangabhanga River)
  const isFromGPlot = fromLat >= 21.58 && fromLat <= 21.68 && fromLng >= 88.34 && fromLng <= 88.42;
  const isToGPlot = toLat >= 21.58 && toLat <= 21.68 && toLng >= 88.34 && toLng <= 88.42;
  if (isFromGPlot !== isToGPlot) {
    return {
      requiresFerry: true,
      barrierName: "Mridangabhanga River (মৃদঙ্গভাঙ্গা নদী)",
      notice: "⛴️ Boat Stand Required: G-Plot Island requires crossing via Ramganga / Gobordhan boat ghat.",
      noticeBn: "⛴️ নৌকা ঘাট প্রয়োজন: জি-প্লট দ্বীপে যাওয়ার জন্য রামগঙ্গা বা গোবর্ধন খেয়া ঘাট ব্যবহার করতে হবে।",
      ferryPoints: {
        originGhat: { name: "Ramganga Ferry Ghat", lat: 21.7920, lng: 88.3620 },
        destGhat: { name: "G-Plot Gobordhan Ghat", lat: 21.6520, lng: 88.3750 },
      },
    };
  }

  return null;
}

/**
 * Returns true for all valid geographic locations to remove address locking.
 */
export function isLocationInServiceArea(lat: number, lng: number): boolean {
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return false;
  // Broad coordinate range covering Bengal and Eastern India
  return lat >= 15.0 && lat <= 32.0 && lng >= 75.0 && lng <= 98.0;
}
