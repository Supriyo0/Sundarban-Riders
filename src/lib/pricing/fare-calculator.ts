export interface TotoSlabConfig {
  slabNumber: number; // 1 to 4
  name: string; // e.g. "স্ল্যাব ১ (০-১০ কিমি)"
  minKm: number; // inclusive min km
  maxKm: number; // inclusive max km
  bookingCharge: number; // Booking charge in ₹ (0 in new unified chart)
  nightChargeTier: 1 | 2 | 3 | 4; // 1 = ₹50, 2 = ₹75, 3 = ₹100, 4 = ₹150
}

export interface TotoPricingConfig {
  minimumFare: number; // Minimum fare ₹42 (0-3 km)
  minBillableKm: number; // 3 km
  rateTier1: number; // ₹14/km (0-10 km)
  rateTier2: number; // ₹15/km (11-20 km)
  rateTier3: number; // ₹14.50/km (21-30 km)
  rateTier4Extra: number; // +₹10/km (31-40+ km)
  perKmRate: number; // Default rate
  includedPassengers: number; // 4 persons included at no extra cost
  extraPassengerRatePerKm: number; // ₹0/km (within 4 passenger limit)
  nightStartTime: string; // "20:30" (8:30 PM)
  nightEndTime: string; // "05:00" (5:00 AM)
  nightChargeTier1: number; // ₹50 (0-10 km)
  nightChargeTier2: number; // ₹75 (11-20 km)
  nightChargeTier3: number; // ₹100 (21-30 km)
  nightChargeTier4: number; // ₹150 (31+ km)
  slabs: TotoSlabConfig[];

  // Backward compatibility fields
  baseFare?: number;
  ratePerKm0to10?: number;
  ratePerKm10to20?: number;
  ratePerKm20to25?: number;
  maxServiceKm?: number;
  defaultPassengerCount?: number;
  minPassengers?: number;
  maxPassengers?: number;
  nightCharge0to10?: number;
  nightCharge10to20?: number;
  nightCharge20to25?: number;
}

/**
 * The official Sundarban Riders Final Rate Chart (4 Slabs)
 */
export const DEFAULT_TOTO_SLABS: TotoSlabConfig[] = [
  { slabNumber: 1, name: "স্ল্যাব ১ (০-১০ কিমি)", minKm: 0, maxKm: 10, bookingCharge: 0, nightChargeTier: 1 },
  { slabNumber: 2, name: "স্ল্যাব ২ (১১-২০ কিমি)", minKm: 10.01, maxKm: 20, bookingCharge: 0, nightChargeTier: 2 },
  { slabNumber: 3, name: "স্ল্যাব ৩ (২১-৩০ কিমি)", minKm: 20.01, maxKm: 30, bookingCharge: 0, nightChargeTier: 3 },
  { slabNumber: 4, name: "স্ল্যাব ৪ (৩১+ কিমি)", minKm: 30.01, maxKm: 999, bookingCharge: 0, nightChargeTier: 4 },
];

export const DEFAULT_TOTO_PRICING: TotoPricingConfig = {
  minimumFare: 42,
  minBillableKm: 3,
  rateTier1: 14,
  rateTier2: 15,
  rateTier3: 14.5,
  rateTier4Extra: 10,
  perKmRate: 14,
  includedPassengers: 4,
  extraPassengerRatePerKm: 0,
  nightStartTime: "20:30",
  nightEndTime: "05:00",
  nightChargeTier1: 50,
  nightChargeTier2: 75,
  nightChargeTier3: 100,
  nightChargeTier4: 150,
  slabs: DEFAULT_TOTO_SLABS,

  // Backward compatibility
  baseFare: 42,
  ratePerKm0to10: 14,
  ratePerKm10to20: 15,
  ratePerKm20to25: 14.5,
  maxServiceKm: 60,
  defaultPassengerCount: 4,
  minPassengers: 1,
  maxPassengers: 4,
  nightCharge0to10: 50,
  nightCharge10to20: 75,
  nightCharge20to25: 100,
};

/**
 * Checks whether a given Date is within the night timing window (using Indian Standard Time UTC+5:30)
 * Official Sundarban Riders Night Window: 8:30 PM (20:30) to 5:00 AM (05:00) IST
 */
