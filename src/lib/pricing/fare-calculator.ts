export interface TotoSlabConfig {
  slabNumber: number; // 1 to 10
  name: string; // e.g. "স্ল্যাব ১ (০-১০ কিমি)"
  minKm: number; // inclusive min km
  maxKm: number; // inclusive max km
  bookingCharge: number; // Booking charge in ₹
  nightChargeTier: 1 | 2 | 3; // 1 = ₹50, 2 = ₹75, 3 = ₹100
}

export interface TotoPricingConfig {
  perKmRate: number; // Flat ride charge rate: ₹12/km
  minBillableKm: number; // Minimum billable distance: 2 km (2 x ₹12 = ₹24)
  includedPassengers: number; // 3 persons included
  extraPassengerRatePerKm: number; // ₹2/km per extra person (3+)
  nightStartTime: string; // "21:30" (9:30 PM)
  nightEndTime: string; // "05:00" (5:00 AM)
  nightChargeTier1: number; // ₹50 (0-13 km, slabs 1-4)
  nightChargeTier2: number; // ₹75 (14-20 km, slabs 5-7)
  nightChargeTier3: number; // ₹100 (21+ km, slabs 8-10)
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
 * The official Sundarban Rider Rate Chart (10 Slabs)
 */
export const DEFAULT_TOTO_SLABS: TotoSlabConfig[] = [
  { slabNumber: 1, name: "স্ল্যাব ১ (০-১০ কিমি)", minKm: 0, maxKm: 10, bookingCharge: 10, nightChargeTier: 1 },
  { slabNumber: 2, name: "স্ল্যাব ২ (১১ কিমি)", minKm: 10.01, maxKm: 11, bookingCharge: 20, nightChargeTier: 1 },
  { slabNumber: 3, name: "স্ল্যাব ৩ (১২ কিমি)", minKm: 11.01, maxKm: 12, bookingCharge: 30, nightChargeTier: 1 },
  { slabNumber: 4, name: "স্ল্যাব ৪ (১৩ কিমি)", minKm: 12.01, maxKm: 13, bookingCharge: 40, nightChargeTier: 1 },
  { slabNumber: 5, name: "স্ল্যাব ৫ (১৪-১৬ কিমি)", minKm: 13.01, maxKm: 16, bookingCharge: 60, nightChargeTier: 2 },
  { slabNumber: 6, name: "স্ল্যাব ৬ (১৭-১৮ কিমি)", minKm: 16.01, maxKm: 18, bookingCharge: 55, nightChargeTier: 2 },
  { slabNumber: 7, name: "স্ল্যাব ৭ (১৯-২০ কিমি)", minKm: 18.01, maxKm: 20, bookingCharge: 50, nightChargeTier: 2 },
  { slabNumber: 8, name: "স্ল্যাব ৮ (২১-২৫ কিমি)", minKm: 20.01, maxKm: 25, bookingCharge: 45, nightChargeTier: 3 },
  { slabNumber: 9, name: "স্ল্যাব ৯ (২৬-৩০ কিমি)", minKm: 25.01, maxKm: 30, bookingCharge: 40, nightChargeTier: 3 },
  { slabNumber: 10, name: "স্ল্যাব ১০ (৩১+ কিমি)", minKm: 30.01, maxKm: 999, bookingCharge: 40, nightChargeTier: 3 },
];

export const DEFAULT_TOTO_PRICING: TotoPricingConfig = {
  perKmRate: 12,
  minBillableKm: 2,
  includedPassengers: 3,
  extraPassengerRatePerKm: 2,
  nightStartTime: "21:30",
  nightEndTime: "05:00",
  nightChargeTier1: 50,
  nightChargeTier2: 75,
  nightChargeTier3: 100,
  slabs: DEFAULT_TOTO_SLABS,

  // Backward compatibility
  baseFare: 10,
  ratePerKm0to10: 12,
  ratePerKm10to20: 12,
  ratePerKm20to25: 12,
  maxServiceKm: 50,
  defaultPassengerCount: 3,
  minPassengers: 3,
  maxPassengers: 6,
  nightCharge0to10: 50,
  nightCharge10to20: 75,
  nightCharge20to25: 100,
};

/**
 * Checks whether a given Date is within the night timing window (using Indian Standard Time UTC+5:30)
 */
export function isNightTime(
  date: Date = new Date(),
  nightStartTime: string = "21:30",
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

    // If night spans across midnight (e.g. 21:30 to 05:00)
    if (startMinutes > endMinutes) {
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    } else {
      return curMinutes >= startMinutes && curMinutes < endMinutes;
    }
  } catch (err) {
    const h = date.getHours();
    const m = date.getMinutes();
    const mins = h * 60 + m;
    return mins >= 21 * 60 + 30 || mins < 5 * 60;
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
  baseFare: number; // Booking charge of matched slab
  bookingCharge: number; // Exact booking charge
  slabNumber: number;
  slabName: string;
  distanceKm: number;
  distanceFare: number; // Ride charge (KM x ₹12)
  perKmRate: number;
  passengerCount: number;
  extraPassengerCount: number;
  extraPassengerFare: number;
  isNight: boolean;
  nightCharge: number;
  breakdownBengali: string;
}

/**
 * Accurately calculates Toto ride fare according to the Official Sundarban Rider Rate Chart:
 * 1. Booking Charge: Determined strictly by distance slab (Slabs 1 to 10)
 * 2. Ride Charge: Flat ₹12/km (0-2 km is charged minimum 2 km = ₹24)
 * 3. 3 Passengers Included: Standard rate applies for 1 to 3 passengers.
 * 4. Extra Passengers (3+): ₹2 per extra passenger per km (4 pax = +₹2/km, 5 pax = +₹4/km, 6 pax = +₹6/km)
 * 5. Night Charge (9:30 PM to 5:00 AM):
 *    - 0 to 13 km (Slabs 1-4): ₹50/-
 *    - 14 to 20 km (Slabs 5-7): ₹75/-
 *    - 21+ km (Slabs 8-10): ₹100/-
 */
export function calculateTotoFare(
  distanceKm: number,
  passengerCount: number = 3,
  config: TotoPricingConfig = DEFAULT_TOTO_PRICING,
  rideTime: Date = new Date()
): FareCalculationResult {
  const effectiveConfig: TotoPricingConfig = {
    ...DEFAULT_TOTO_PRICING,
    ...(config || {}),
    slabs: config?.slabs && config.slabs.length > 0 ? config.slabs : DEFAULT_TOTO_SLABS,
  };

  const d = Math.max(0.1, Math.round(distanceKm * 100) / 100);
  const p = Math.max(1, Math.min(10, Math.round(passengerCount || 3)));

  // 1. Matched Slab & Booking Charge
  const matchedSlab = getSlabForDistance(d, effectiveConfig.slabs);
  const bookingCharge = Number(matchedSlab.bookingCharge) || 0;

  // 2. Ride Charge: Flat rate per km with minimum billable km (default 2 km = ₹24)
  const perKmRate = effectiveConfig.perKmRate ?? 12;
  const minBillableKm = effectiveConfig.minBillableKm ?? 2;
  const billableKm = Math.max(minBillableKm, d);
  const distanceFare = Math.round(billableKm * perKmRate);

  // 3. Extra Passenger Charge: ₹2/km per passenger over included (default 3)
  const includedPax = effectiveConfig.includedPassengers ?? 3;
  const extraPassengerCount = Math.max(0, p - includedPax);
  const extraRatePerKm = effectiveConfig.extraPassengerRatePerKm ?? 2;
  const extraPassengerFare = Math.round(extraPassengerCount * extraRatePerKm * d);

  // 4. Night Charge (9:30 PM to 5:00 AM)
  const nightStart = effectiveConfig.nightStartTime || "21:30";
  const nightEnd = effectiveConfig.nightEndTime || "05:00";
  const isNight = isNightTime(rideTime, nightStart, nightEnd);
  let nightCharge = 0;

  if (isNight) {
    if (d <= 13) {
      nightCharge = Number(effectiveConfig.nightChargeTier1 ?? 50);
    } else if (d <= 20) {
      nightCharge = Number(effectiveConfig.nightChargeTier2 ?? 75);
    } else {
      nightCharge = Number(effectiveConfig.nightChargeTier3 ?? 100);
    }
  }

  // 5. Total Fare
  const totalFare = bookingCharge + distanceFare + extraPassengerFare + nightCharge;

  // Bengali Breakdown
  const parts: string[] = [
    `বুকিং চার্জ (${matchedSlab.name}): ₹${bookingCharge}`,
    `রাইড চার্জ (${d} কিমি x ₹${perKmRate}): ₹${distanceFare}`,
  ];
  if (extraPassengerCount > 0) {
    parts.push(`অতিরিক্ত যাত্রী (${extraPassengerCount} জন x ₹${extraRatePerKm}/কিমি): ₹${extraPassengerFare}`);
  }
  if (isNight) {
    parts.push(`নাইট চার্জ: ₹${nightCharge}`);
  }

  return {
    totalFare,
    baseFare: bookingCharge,
    bookingCharge,
    slabNumber: matchedSlab.slabNumber,
    slabName: matchedSlab.name,
    distanceKm: d,
    distanceFare,
    perKmRate,
    passengerCount: p,
    extraPassengerCount,
    extraPassengerFare,
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
      return {
        ...DEFAULT_TOTO_PRICING,
        ...parsed,
        slabs: parsed.slabs && Array.isArray(parsed.slabs) && parsed.slabs.length > 0
          ? parsed.slabs
          : DEFAULT_TOTO_SLABS,
      };
    }
  } catch (err) {
    console.warn("[pricing] Failed to load config from system_settings:", err);
  }
  return DEFAULT_TOTO_PRICING;
}
