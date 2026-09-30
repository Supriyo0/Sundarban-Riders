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
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  DEFAULT_TOTO_PRICING,
  DEFAULT_TOTO_SLABS,
  TotoPricingConfig,
  TotoSlabConfig,
  calculateTotoFare,
} from "@/lib/pricing/fare-calculator";

export default function PricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [config, setConfig] = useState<TotoPricingConfig>(DEFAULT_TOTO_PRICING);

  // Fare Simulator State
  const [simKm, setSimKm] = useState<number>(4);
  const [simPassengers, setSimPassengers] = useState<number>(3);
  const [simIsNight, setSimIsNight] = useState<boolean>(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/pricing");
      const data = await res.json();
      if (data?.config) {
        setConfig({
          ...DEFAULT_TOTO_PRICING,
          ...data.config,
          slabs:
            data.config.slabs && Array.isArray(data.config.slabs) && data.config.slabs.length > 0
              ? data.config.slabs
              : DEFAULT_TOTO_SLABS,
        });
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

  const handleResetToOfficial = () => {
    setConfig(DEFAULT_TOTO_PRICING);
    toast.info("অফিসিয়াল সুন্দরবন রাইডার্স রেট চার্টে রিসেট করা হয়েছে। সংরক্ষণ করতে 'সংরক্ষণ করুন' বাটনে চাপুন।");
  };

  const handleSlabBookingChargeChange = (index: number, val: number) => {
    const updatedSlabs = [...(config.slabs || DEFAULT_TOTO_SLABS)];
    updatedSlabs[index] = {
      ...updatedSlabs[index],
      bookingCharge: Math.max(0, val),
    };
    setConfig({ ...config, slabs: updatedSlabs });
  };

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
      toast.success("✅ নতুন রেট চার্ট ও নাইট টাইমিং সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "সংরক্ষণ করতে ব্যর্থ হয়েছে";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Simulated Fare Breakdown
  const simulatedResult = useMemo(() => {
    const rideDate = new Date();
    if (simIsNight) {
      rideDate.setHours(22, 0, 0, 0); // 10:00 PM (Night)
    } else {
      rideDate.setHours(14, 0, 0, 0); // 2:00 PM (Day)
    }
    return calculateTotoFare(simKm, simPassengers, config, rideDate);
  }, [simKm, simPassengers, simIsNight, config]);

  const slabs = config.slabs && config.slabs.length > 0 ? config.slabs : DEFAULT_TOTO_SLABS;
  const perKm = config.perKmRate ?? 12;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>📋 সুন্দরবন রাইডার্স অফিসিয়াল রেট চার্ট ও ভাড়া কনফিগারেশন</span>
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
              লাইভ কার্যকর
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            অফিসিয়াল ১০টি স্ল্যাব, বুকিং চার্জ, প্রতি কিমি রাইড চার্জ (ডিফল্ট: ₹১২), অতিরিক্ত যাত্রী চার্জ (₹২/কিমি) ও নাইট টাইমিং নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToOfficial}
            className="border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-bold"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            ডিফল্ট চার্টে রিসেট
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadSettings}
            disabled={loading}
            className="border-border text-foreground hover:bg-muted font-bold"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Settings & Rate Chart (Col span 2) */}
        <div className="xl:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Global Rate Rules Card */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>১. সার্বজনীন রাইড চার্জ ও যাত্রী নীতিমালা (Global Rates)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  অ্যাপ ও হোয়াটসঅ্যাপে সব দূরত্বের জন্য এই মৌলিক রেট প্রয়োগ করা হয়।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="perKmRate" className="text-xs font-bold text-foreground">
                      প্রতি কিমি রাইড রেট (₹ / KM)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                      <Input
                        id="perKmRate"
                        type="number"
                        min="1"
                        step="0.5"
                        value={config.perKmRate}
                        onChange={(e) =>
                          setConfig({ ...config, perKmRate: parseFloat(e.target.value) || 0 })
                        }
                        className="pl-9 font-black text-emerald-700 bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ₹১২/- প্রতি কিমি</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="minBillableKm" className="text-xs font-bold text-foreground">
                      সর্বনিম্ন চার্জের দূরত্ব (KM)
                    </Label>
                    <Input
                      id="minBillableKm"
                      type="number"
                      min="1"
                      value={config.minBillableKm}
                      onChange={(e) =>
                        setConfig({ ...config, minBillableKm: parseFloat(e.target.value) || 2 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground">০-২ কিমি = ২ x ₹১২ = ₹২৪</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="includedPax" className="text-xs font-bold text-foreground">
                      বিনা খরচে অন্তর্ভুক্ত যাত্রী
                    </Label>
                    <Input
                      id="includedPax"
                      type="number"
                      min="1"
                      max="4"
                      value={config.includedPassengers}
                      onChange={(e) =>
                        setConfig({ ...config, includedPassengers: parseInt(e.target.value) || 3 })
                      }
                      className="font-bold bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ৩ জন যাত্রী অন্তর্ভুক্ত</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="extraPaxRate" className="text-xs font-bold text-foreground">
                      অতিরিক্ত যাত্রী রেট (₹/যাত্রী/KM)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600" />
                      <Input
                        id="extraPaxRate"
                        type="number"
                        min="0"
                        step="0.5"
                        value={config.extraPassengerRatePerKm}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            extraPassengerRatePerKm: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-black text-blue-700 bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">৩ জনের বেশি হলে প্রতি জনে ₹২/কিমি</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Official 10-Slab Rate Chart Table */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-emerald-600" />
                      <span>২. অফিসিয়াল ১০-স্ল্যাব রেট চার্ট (Official Sundarban Rider Rate Chart)</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      প্রতিটি স্ল্যাবের বুকিং চার্জ সরাসরি সম্পাদনা (edit) করতে পারেন। পরিবর্তন শেষে নিচে সংরক্ষণ করুন।
                    </CardDescription>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                    ৩ জনের হিসাব (3 Jon)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                        <th className="py-2.5 px-3 text-center w-16">স্ল্যাব</th>
                        <th className="py-2.5 px-3">দূরত্ব (KM)</th>
                        <th className="py-2.5 px-3">বুকিং চার্জ (₹) [সম্পাদনাযোগ্য]</th>
                        <th className="py-2.5 px-3">রাইড চার্জ (KM x ₹{perKm})</th>
                        <th className="py-2.5 px-3 font-black text-emerald-800">মোট চার্জ (৩ জন)</th>
                        <th className="py-2.5 px-3 text-blue-700">অতিরিক্ত যাত্রী (৩+)</th>
                        <th className="py-2.5 px-3 text-purple-700">নাইট চার্জ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {slabs.map((slab, idx) => {
                        const minK = slab.minKm;
                        const maxK = slab.maxKm;
                        const isSlab10 = slab.slabNumber === 10;
                        const kmLabel =
                          slab.slabNumber === 1
                            ? "০ - ১০ কিমি"
                            : slab.slabNumber === 2
                            ? "১১ কিমি"
                            : slab.slabNumber === 3
                            ? "১২ কিমি"
                            : slab.slabNumber === 4
                            ? "১৩ কিমি"
                            : slab.slabNumber === 5
                            ? "১৪ - ১৬ কিমি"
                            : slab.slabNumber === 6
                            ? "১৭ - ১৮ কিমি"
                            : slab.slabNumber === 7
                            ? "১৯ - ২০ কিমি"
                            : slab.slabNumber === 8
                            ? "২১ - ২৫ কিমি"
                            : slab.slabNumber === 9
                            ? "২৬ - ৩০ কিমি"
                            : "৩১+ কিমি (অনওয়ার্ডস)";

                        // Example ride charge preview for table
                        const sampleKm =
                          slab.slabNumber === 1 ? 2 : Math.min(maxK, minK > 0 ? Math.ceil(minK) : 2);
                        const sampleRideCharge = Math.max(config.minBillableKm ?? 2, sampleKm) * perKm;
                        const sampleTotal = slab.bookingCharge + sampleRideCharge;

                        const nightTier = slab.nightChargeTier || (idx < 4 ? 1 : idx < 7 ? 2 : 3);
                        const nightVal =
                          nightTier === 1
                            ? config.nightChargeTier1
                            : nightTier === 2
                            ? config.nightChargeTier2
                            : config.nightChargeTier3;

                        return (
                          <tr
                            key={slab.slabNumber}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-black text-slate-700">
                              <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
                                {slab.slabNumber}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              <span>{kmLabel}</span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="relative w-28">
                                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min="0"
                                  value={slab.bookingCharge}
                                  onChange={(e) =>
                                    handleSlabBookingChargeChange(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="h-8 pl-7 font-black text-slate-900 bg-white border-slate-300 focus:border-emerald-500"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {isSlab10
                                ? `KM x ₹${perKm}/-`
                                : `₹${sampleRideCharge} (${sampleKm} কিমিতে)`}
                            </td>
                            <td className="py-2 px-3 font-black text-emerald-700 font-mono text-sm">
                              {isSlab10
                                ? `₹${slab.bookingCharge} + (KM x ₹${perKm})`
                                : `₹${sampleTotal}.০০`}
                            </td>
                            <td className="py-2 px-3 text-blue-700 font-medium">
                              +₹{config.extraPassengerRatePerKm}/কিমি/জন
                            </td>
                            <td className="py-2 px-3 text-purple-700 font-bold font-mono">
                              ₹{nightVal}/-
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>নোট:</strong> ০-২ কিমি সর্বনিম্ন ২ কিমি চার্জ করা হয় (২ x ₹{perKm} = ₹{2 * perKm})। ৩ জনের বেশি যাত্রী হলে প্রতি জনের জন্য ₹{config.extraPassengerRatePerKm}/কিমি যোগ হবে।
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Night Charge Settings */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Moon className="w-4 h-4 text-purple-600" />
                  <span>৩. নাইট চার্জ ও সময়সীমা সেটিংস (Night Charges & Timing)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  নির্ধারিত সময়ে স্বয়ংক্রিয়ভাবে স্ল্যাব অনুযায়ী নাইট চার্জ যুক্ত হবে।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nightStart" className="text-xs font-bold text-foreground">
                      রাতের চার্জ শুরু (Night Start Time)
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="nightStart"
                        type="time"
                        value={config.nightStartTime}
                        onChange={(e) => setConfig({ ...config, nightStartTime: e.target.value })}
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: রাত ৯:৩০ (21:30)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nightEnd" className="text-xs font-bold text-foreground">
                      রাতের চার্জ শেষ (Night End Time)
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="nightEnd"
                        type="time"
                        value={config.nightEndTime}
                        onChange={(e) => setConfig({ ...config, nightEndTime: e.target.value })}
                        className="pl-9 font-bold bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ভোর ৫:০০ (05:00)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="tier1" className="text-xs font-bold text-foreground">
                      ০-১৩ কিমি নাইট চার্জ (স্ল্যাব ১-৪)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
                      <Input
                        id="tier1"
                        type="number"
                        min="0"
                        value={config.nightChargeTier1}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightChargeTier1: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-black text-purple-700 bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ₹৫০/-</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tier2" className="text-xs font-bold text-foreground">
                      ১৪-২০ কিমি নাইট চার্জ (স্ল্যাব ৫-৭)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
                      <Input
                        id="tier2"
                        type="number"
                        min="0"
                        value={config.nightChargeTier2}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightChargeTier2: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-black text-purple-700 bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ₹৭৫/-</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tier3" className="text-xs font-bold text-foreground">
                      ২১+ কিমি নাইট চার্জ (স্ল্যাব ৮-১০)
                    </Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
                      <Input
                        id="tier3"
                        type="number"
                        min="0"
                        value={config.nightChargeTier3}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            nightChargeTier3: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9 font-black text-purple-700 bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">ডিফল্ট: ₹১০০/-</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-12 rounded-xl shadow-md flex items-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? "সংরক্ষণ হচ্ছে..." : "নতুন রেট চার্ট সংরক্ষণ করুন"}</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Live Fare Simulator (Col span 1) */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  <span>লাইভ ভাড়া সিমুলেটর (Live Simulator)</span>
                </CardTitle>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  রিয়েলটাইম
                </span>
              </div>
              <CardDescription className="text-xs">
                দূরত্ব ও যাত্রী সংখ্যা পরিবর্তন করে তাৎক্ষণিক সঠিক ভাড়া যাচাই করুন।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Distance Slider / Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-foreground">
                  <span>দূরত্ব (Distance):</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="50"
                      value={simKm}
                      onChange={(e) => setSimKm(parseFloat(e.target.value) || 1)}
                      className="w-20 h-7 text-xs font-mono font-bold text-emerald-700 text-right pr-1"
                    />
                    <span className="text-xs font-bold text-emerald-600">কিমি</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="35"
                  step="1"
                  value={simKm}
                  onChange={(e) => setSimKm(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>১ কিমি</span>
                  <span>১০ কিমি</span>
                  <span>২০ কিমি</span>
                  <span>৩৫ কিমি</span>
                </div>
              </div>

              {/* Passenger Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-foreground">
                  <span>যাত্রী সংখ্যা (Passengers):</span>
                  <span className="text-blue-600 font-bold">{simPassengers} জন</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 4, 5, 6].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSimPassengers(cnt)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        simPassengers === cnt
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-muted text-foreground border-border hover:bg-muted/80"
                      }`}
                    >
                      {cnt} যাত্রী {cnt > 3 && `(+₹${(cnt - 3) * (config.extraPassengerRatePerKm ?? 2)}/কিমি)`}
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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

              {/* Calculated Result Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                    গণনা করা চূড়ান্ত ভাড়া
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {simulatedResult.slabName}
                  </span>
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
                    <span>বুকিং চার্জ (স্ল্যাব {simulatedResult.slabNumber}):</span>
                    <span className="font-bold">₹{simulatedResult.bookingCharge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>রাইড চার্জ ({simulatedResult.distanceKm} কিমি x ₹{simulatedResult.perKmRate}):</span>
                    <span className="font-bold">₹{simulatedResult.distanceFare}</span>
                  </div>
                  {simulatedResult.extraPassengerCount > 0 && (
                    <div className="flex justify-between text-blue-700 font-bold">
                      <span>
                        অতিরিক্ত যাত্রী ({simulatedResult.extraPassengerCount} জন x ₹
                        {config.extraPassengerRatePerKm}/কিমি):
                      </span>
                      <span>+₹{simulatedResult.extraPassengerFare}</span>
                    </div>
                  )}
                  {simulatedResult.isNight && (
                    <div className="flex justify-between text-purple-700 font-bold">
                      <span>নাইট চার্জ ({config.nightStartTime} - {config.nightEndTime}):</span>
                      <span>+₹{simulatedResult.nightCharge}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Official Policy Banner */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                <span className="font-bold flex items-center gap-1 text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>সুন্দরবন রাইডার্স রেট চার্ট পলিসি</span>
                </span>
                <p className="text-[10.5px] text-slate-600 leading-relaxed font-normal">
                  এখানে সংরক্ষিত রেট চার্ট সরাসরি গ্রাহকের বুকিং ক্যালকুলেটর, চালকের লাইভ মিটার ও হোয়াটসঅ্যাপ ইঞ্জিনে কার্যকর হবে।
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