export function isNightTime(
  date: Date = new Date(),
  nightStartTime: string = "20:30",
  nightEndTime: string = "05:00"
): boolean {
  try {
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

    // If night spans across midnight (e.g. 20:30 to 05:00)
    if (startMinutes > endMinutes) {
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    } else {
      return curMinutes >= startMinutes && curMinutes < endMinutes;
    }
  } catch (err) {
    const h = date.getHours();
    const m = date.getMinutes();
    const mins = h * 60 + m;
    return mins >= 20 * 60 + 30 || mins < 5 * 60;
  }
}

/**
 * Retrieves the matching slab for a given distance
 */
export function getSlabForDistance(distanceKm: number, slabs: TotoSlabConfig[] = DEFAULT_TOTO_SLABS): TotoSlabConfig {
  const d = Math.max(0.1, distanceKm);
  const sorted = [...(slabs && slabs.length > 0 ? slabs : DEFAULT_TOTO_SLABS)].sort((a, b) => a.minKm - b.minKm);
  for (const slab of sorted) {
    if (d <= slab.maxKm) {
      return slab;
    }
  }
  return sorted[sorted.length - 1];
}

export interface FareCalculationResult {
  totalFare: number;
  baseFare: number; // Base ride fare
  bookingCharge: number; // 0
  slabNumber: number;
  slabName: string;
  distanceKm: number;
  distanceFare: number;
  perKmRate: number;
  passengerCount: number;
  extraPassengerCount: number;
  extraPassengerFare: number;
  isNight: boolean;
  nightCharge: number;
  breakdownBengali: string;
}

/**
 * Official Sundarban Riders Final Rate Chart Calculator:
 *
 * 1. Slab 1 (0 to 10 km):
 *    - 0 to 3 km: Minimum fare ₹42 (Flat)
 *    - 4 to 10 km: ₹14 / km (e.g. 4km=₹56, 5km=₹70 ... 10km=₹140)
 *    - Night Charge (after 8:30 PM): +₹50
 *
 * 2. Slab 2 (11 to 20 km):
 *    - Rate: ₹15 / km (e.g. 11km=₹165, 15km=₹225 ... 20km=₹300)
 *    - Night Charge (after 8:30 PM): +₹75
 *
 * 3. Slab 3 (21 to 30 km):
 *    - Rate: ₹14.50 / km (e.g. 21km=₹304.5, 25km=₹362.5 ... 30km=₹435)
 *    - Night Charge (after 8:30 PM): +₹100
 *
 * 4. Slab 4 (31 to 40+ km):
 *    - Base at 30 km is ₹435. Each additional km adds ₹10/km:
 *      31km=₹445, 32km=₹455, 35km=₹485, 40km=₹535, 45km=₹585
 *    - Night Charge (after 8:30 PM): +₹150
 *
 * 5. Passenger Capacity: Standard fare includes up to 4 passengers.
 */
