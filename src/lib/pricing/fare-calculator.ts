export interface TotoPricingConfig {
  baseFare: number; // e.g. 30
  ratePerKm0to10: number; // e.g. 5
  ratePerKm10to20: number; // e.g. 7
  ratePerKm20to25: number; // e.g. 6
  maxServiceKm: number; // e.g. 25
  defaultPassengerCount: number; // e.g. 3
  minPassengers: number; // e.g. 3
  maxPassengers: number; // e.g. 5
  includedPassengers: number; // e.g. 3
  extraPassengerRatePerKm: number; // e.g. 2
  nightCharge0to10: number; // e.g. 50
  nightCharge10to20: number; // e.g. 75
  nightCharge20to25: number; // e.g. 100
  nightStartTime: string; // e.g. "21:30" (9:30 PM)
  nightEndTime: string; // e.g. "06:00" (6:00 AM)
}

export const DEFAULT_TOTO_PRICING: TotoPricingConfig = {
  baseFare: 30,
  ratePerKm0to10: 5,
  ratePerKm10to20: 7,
  ratePerKm20to25: 6,
  maxServiceKm: 25,
  defaultPassengerCount: 3,
  minPassengers: 3,
  maxPassengers: 5,
  includedPassengers: 3,
  extraPassengerRatePerKm: 2,
  nightCharge0to10: 50,
  nightCharge10to20: 75,
  nightCharge20to25: 100,
  nightStartTime: "21:30",
  nightEndTime: "06:00",
};

/**
 * Checks whether a given Date is within the night timing window (using Indian Standard Time UTC+5:30)
 */
export function isNightTime(
  date: Date = new Date(),
  nightStartTime: string = "21:30",
  nightEndTime: string = "06:00"
): boolean {
  try {
    // Get hours and minutes in IST (Asia/Kolkata)
    const istString = date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    const [curHour, curMin] = istString.split(":").map(Number);
    const curMinutes = curHour * 60 + curMin;

    const [startHour, startMin] = nightStartTime.split(":").map(Number);
    const startMinutes = startHour * 60 + (startMin || 0);

    const [endHour, endMin] = nightEndTime.split(":").map(Number);
    const endMinutes = endHour * 60 + (endMin || 0);

    // If night spans across midnight (e.g. 21:30 to 06:00)
    if (startMinutes > endMinutes) {
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    } else {
      return curMinutes >= startMinutes && curMinutes < endMinutes;
    }
  } catch (err) {
    // Fallback: local time
    const h = date.getHours();
    const m = date.getMinutes();
    const mins = h * 60 + m;
    return mins >= 21 * 60 + 30 || mins < 6 * 60;
  }
}

export interface FareCalculationResult {
  totalFare: number;
  baseFare: number;
  distanceKm: number;
  distanceFare: number;
  passengerCount: number;
  extraPassengerCount: number;
  extraPassengerFare: number;
  isNight: boolean;
  nightCharge: number;
  breakdownBengali: string;
}

/**
 * Accurately calculates Toto ride fare according to official Sundarban Riders policy:
 * - Base fare ₹30 (applied up to 10 km, then slab rates)
 * - 0 - 10 km: ₹5 / km
 * - 10 - 20 km: ₹7 / km
 * - 20 - 25 km: ₹6 / km
 * - Passengers: min 3, max 5. Up to 3 passengers included with no extra cost.
 * - For each passenger above 3: extra ₹2 per passenger per km.
 * - Night Charge (after 9:30 PM): ₹50 extra up to 10 km, ₹75 extra for 10-20 km, ₹100 extra for 20-25 km.
 */
export function calculateTotoFare(
  distanceKm: number,
  passengerCount: number = 3,
  config: TotoPricingConfig = DEFAULT_TOTO_PRICING,
  rideTime: Date = new Date()
): FareCalculationResult {
  const d = Math.max(0.5, Math.round(distanceKm * 10) / 10);
  const p = Math.max(
    config.minPassengers || 3,
    Math.min(config.maxPassengers || 5, Math.round(passengerCount || 3))
  );

  // 1. Base Fare
  const baseFare = config.baseFare;

  // 2. Distance Fare by Slabs
  let distanceFare = 0;
  if (d <= 10) {
    distanceFare = d * config.ratePerKm0to10;
  } else if (d <= 20) {
    distanceFare = 10 * config.ratePerKm0to10 + (d - 10) * config.ratePerKm10to20;
  } else {
    distanceFare =
      10 * config.ratePerKm0to10 +
      10 * config.ratePerKm10to20 +
      (d - 20) * config.ratePerKm20to25;
  }

  // 3. Extra Passengers Charge
  const extraPassengerCount = Math.max(0, p - (config.includedPassengers || 3));
  const extraPassengerFare = extraPassengerCount * config.extraPassengerRatePerKm * d;

  // 4. Night Charge
  const isNight = isNightTime(rideTime, config.nightStartTime, config.nightEndTime);
  let nightCharge = 0;
  if (isNight) {
    if (d <= 10) {
      nightCharge = config.nightCharge0to10;
    } else if (d <= 20) {
      nightCharge = config.nightCharge10to20;
    } else {
      nightCharge = config.nightCharge20to25;
    }
  }

  // 5. Total Fare (rounded to integer)
  const rawTotal = baseFare + distanceFare + extraPassengerFare + nightCharge;
  const totalFare = Math.round(rawTotal);

  // Breakdown description in Bengali
  const parts: string[] = [`বেস ভাড়া: ₹${baseFare}`];
  parts.push(`দূরত্ব (${d} কিমি): ₹${Math.round(distanceFare)}`);
  if (extraPassengerCount > 0) {
    parts.push(
      `অতিরিক্ত যাত্রী (${extraPassengerCount} জন x ₹${config.extraPassengerRatePerKm}/কিমি): ₹${Math.round(extraPassengerFare)}`
    );
  }
  if (isNight) {
    parts.push(`নাইট চার্জ: ₹${nightCharge}`);
  }

  return {
    totalFare,
    baseFare,
    distanceKm: d,
    distanceFare: Math.round(distanceFare),
    passengerCount: p,
    extraPassengerCount,
    extraPassengerFare: Math.round(extraPassengerFare),
    isNight,
    nightCharge,
    breakdownBengali: parts.join(" + ") + ` = ₹${totalFare}`,
  };
}

/**
 * Loads dynamic pricing configuration from Supabase system_settings with fallback to DEFAULT_TOTO_PRICING
 */
export async function loadActivePricingConfig(
  supabaseClient?: any
): Promise<TotoPricingConfig> {
  try {
    if (!supabaseClient) return DEFAULT_TOTO_PRICING;
    const { data } = await supabaseClient
      .from("system_settings")
      .select("key, value")
      .eq("key", "toto_pricing_config")
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      return { ...DEFAULT_TOTO_PRICING, ...parsed };
    }
  } catch (err) {
    console.warn("[pricing] Failed to load config from system_settings:", err);
  }
  return DEFAULT_TOTO_PRICING;
}

