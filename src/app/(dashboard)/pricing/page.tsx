"use client";

import { useEffect, useState, useMemo } from "react";
import {
  IndianRupee,
  Save,
  Calculator,
  Moon,
  Clock,
  RefreshCw,
  Users,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DEFAULT_TOTO_PRICING,
  TotoPricingConfig,
  calculateTotoFare,
} from "@/lib/pricing/fare-calculator";

export default function PricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [config, setConfig] = useState<TotoPricingConfig>(DEFAULT_TOTO_PRICING);

  // Fare Simulator State
  const [simKm, setSimKm] = useState<number>(3);
  const [simPassengers, setSimPassengers] = useState<number>(3);
  const [simIsNight, setSimIsNight] = useState<boolean>(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pricing");
      const data = await res.json();
      if (data?.config) {
        setConfig(data.config);
      }
    } catch (err: unknown) {
      console.error("Error loading pricing:", err);
      toast.error("ভাড়ার চার্ট লোড করতে ব্যর্থ হয়েছে");
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
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "সংরক্ষণ ব্যর্থ হয়েছে");
      toast.success("✅ নতুন ভাড়ার চার্ট ও নাইট টাইমিং সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "সংরক্ষণ করতে ব্যর্থ হয়েছে";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Simulated Fare Breakdown
  const simulatedResult = useMemo(() => {
    // Generate a dummy ride time matching day/night toggle
    const rideDate = new Date();
    if (simIsNight) {
      rideDate.setHours(22, 0, 0, 0); // 10:00 PM (Night)
    } else {
      rideDate.setHours(14, 0, 0, 0); // 2:00 PM (Day)
    }
    return calculateTotoFare(simKm, simPassengers, config, rideDate);
  }, [simKm, simPassengers, simIsNight, config]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              💰 টোটো ভাড়া ও রেট চার্ট কনফিগারেশন (Fare & Pricing)
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
              লাইভ কার্যকর
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            বেস ভাড়া, দূরত্বের স্ল্যাব রেট (০-১০ কিমি, ১০-২০ কিমি, ২০-২৫ কিমি), যাত্রী সংখ্যা অনুযায়ী চার্জ এবং নাইট টাইমিং নির্ধারণ করুন।
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          disabled={loading}
          className="border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          রিফ্রেশ
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settings Form */}
        <Card className="lg:col-span-2 border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              <span>🛺 টোটো রেট চার্ট সেটিংস</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              এখানে পরিবর্তিত যেকোনো মূল্য তাৎক্ষণিকভাবে গ্রাহক ও চালকের অ্যাপ এবং ব্যাকএন্ডে স্বয়ংক্রিয়ভাবে কার্যকর হবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION 1: BASE FARE & DISTANCE SLABS */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  <span>১. বেস ভাড়া ও দূরত্বের স্ল্যাব (Distance Slabs)</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="baseFare" className="text-xs font-bold text-foreground">
                      বেস ভাড়া (Base Fare - ₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="baseFare"
                        type="number"
                        min="0"
                        value={config.baseFare}
                        onChange={(e) =>
                          setConfig({ ...config, baseFare: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9 font-black text-emerald-600 bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">১০ কিমি পর্যন্ত প্রাথমিক বেস ভাড়া (ডিফল্ট: ₹৩০)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rate0to10" className="text-xs font-bold text-foreground">
                      ০ থেকে ১০ কিমি রেট (₹ / কিমি)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="rate0to10"
                        type="number"
                        step="0.5"
                        min="0"
                        value={config.ratePerKm0to10}
                        onChange={(e) =>
                          setConfig({ ...config, ratePerKm0to10: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">১০ কিমি পর্যন্ত দূরত্বের চার্জ (ডিফল্ট: ₹৫/কিমি)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rate10to20" className="text-xs font-bold text-foreground">
                      ১০ থেকে ২০ কিমি রেট (₹ / কিমি)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="rate10to20"
                        type="number"
                        step="0.5"
                        min="0"
                        value={config.ratePerKm10to20}
                        onChange={(e) =>
                          setConfig({ ...config, ratePerKm10to20: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">১০-২০ কিমি দূরত্বের চার্জ (ডিফল্ট: ₹৭/কিমি)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rate20to25" className="text-xs font-bold text-foreground">
                      ২০ থেকে ২৫ কিমি রেট (₹ / কিমি)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="rate20to25"
                        type="number"
                        step="0.5"
                        min="0"
                        value={config.ratePerKm20to25}
                        onChange={(e) =>
                          setConfig({ ...config, ratePerKm20to25: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">২০-২৫ কিমি দূরত্বের চার্জ (ডিফল্ট: ₹৬/কিমি)</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PASSENGER SETTINGS */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>২. যাত্রী সংখ্যা ও অতিরিক্ত চার্জ সেটিংস (Passenger Rules)</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="defaultPass" className="text-xs font-bold text-foreground">
                      ডিফল্ট যাত্রী সংখ্যা
                    </Label>
                    <Input
                      id="defaultPass"
                      type="number"
                      min="1"
                      max="10"
                      value={config.defaultPassengerCount}
                      onChange={(e) =>
                        setConfig({ ...config, defaultPassengerCount: parseInt(e.target.value) || 3 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">বুকিংয়ে প্রারম্ভিক যাত্রী (ডিফল্ট: ৩)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="minPass" className="text-xs font-bold text-foreground">
                      সর্বনিম্ন যাত্রী
                    </Label>
                    <Input
                      id="minPass"
                      type="number"
                      min="1"
                      max="5"
                      value={config.minPassengers}
                      onChange={(e) =>
                        setConfig({ ...config, minPassengers: parseInt(e.target.value) || 3 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">গ্রাহক কমাতে পারবেন (ডিফল্ট: ৩)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maxPass" className="text-xs font-bold text-foreground">
                      সর্বোচ্চ যাত্রী
                    </Label>
                    <Input
                      id="maxPass"
                      type="number"
                      min="3"
                      max="10"
                      value={config.maxPassengers}
                      onChange={(e) =>
                        setConfig({ ...config, maxPassengers: parseInt(e.target.value) || 6 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">গ্রাহক বাড়াতে পারবেন (ডিফল্ট: ৬)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="includedPass" className="text-xs font-bold text-foreground">
                      বিনা খরচে অন্তর্ভুক্ত যাত্রী সংখ্যা
                    </Label>
                    <Input
                      id="includedPass"
                      type="number"
                      min="1"
                      max="5"
                      value={config.includedPassengers}
                      onChange={(e) =>
                        setConfig({ ...config, includedPassengers: parseInt(e.target.value) || 3 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">৩ জন যাত্রী পর্যন্ত কোনো অতিরিক্ত চার্জ নেই</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="extraPassRate" className="text-xs font-bold text-foreground">
                      প্রতি অতিরিক্ত যাত্রী চার্জ (₹ / যাত্রী / কিমি)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="extraPassRate"
                        type="number"
                        step="0.5"
                        min="0"
                        value={config.extraPassengerRatePerKm}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            extraPassengerRatePerKm: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-bold text-blue-600 bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">৩ জনের বেশি হলে প্রতি জনের জন্য ₹২/কিমি যোগ হবে</p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: NIGHT TIMINGS & CHARGES */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Moon className="w-4 h-4 text-purple-600" />
                  <span>৩. নাইট চার্জ ও সময়সীমা (Night Charges & Timing)</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nightStart" className="text-xs font-bold text-foreground">
                      রাতের চার্জ শুরু (Night Start Time)
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="nightStart"
                        type="time"
                        value={config.nightStartTime}
                        onChange={(e) => setConfig({ ...config, nightStartTime: e.target.value })}
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">ডিফল্ট: রাত ৯:৩০ (21:30)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nightEnd" className="text-xs font-bold text-foreground">
                      রাতের চার্জ শেষ (Night End Time)
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="nightEnd"
                        type="time"
                        value={config.nightEndTime}
                        onChange={(e) => setConfig({ ...config, nightEndTime: e.target.value })}
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">ডিফল্ট: ভোর ৬:০০ (06:00)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="night0to10" className="text-xs font-bold text-foreground">
                      নাইট চার্জ: ০-১০ কিমি (₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="night0to10"
                        type="number"
                        min="0"
                        value={config.nightCharge0to10}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightCharge0to10: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">ডিফল্ট: ₹৫০ অতিরিক্ত</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="night10to20" className="text-xs font-bold text-foreground">
                      নাইট চার্জ: ১০-২০ কিমি (₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="night10to20"
                        type="number"
                        min="0"
                        value={config.nightCharge10to20}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightCharge10to20: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">ডিফল্ট: ₹৭৫ অতিরিক্ত</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="night20to25" className="text-xs font-bold text-foreground">
                      নাইট চার্জ: ২০-২৫ কিমি (₹)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="night20to25"
                        type="number"
                        min="0"
                        value={config.nightCharge20to25}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightCharge20to25: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">ডিফল্ট: ₹১০০ অতিরিক্ত</p>
                  </div>
                </div>
              </div>

              {/* SAVE BUTTON */}
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={saving || loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 h-12 rounded-xl shadow-md flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "সংরক্ষণ হচ্ছে..." : "নতুন রেট চার্ট সংরক্ষণ করুন"}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Live Fare Calculator / Simulator */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  লাইভ ভাড়া সিমুলেটর (Live Simulator)
                </CardTitle>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  রিয়েলটাইম
                </span>
              </div>
              <CardDescription className="text-muted-foreground text-xs">
                দূরত্ব ও যাত্রী সংখ্যা পরিবর্তন করে তাৎক্ষণিক ভাড়া পরীক্ষা করুন।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Distance Slider / Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-foreground">
                  <span>দূরত্ব (Distance):</span>
                  <span className="text-emerald-600 font-mono text-sm">{simKm} কিমি</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="25"
                  step="0.5"
                  value={simKm}
                  onChange={(e) => setSimKm(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>০.৫ কিমি</span>
                  <span>১০ কিমি</span>
                  <span>২০ কিমি</span>
                  <span>২৫ কিমি</span>
                </div>
              </div>

              {/* Passenger Selector in Simulator */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-foreground">
                  <span>যাত্রী সংখ্যা (Passenger Count):</span>
                  <span className="text-blue-600 font-bold">{simPassengers} জন</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSimPassengers(cnt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        simPassengers === cnt
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {cnt} যাত্রী {cnt > 3 && `(+₹${(cnt - 3) * 2}/কিমি)`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day / Night Toggle */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground block">সময়সূচী (Day / Night):</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimIsNight(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      !simIsNight
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-muted text-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    <span>☀️ ডে রেট (দিনের বেলা)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimIsNight(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      simIsNight
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-muted text-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>🌙 নাইট চার্জ ({config.nightStartTime} পর)</span>
                  </button>
                </div>
              </div>

              {/* Result Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    চূড়ান্ত গণনা করা ভাড়া
                  </span>
                  {simIsNight && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                      নাইট চার্জ যুক্ত
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-700 font-mono">
                    ₹{simulatedResult.totalFare}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">.০০</span>
                </div>

                {/* Detailed Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-emerald-200/80 text-[11px] text-slate-700 font-medium">
                  <div className="flex justify-between">
                    <span>বেস ভাড়া:</span>
                    <span className="font-bold">₹{simulatedResult.baseFare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>দূরত্ব ভাড়া ({simulatedResult.distanceKm} কিমি):</span>
                    <span className="font-bold">₹{simulatedResult.distanceFare}</span>
                  </div>
                  {simulatedResult.extraPassengerCount > 0 && (
                    <div className="flex justify-between text-blue-700">
                      <span>
                        অতিরিক্ত যাত্রী ({simulatedResult.extraPassengerCount} জন x ₹
                        {config.extraPassengerRatePerKm}/কিমি):
                      </span>
                      <span className="font-bold">+₹{simulatedResult.extraPassengerFare}</span>
                    </div>
                  )}
                  {simulatedResult.isNight && (
                    <div className="flex justify-between text-purple-700 font-bold">
                      <span>নাইট চার্জ:</span>
                      <span>+₹{simulatedResult.nightCharge}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Notice Preview */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>গ্রাহক বুকিং স্ক্রিন ডিসপ্লে নোটিশ:</span>
                </span>
                <p className="text-[10px] text-amber-800/90 leading-relaxed font-normal">
                  &ldquo;⚠️ এটি আনুমানিক ভাড়া। আপনার সঠিক পিকআপ/ড্রপ অবস্থান ও রোডের অতিক্রান্ত দূরত্বের উপর ভিত্তি করে চূড়ান্ত ভাড়া কম বা বেশি হতে পারে।&rdquo;
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