export function calculateTotoFare(
  distanceKm: number,
  passengerCount: number = 4,
  config: TotoPricingConfig = DEFAULT_TOTO_PRICING,
  rideTime: Date = new Date()
): FareCalculationResult {
  const effectiveConfig: TotoPricingConfig = {
    ...DEFAULT_TOTO_PRICING,
    ...(config || {}),
    slabs: config?.slabs && config.slabs.length > 0 ? config.slabs : DEFAULT_TOTO_SLABS,
  };

  const d = Math.max(0.1, Math.round(distanceKm * 100) / 100);
  const maxPaxLimit = effectiveConfig.maxPassengers ?? 4;
  const p = Math.max(1, Math.min(maxPaxLimit, Math.round(passengerCount || 4)));

  let baseDistanceFare = 0;
  let activeRatePerKm = 14;
  let slabNumber = 1;
  let slabName = "স্ল্যাব ১ (০-১০ কিমি)";

  // 1. Calculate Day Fare based on Tiers
  if (d <= 3.0) {
    baseDistanceFare = effectiveConfig.minimumFare ?? 42;
    activeRatePerKm = 14;
    slabNumber = 1;
    slabName = "স্ল্যাব ১ (০-৩ কিমি মিনিমাম)";
  } else if (d <= 10.0) {
    baseDistanceFare = Math.round(d * 14);
    activeRatePerKm = 14;
    slabNumber = 1;
    slabName = "স্ল্যাব ১ (৪-১০ কিমি)";
  } else if (d <= 20.0) {
    baseDistanceFare = Math.round(d * 15);
    activeRatePerKm = 15;
    slabNumber = 2;
    slabName = "স্ল্যাব ২ (১১-২০ কিমি)";
  } else if (d <= 30.0) {
    baseDistanceFare = Math.round(d * 14.5);
    activeRatePerKm = 14.5;
    slabNumber = 3;
    slabName = "স্ল্যাব ৩ (২১-৩০ কিমি)";
  } else {
    // 31 to 40+ km: ₹435 base + ₹10 per km beyond 30 km
    baseDistanceFare = Math.round(435 + (d - 30.0) * 10);
    activeRatePerKm = 10;
    slabNumber = 4;
    slabName = "স্ল্যাব ৪ (৩১+ কিমি)";
  }

  // 2. Extra Passenger Charge (Up to 4 passengers included at no extra cost)
  const includedPax = effectiveConfig.includedPassengers ?? 4;
  const extraPassengerCount = Math.max(0, p - includedPax);
  const extraPassengerFare = 0;

  // 3. Night Charge (8:30 PM to 5:00 AM)
  const nightStart = effectiveConfig.nightStartTime || "20:30";
  const nightEnd = effectiveConfig.nightEndTime || "05:00";
  const isNight = isNightTime(rideTime, nightStart, nightEnd);
  let nightCharge = 0;

  if (isNight) {
    if (d <= 10.0) {
      nightCharge = Number(effectiveConfig.nightChargeTier1 ?? 50);
    } else if (d <= 20.0) {
      nightCharge = Number(effectiveConfig.nightChargeTier2 ?? 75);
    } else if (d <= 30.0) {
      nightCharge = Number(effectiveConfig.nightChargeTier3 ?? 100);
    } else {
      nightCharge = Number(effectiveConfig.nightChargeTier4 ?? 150);
    }
  }

  // 4. Total Fare
  const totalFare = baseDistanceFare + extraPassengerFare + nightCharge;

  // 5. Bengali Breakdown
  const parts: string[] = [
    d <= 3.0
      ? `মিনিমাম বেস ভাড়া (০-৩ কিমি): ₹৪২`
      : d > 30.0
      ? `৩০ কিমি বেস (₹৪৩৫) + অতিরিক্ত (${(d - 30).toFixed(1)} কিমি x ₹১০): ₹${baseDistanceFare}`
      : `রাইড চার্জ (${d} কিমি x ₹${activeRatePerKm}): ₹${baseDistanceFare}`,
  ];
  if (isNight) {
    parts.push(`নাইট চার্জ (রাত ৮:৩০ পর): ₹${nightCharge}`);
  }

  return {
    totalFare,
    baseFare: baseDistanceFare,
    bookingCharge: 0,
    slabNumber,
    slabName,
    distanceKm: d,
    distanceFare: baseDistanceFare,
    perKmRate: activeRatePerKm,
    passengerCount: p,
    extraPassengerCount,
    extraPassengerFare,
    isNight,
    nightCharge,
    breakdownBengali: parts.join(" + ") + ` = ₹${totalFare}`,
  };
}

let cachedPricingConfig: { config: TotoPricingConfig; timestamp: number } | null = null;
const PRICING_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function invalidatePricingCache() {
  cachedPricingConfig = null;
}

/**
 * Loads dynamic pricing configuration from Supabase system_settings with fallback to DEFAULT_TOTO_PRICING
 */
export async function loadActivePricingConfig(
  supabaseClient?: any
): Promise<TotoPricingConfig> {
  if (cachedPricingConfig && Date.now() - cachedPricingConfig.timestamp < PRICING_CACHE_TTL) {
    return cachedPricingConfig.config;
  }
  try {
    if (!supabaseClient) return DEFAULT_TOTO_PRICING;
    const { data } = await supabaseClient
      .from("system_settings")
      .select("key, value")
      .eq("key", "toto_pricing_config")
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const config: TotoPricingConfig = {
        ...DEFAULT_TOTO_PRICING,
        ...parsed,
        slabs: parsed.slabs && Array.isArray(parsed.slabs) && parsed.slabs.length > 0
          ? parsed.slabs
          : DEFAULT_TOTO_SLABS,
      };
      cachedPricingConfig = { config, timestamp: Date.now() };
      return config;
    }
  } catch (err) {
    console.warn("[pricing] Failed to load config from system_settings:", err);
  }
  return DEFAULT_TOTO_PRICING;
}

