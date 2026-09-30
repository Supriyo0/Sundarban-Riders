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

// Geographic bounding box covering Sundarban, South 24 Parganas, and Kolkata metropolitan test area
export const SUNDARBAN_SERVICE_BOUNDS: ServiceAreaBounds = {
  minLat: 21.30, // Bay of Bengal / Bakkhali / Sagar Coast
  maxLat: 23.20, // North to Kolkata, Baruipur, Sonarpur, Salt Lake & Greater Kolkata
  minLng: 87.70, // Western boundary (Hooghly / Howrah border)
  maxLng: 89.50, // Eastern boundary (Sundarban & border)
};

export const DEFAULT_CENTRAL_HUB = {
  name: "কাকদ্বীপ স্টেশন রোড (সেন্ট্রাল হাব)",
  full_address: "কাকদ্বীপ স্টেশন রোড, দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ ৭৪৩৩৪৭",
  coords: [21.876, 88.192] as [number, number],
  lat: 21.876,
  lng: 88.192,
};

export const SERVICE_COVERED_ZONES = [
  "ডায়মন্ড হারবার (Diamond Harbour)",
  "লক্ষ্মীকান্তপুর (Lakshmikantapur)",
  "কুলপী ও নিশ্চিন্দাপুর (Kulpi & Nischindapur)",
  "কাকদ্বীপ ও লট ৮ ঘাট (Kakdwip & Lot 8)",
  "নামখানা ও হাতানিয়া দোয়ানিয়া (Namkhana)",
  "সাগরদ্বীপ ও গঙ্গাসাগর (Sagar Island & Gangasagar)",
  "বকখালি ও ফ্রেজারগঞ্জ (Bakkhali & Fraserganj)",
  "মথুরাপুর ও মন্দিরবাজার (Mathurapur & Mandirbazar)",
  "পাথরপ্রতিমা ও রায়দিঘি (Patharpratima & Raidighi)",
];

export const SERVICE_UNAVAILABLE_MESSAGE =
  "⚠️ সুন্দরবন রাইডার্স পরিষেবা বর্তমানে কেবলমাত্র দক্ষিণ ২৪ পরগনার দক্ষিণ অংশে (ডায়মন্ড হারবার থেকে লক্ষ্মীকান্তপুর, কুলপি, কাকদ্বীপ, নামখানা, সাগরদ্বীপ ও বকখালি অঞ্চলে) উপলব্ধ। এই স্থানে এখনো পরিষেবা চালু হয়নি।";

/**
 * Returns true if the coordinates fall within the official South Section territory.
 */
export function isLocationInServiceArea(lat: number, lng: number): boolean {
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return false;
  return (
    lat >= SUNDARBAN_SERVICE_BOUNDS.minLat &&
    lat <= SUNDARBAN_SERVICE_BOUNDS.maxLat &&
    lng >= SUNDARBAN_SERVICE_BOUNDS.minLng &&
    lng <= SUNDARBAN_SERVICE_BOUNDS.maxLng
  );
}
