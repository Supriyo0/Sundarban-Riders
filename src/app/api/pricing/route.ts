import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import {
  DEFAULT_TOTO_PRICING,
  DEFAULT_TOTO_SLABS,
  TotoPricingConfig,
  TotoSlabConfig,
} from "@/lib/pricing/fare-calculator";

const PRICING_CONFIG_KEY = "toto_pricing_config";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", PRICING_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      console.warn("[pricing GET] Database fetch warning:", error);
    }

    if (data?.value) {
      try {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        const config: TotoPricingConfig = {
          ...DEFAULT_TOTO_PRICING,
          ...parsed,
          slabs:
            parsed.slabs && Array.isArray(parsed.slabs) && parsed.slabs.length > 0
              ? parsed.slabs
              : DEFAULT_TOTO_SLABS,
        };
        return NextResponse.json({ config });
      } catch {}
    }

    // Also check individual keys in system_settings as fallback
    const { data: allSettings } = await admin.from("system_settings").select("*");
    const merged: TotoPricingConfig = {
      ...DEFAULT_TOTO_PRICING,
      slabs: [...DEFAULT_TOTO_SLABS],
    };

    if (allSettings && allSettings.length > 0) {
      allSettings.forEach((row: any) => {
        if (row.key === "per_km_rate" || row.key === "rate_per_km_0_10")
          merged.perKmRate = parseFloat(row.value) || merged.perKmRate;
        if (row.key === "min_billable_km")
          merged.minBillableKm = parseFloat(row.value) || merged.minBillableKm;
        if (row.key === "extra_passenger_rate_per_km")
          merged.extraPassengerRatePerKm = parseFloat(row.value) || merged.extraPassengerRatePerKm;
        if (row.key === "night_charge_tier_1" || row.key === "night_charge_0_10")
          merged.nightChargeTier1 = parseFloat(row.value) || merged.nightChargeTier1;
        if (row.key === "night_charge_tier_2" || row.key === "night_charge_10_20")
          merged.nightChargeTier2 = parseFloat(row.value) || merged.nightChargeTier2;
        if (row.key === "night_charge_tier_3" || row.key === "night_charge_20_25")
          merged.nightChargeTier3 = parseFloat(row.value) || merged.nightChargeTier3;
        if (row.key === "night_start_time") merged.nightStartTime = row.value || merged.nightStartTime;
        if (row.key === "night_end_time") merged.nightEndTime = row.value || merged.nightEndTime;
      });
    }

    return NextResponse.json({ config: merged });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load pricing";
    return NextResponse.json({ error: message, config: DEFAULT_TOTO_PRICING }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const incomingSlabs: TotoSlabConfig[] =
      body.slabs && Array.isArray(body.slabs) && body.slabs.length > 0
        ? body.slabs.map((s: any, idx: number) => ({
            slabNumber: Number(s.slabNumber ?? idx + 1),
            name: String(s.name || `স্ল্যাব ${idx + 1}`),
            minKm: Number(s.minKm ?? 0),
            maxKm: Number(s.maxKm ?? 999),
            bookingCharge: Number(s.bookingCharge ?? 10),
            nightChargeTier: (Number(s.nightChargeTier) || (idx < 4 ? 1 : idx < 7 ? 2 : 3)) as 1 | 2 | 3,
          }))
        : DEFAULT_TOTO_SLABS;

    const config: TotoPricingConfig = {
      perKmRate: Number(body.perKmRate ?? DEFAULT_TOTO_PRICING.perKmRate),
      minBillableKm: Number(body.minBillableKm ?? DEFAULT_TOTO_PRICING.minBillableKm),
      includedPassengers: Number(body.includedPassengers ?? DEFAULT_TOTO_PRICING.includedPassengers),
      extraPassengerRatePerKm: Number(body.extraPassengerRatePerKm ?? DEFAULT_TOTO_PRICING.extraPassengerRatePerKm),
      nightStartTime: String(body.nightStartTime || DEFAULT_TOTO_PRICING.nightStartTime),
      nightEndTime: String(body.nightEndTime || DEFAULT_TOTO_PRICING.nightEndTime),
      nightChargeTier1: Number(body.nightChargeTier1 ?? DEFAULT_TOTO_PRICING.nightChargeTier1),
      nightChargeTier2: Number(body.nightChargeTier2 ?? DEFAULT_TOTO_PRICING.nightChargeTier2),
      nightChargeTier3: Number(body.nightChargeTier3 ?? DEFAULT_TOTO_PRICING.nightChargeTier3),
      slabs: incomingSlabs,

      // Backward compatibility fields
      baseFare: Number(incomingSlabs[0]?.bookingCharge ?? 10),
      ratePerKm0to10: Number(body.perKmRate ?? DEFAULT_TOTO_PRICING.perKmRate),
      ratePerKm10to20: Number(body.perKmRate ?? DEFAULT_TOTO_PRICING.perKmRate),
      ratePerKm20to25: Number(body.perKmRate ?? DEFAULT_TOTO_PRICING.perKmRate),
      maxServiceKm: Number(body.maxServiceKm ?? DEFAULT_TOTO_PRICING.maxServiceKm),
      defaultPassengerCount: Number(body.defaultPassengerCount ?? DEFAULT_TOTO_PRICING.defaultPassengerCount),
      minPassengers: Number(body.minPassengers ?? DEFAULT_TOTO_PRICING.minPassengers),
      maxPassengers: Number(body.maxPassengers ?? DEFAULT_TOTO_PRICING.maxPassengers),
      nightCharge0to10: Number(body.nightChargeTier1 ?? DEFAULT_TOTO_PRICING.nightChargeTier1),
      nightCharge10to20: Number(body.nightChargeTier2 ?? DEFAULT_TOTO_PRICING.nightChargeTier2),
      nightCharge20to25: Number(body.nightChargeTier3 ?? DEFAULT_TOTO_PRICING.nightChargeTier3),
    };

    const admin = supabaseAdmin();

    // 1. Save unified JSON config
    await admin.from("system_settings").upsert(
      {
        key: PRICING_CONFIG_KEY,
        value: JSON.stringify(config),
        description: "সুন্দরবন রাইডার্সের সম্পূর্ণ ১০-স্ল্যাব রেট চার্ট ও নাইট টাইমিং কনফিগারেশন",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // 2. Also mirror into individual keys for legacy compatibility
    const items = [
      { key: "base_fare", value: String(config.baseFare), description: "বেস ভাড়া (টাকা)" },
      { key: "per_km_rate", value: String(config.perKmRate), description: "প্রতি কিমি ভাড়া (টাকা/কিমি)" },
      { key: "rate_per_km_0_10", value: String(config.perKmRate), description: "০-১০ কিমি রেট (টাকা/কিমি)" },
      { key: "extra_passenger_rate_per_km", value: String(config.extraPassengerRatePerKm), description: "অতিরিক্ত যাত্রী রেট প্রতি কিমি" },
      { key: "night_charge_tier_1", value: String(config.nightChargeTier1), description: "নাইট চার্জ ০-১৩ কিমি" },
      { key: "night_charge_tier_2", value: String(config.nightChargeTier2), description: "নাইট চার্জ ১৪-২০ কিমি" },
      { key: "night_charge_tier_3", value: String(config.nightChargeTier3), description: "নাইট চার্জ ২১+ কিমি" },
      { key: "night_start_time", value: config.nightStartTime, description: "রাতের চার্জ শুরু সময়" },
      { key: "night_end_time", value: config.nightEndTime, description: "রাতের চার্জ শেষ সময়" },
    ];

    for (const item of items) {
      await admin.from("system_settings").upsert(
        { ...item, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    return NextResponse.json({
      success: true,
      message: "১০-স্ল্যাব রেট চার্ট ও নাইট টাইমিং সফলভাবে সংরক্ষিত হয়েছে!",
      config,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save pricing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
