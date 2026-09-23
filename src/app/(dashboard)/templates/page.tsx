"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  Save,
  RefreshCw,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function TemplatesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Templates State
  const [driverTerms, setDriverTerms] = useState<string>("");
  const [customerDisclaimer, setCustomerDisclaimer] = useState<string>("");
  const [bookingConfirmation, setBookingConfirmation] = useState<string>("");
  const [cancellationWarning, setCancellationWarning] = useState<string>("");
  const [helplineNumber, setHelplineNumber] = useState<string>("8348122122");

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("system_settings").select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach((row) => {
          if (row.key === "driver_terms_bengali") setDriverTerms(row.value);
          if (row.key === "customer_disclaimer_bengali") setCustomerDisclaimer(row.value);
          if (row.key === "booking_confirmation_template") setBookingConfirmation(row.value);
          if (row.key === "cancellation_warning_bengali") setCancellationWarning(row.value);
          if (row.key === "helpline_number") setHelplineNumber(row.value);
        });
      }
    } catch (err: unknown) {
      console.error("Error loading templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updates = [
        {
          key: "driver_terms_bengali",
          value: driverTerms,
          description: "চালক নিবন্ধন শর্তাবলী (৭টি ধারা)",
        },
        {
          key: "customer_disclaimer_bengali",
          value: customerDisclaimer,
          description: "কাস্টমার রাইড ডিসক্লেইমার",
        },
        {
          key: "booking_confirmation_template",
          value: bookingConfirmation,
          description: "বুকিং কনফার্মেশন হোয়াটসঅ্যাপ মেসেজ",
        },
        {
          key: "cancellation_warning_bengali",
          value: cancellationWarning,
          description: "কাস্টমার বাতিল সতর্কবার্তা",
        },
        {
          key: "helpline_number",
          value: helplineNumber,
          description: "হেল্পলাইন নম্বর",
        },
      ];

      for (const item of updates) {
        await supabase
          .from("system_settings")
          .upsert(item, { onConflict: "key" });
      }

      toast.success("✅ সমস্ত বাংলা আইনি ও মেসেজ টেমপ্লেট সংরক্ষিত হয়েছে!");
    } catch (err: unknown) {
      toast.error("সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            বাংলা আইনি ও মেসেজ টেমপ্লেট (Bengali Templates)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            হোয়াটসঅ্যাপে গ্রাহক ও চালকদের পাঠানো সমস্ত ডিসক্লেইমার, আইনি চুক্তি ও সতর্কবার্তা এডিট করুন
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadTemplates}
          className="border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          রিসেট / রিফ্রেশ
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Helpline Number */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-500" />
              অফিসিয়াল হেল্পলাইন নম্বর
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              বুকিং কনফার্মেশন ও বাতিলকরণ নোটিশে প্রদর্শিত কাস্টমার কেয়ার নম্বর
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Input
                value={helplineNumber}
                onChange={(e) => setHelplineNumber(e.target.value)}
                placeholder="8348122122"
                required
                className="bg-muted border-border text-foreground font-mono font-bold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer Virtual Disclaimer */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              কাস্টমার ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী (Customer Ride Disclaimer)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              প্রতিটি বুকিংয়ের পূর্বে গ্রাহকের সম্মতি নেওয়ার জন্য পাঠানো বার্তা
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={customerDisclaimer}
              onChange={(e) => setCustomerDisclaimer(e.target.value)}
              className="bg-muted border-border text-foreground font-sans text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Driver Terms & Agreement */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              চালক নিবন্ধন ও আইনি ঘোষণা (Driver Terms & 7-Point Agreement)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              নতুন চালক নিবন্ধন বা অনবোর্ডিংয়ের সময় সম্মতি নেওয়ার সম্পূর্ণ আইনি ৭টি শর্তাবলী
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={9}
              value={driverTerms}
              onChange={(e) => setDriverTerms(e.target.value)}
              className="bg-muted border-border text-foreground font-sans text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* Booking Confirmation Template */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              বুকিং নিশ্চিতকরণ টেমপ্লেট (Booking Confirmation Message)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              ট্যাগসমূহ: {'{booking_no}'}, {'{driver_name}'}, {'{driver_phone}'}, {'{toto_number}'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={5}
              value={bookingConfirmation}
              onChange={(e) => setBookingConfirmation(e.target.value)}
              className="bg-muted border-border text-foreground font-sans text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        {/* 3-Strike Cancellation Warning */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              ৩-বার বাতিলকরণ সতর্কবার্তা (3-Strike Cancellation Warning)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              কাস্টমার রাইড বাতিল করলে স্বয়ংক্রিয়ভাবে পাঠানো সতর্কবার্তা
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={5}
              value={cancellationWarning}
              onChange={(e) => setCancellationWarning(e.target.value)}
              className="bg-muted border-border text-foreground font-sans text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 text-white hover:bg-emerald-700 h-11 w-full text-base font-semibold"
        >
          <Save className="mr-2 h-5 w-5" />
          {saving ? "সংরক্ষণ করা হচ্ছে..." : "সমস্ত টেমপ্লেট সংরক্ষণ করুন"}
        </Button>
      </form>
    </div>
  );
}
