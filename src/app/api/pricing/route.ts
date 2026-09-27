import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { DEFAULT_TOTO_PRICING, TotoPricingConfig } from "@/lib/pricing/fare-calculator";

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
        const parsed = JSON.parse(data.value);
        return NextResponse.json({
          config: { ...DEFAULT_TOTO_PRICING, ...parsed },
        });
      } catch {}
    }

    // Also check individual keys in system_settings as fallback
    const { data: allSettings } = await admin.from("system_settings").select("*");
    const merged = { ...DEFAULT_TOTO_PRICING };

    if (allSettings && allSettings.length > 0) {
      allSettings.forEach((row: any) => {
        if (row.key === "base_fare") merged.baseFare = parseFloat(row.value) || merged.baseFare;
        if (row.key === "rate_per_km_0_10") merged.ratePerKm0to10 = parseFloat(row.value) || merged.ratePerKm0to10;
        if (row.key === "rate_per_km_10_20") merged.ratePerKm10to20 = parseFloat(row.value) || merged.ratePerKm10to20;
        if (row.key === "rate_per_km_20_25") merged.ratePerKm20to25 = parseFloat(row.value) || merged.ratePerKm20to25;
        if (row.key === "extra_passenger_rate_per_km") merged.extraPassengerRatePerKm = parseFloat(row.value) || merged.extraPassengerRatePerKm;
        if (row.key === "night_charge_0_10") merged.nightCharge0to10 = parseFloat(row.value) || merged.nightCharge0to10;
        if (row.key === "night_charge_10_20") merged.nightCharge10to20 = parseFloat(row.value) || merged.nightCharge10to20;
        if (row.key === "night_charge_20_25") merged.nightCharge20to25 = parseFloat(row.value) || merged.nightCharge20to25;
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
    const config: TotoPricingConfig = {
      baseFare: Number(body.baseFare ?? DEFAULT_TOTO_PRICING.baseFare),
      ratePerKm0to10: Number(body.ratePerKm0to10 ?? DEFAULT_TOTO_PRICING.ratePerKm0to10),
      ratePerKm10to20: Number(body.ratePerKm10to20 ?? DEFAULT_TOTO_PRICING.ratePerKm10to20),
      ratePerKm20to25: Number(body.ratePerKm20to25 ?? DEFAULT_TOTO_PRICING.ratePerKm20to25),
      maxServiceKm: Number(body.maxServiceKm ?? DEFAULT_TOTO_PRICING.maxServiceKm),
      defaultPassengerCount: Number(body.defaultPassengerCount ?? DEFAULT_TOTO_PRICING.defaultPassengerCount),
      minPassengers: Number(body.minPassengers ?? DEFAULT_TOTO_PRICING.minPassengers),
      maxPassengers: Number(body.maxPassengers ?? DEFAULT_TOTO_PRICING.maxPassengers),
      includedPassengers: Number(body.includedPassengers ?? DEFAULT_TOTO_PRICING.includedPassengers),
      extraPassengerRatePerKm: Number(body.extraPassengerRatePerKm ?? DEFAULT_TOTO_PRICING.extraPassengerRatePerKm),
      nightCharge0to10: Number(body.nightCharge0to10 ?? DEFAULT_TOTO_PRICING.nightCharge0to10),
      nightCharge10to20: Number(body.nightCharge10to20 ?? DEFAULT_TOTO_PRICING.nightCharge10to20),
      nightCharge20to25: Number(body.nightCharge20to25 ?? DEFAULT_TOTO_PRICING.nightCharge20to25),
      nightStartTime: String(body.nightStartTime || DEFAULT_TOTO_PRICING.nightStartTime),
      nightEndTime: String(body.nightEndTime || DEFAULT_TOTO_PRICING.nightEndTime),
    };

    const admin = supabaseAdmin();

    // 1. Save unified JSON config
    await admin.from("system_settings").upsert(
      {
        key: PRICING_CONFIG_KEY,
        value: JSON.stringify(config),
        description: "টোটো ভাড়ার সম্পূর্ণ রেট চার্ট ও নাইট টাইমিং কনফিগারেশন",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // 2. Also mirror into individual keys for compatibility
    const items = [
      { key: "base_fare", value: String(config.baseFare), description: "বেস ভাড়া (টাকা)" },
      { key: "rate_per_km_0_10", value: String(config.ratePerKm0to10), description: "০-১০ কিমি রেট (টাকা/কিমি)" },
      { key: "rate_per_km_10_20", value: String(config.ratePerKm10to20), description: "১০-২০ কিমি রেট (টাকা/কিমি)" },
      { key: "rate_per_km_20_25", value: String(config.ratePerKm20to25), description: "২০-২৫ কিমি রেট (টাকা/কিমি)" },
      { key: "extra_passenger_rate_per_km", value: String(config.extraPassengerRatePerKm), description: "অতিরিক্ত যাত্রী রেট প্রতি কিমি" },
      { key: "night_charge_0_10", value: String(config.nightCharge0to10), description: "নাইট চার্জ ০-১০ কিমি" },
      { key: "night_charge_10_20", value: String(config.nightCharge10to20), description: "নাইট চার্জ ১০-২০ কিমি" },
      { key: "night_charge_20_25", value: String(config.nightCharge20to25), description: "নাইট চার্জ ২০-২৫ কিমি" },
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
      message: "ভাড়ার রেট চার্ট ও নাইট টাইমিং সফলভাবে সংরক্ষিত হয়েছে!",
      config,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save pricing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
