"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IndianRupee,
  Save,
  Calculator,
  Moon,
  Clock,
  ShieldAlert,
  Percent,
  RefreshCw,
  HelpCircle,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function PricingPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pricing Form State
  const [baseFare, setBaseFare] = useState<number>(20);
  const [baseDistanceKm, setBaseDistanceKm] = useState<number>(1.0);
  const [ratePerKm, setRatePerKm] = useState<number>(15);
  const [minFare, setMinFare] = useState<number>(20);
  const [techFee, setTechFee] = useState<number>(5);
  const [nightMultiplier, setNightMultiplier] = useState<number>(1.25);
  const [nightStartTime, setNightStartTime] = useState<string>("22:00");
  const [nightEndTime, setNightEndTime] = useState<string>("06:00");

  // Fare Simulator State
  const [simKm, setSimKm] = useState<number>(5);
  const [simIsNight, setSimIsNight] = useState<boolean>(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach((row) => {
          if (row.key === "base_fare") setBaseFare(parseFloat(row.value) || 20);
          if (row.key === "base_distance_km") setBaseDistanceKm(parseFloat(row.value) || 1.0);
          if (row.key === "rate_per_km") setRatePerKm(parseFloat(row.value) || 15);
          if (row.key === "min_fare") setMinFare(parseFloat(row.value) || 20);
          if (row.key === "tech_fee") setTechFee(parseFloat(row.value) || 5);
          if (row.key === "night_multiplier") setNightMultiplier(parseFloat(row.value) || 1.25);
          if (row.key === "night_start") setNightStartTime(row.value || "22:00");
          if (row.key === "night_end") setNightEndTime(row.value || "06:00");
        });
      }
    } catch (err: unknown) {
      console.error("Error loading pricing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updates = [
        { key: "base_fare", value: String(baseFare), description: "বেস ভাড়া (টাকা)" },
        { key: "base_distance_km", value: String(baseDistanceKm), description: "বেস দূরত্ব (কিমি)" },
        { key: "rate_per_km", value: String(ratePerKm), description: "প্রতি কিমি ভাড়া" },
        { key: "min_fare", value: String(minFare), description: "সর্বনিম্ন ভাড়া" },
        { key: "tech_fee", value: String(techFee), description: "প্ল্যাটফর্ম প্রযুক্তি ফি" },
        { key: "night_multiplier", value: String(nightMultiplier), description: "রাতের চার্জ গুণক" },
        { key: "night_start", value: nightStartTime, description: "রাতের শুরু" },
        { key: "night_end", value: nightEndTime, description: "রাতের শেষ" },
      ];

      for (const item of updates) {
        await supabase
          .from("system_settings")
          .upsert(item, { onConflict: "key" });
      }

      toast.success("✅ নতুন ভাড়ার চার্ট সফলভাবে সংরক্ষিত ও কার্যকর হয়েছে!");
    } catch (err: unknown) {
      toast.error("সংরক্ষণ করতে ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  // Calculate Simulation
  const calculatedFare = Math.max(
    minFare,
    simKm <= baseDistanceKm
      ? baseFare
      : baseFare + (simKm - baseDistanceKm) * ratePerKm
  ) * (simIsNight ? nightMultiplier : 1.0);

  const roundedFare = Math.round(calculatedFare);
  const driverPayout = Math.max(0, roundedFare - techFee);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            💰 ভাড়া ও রেট চার্ট কনফিগারেশন (Fares & Pricing)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            টোটো ভাড়ার বেস রেট, প্রতি কিলোমিটার চার্জ, টেকনোলজি ফি এবং রাতের চার্জ নিয়ন্ত্রণ করুন
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          className="border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          রিফ্রেশ
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settings Form */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">স্ট্যান্ডার্ড রেট চার্ট সেটিংস</CardTitle>
            <CardDescription className="text-muted-foreground">
              এই রেট চার্টের উপর ভিত্তি করে হোয়াটসঅ্যাপে স্বয়ংক্রিয়ভাবে ভাড়া গণনা করা হবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="baseFare" className="text-foreground">
                    বেস ভাড়া (Base Fare - ₹)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="baseFare"
                      type="number"
                      step="1"
                      min="0"
                      value={baseFare}
                      onChange={(e) => setBaseFare(parseFloat(e.target.value) || 0)}
                      className="pl-9 bg-muted border-border text-foreground font-semibold"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">বুকিংয়ের প্রাথমিক বেস ভাড়া</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseKm" className="text-foreground">
                    বেস দূরত্ব (Base Distance - KM)
                  </Label>
                  <Input
                    id="baseKm"
                    type="number"
                    step="0.1"
                    min="0"
                    value={baseDistanceKm}
                    onChange={(e) => setBaseDistanceKm(parseFloat(e.target.value) || 0)}
                    className="bg-muted border-border text-foreground font-semibold"
                  />
                  <p className="text-xs text-muted-foreground">বেস ভাড়ার মধ্যে অন্তর্ভুক্ত কিলোমিটার</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rateKm" className="text-foreground">
                    প্রতি কিমি ভাড়া (Rate Per KM - ₹)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="rateKm"
                      type="number"
                      step="0.5"
                      min="0"
                      value={ratePerKm}
                      onChange={(e) => setRatePerKm(parseFloat(e.target.value) || 0)}
                      className="pl-9 bg-muted border-border text-foreground font-semibold text-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">বেস দূরত্বের পর অতিরিক্ত প্রতি কিমি চার্জ</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minFare" className="text-foreground">
                    সর্বনিম্ন ট্রিপ ভাড়া (Minimum Fare - ₹)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="minFare"
                      type="number"
                      step="1"
                      min="0"
                      value={minFare}
                      onChange={(e) => setMinFare(parseFloat(e.target.value) || 0)}
                      className="pl-9 bg-muted border-border text-foreground font-semibold"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">যেকোনো ছোট রাইডের সর্বনিম্ন ভাড়া</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  প্ল্যাটফর্ম সাপোর্ট ও প্রযুক্তি ফি
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="techFee" className="text-foreground">
                      প্রতি রাইড প্রযুক্তি সহায়তা ফি (Tech Fee - ₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="techFee"
                        type="number"
                        step="1"
                        min="0"
                        value={techFee}
                        onChange={(e) => setTechFee(parseFloat(e.target.value) || 0)}
                        className="pl-9 bg-muted border-border text-foreground font-semibold"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">সার্ভার ও প্ল্যাটফর্ম পরিচালনা ফি</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nightMultiplier" className="text-foreground">
                      রাতের ভাড়া গুণক (Night Multiplier)
                    </Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="nightMultiplier"
                        type="number"
                        step="0.05"
                        min="1"
                        value={nightMultiplier}
                        onChange={(e) => setNightMultiplier(parseFloat(e.target.value) || 1)}
                        className="pl-9 bg-muted border-border text-foreground font-semibold text-amber-500"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">যেমন: 1.25 = ২৫% অতিরিক্ত রাতের চার্জ</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nightStart" className="text-foreground flex items-center gap-1">
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                    রাতের সময় শুরু
                  </Label>
                  <Input
                    id="nightStart"
                    type="time"
                    value={nightStartTime}
                    onChange={(e) => setNightStartTime(e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nightEnd" className="text-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    রাতের সময় শেষ
                  </Label>
                  <Input
                    id="nightEnd"
                    type="time"
                    value={nightEndTime}
                    onChange={(e) => setNightEndTime(e.target.value)}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 h-10 mt-2"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "সংরক্ষণ করা হচ্ছে..." : "ভাড়ার চার্ট সংরক্ষণ করুন"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Fare Calculator / Simulator */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-500" />
              লাইভ ভাড়া ক্যালকুলেটর
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              যেকোনো দূরত্বের জন্য স্বয়ংক্রিয় ভাড়া পরীক্ষা করুন
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">পরীক্ষামূলক দূরত্ব (KM)</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={simKm}
                onChange={(e) => setSimKm(parseFloat(e.target.value) || 1)}
                className="bg-muted border-border text-foreground font-bold"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="nightSim"
                type="checkbox"
                checked={simIsNight}
                onChange={(e) => setSimIsNight(e.target.checked)}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <Label htmlFor="nightSim" className="text-sm font-medium text-foreground cursor-pointer">
                রাতের ভাড়া প্রযোজ্য ({nightMultiplier}x)
              </Label>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">কাস্টমার প্রদেয় ভাড়া:</span>
                <span className="text-2xl font-bold text-emerald-500">₹{roundedFare}.00</span>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border">
                <span>প্ল্যাটফর্ম টেক সাপোর্ট ফি:</span>
                <span className="font-semibold text-foreground">₹{techFee}.00</span>
              </div>

              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>চালকের নেট আয় (Net Payout):</span>
                <span className="font-bold text-emerald-400">₹{driverPayout}.00</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                গণনার সূত্র:
              </p>
              <p>১. বেস দূরত্ব ({baseDistanceKm} কিমি) = ₹{baseFare}</p>
              <p>২. অতিরিক্ত {Math.max(0, simKm - baseDistanceKm)} কিমি × ₹{ratePerKm} = ₹{Math.max(0, simKm - baseDistanceKm) * ratePerKm}</p>
              {simIsNight && <p className="text-amber-500">৩. রাতের গুণক: × {nightMultiplier}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
