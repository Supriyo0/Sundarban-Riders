"use client";

import { useEffect, useState } from "react";
import {
  QrCode,
  CheckCircle2,
  RefreshCw,
  Phone,
  Smartphone,
  ShieldCheck,
  Zap,
  Radio,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function WhatsAppQRScanPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "waiting_scan" | "connected">("disconnected");
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json();

      setStatus(data.status || "disconnected");
      setQrCode(data.qr || null);
      setPhone(data.phone || null);
    } catch (err) {
      console.error("Failed to fetch QR status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 3 seconds while connecting or waiting for scan
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <QrCode className="h-6 w-6 text-emerald-500" />
          হোয়াটসঅ্যাপ কিউআর কোড স্ক্যান (WhatsApp QR Automation)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার ফোন থেকে হোয়াটসঅ্যাপ স্ক্যান করে সুন্দরবন রাইডার্সের সমস্ত অটোমেশন ও বুকিং বট সক্রিয় করুন
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* QR Code Display Card */}
        <Card className="border-border bg-card shadow-lg text-center p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-foreground text-lg flex items-center justify-center gap-2">
              {status === "connected" ? (
                <span className="text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5" />
                  হোয়াটসঅ্যাপ সফলভাবে কানেক্টেড!
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-5 w-5 text-primary" />
                  কিউআর কোড স্ক্যান করুন
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {status === "connected"
                ? "আপনার এই নম্বরে সমস্ত অটোমেশন ও বট চালু আছে।"
                : "আপনার ফোনের হোয়াটসঅ্যাপ দিয়ে নিচের কিউআর কোডটি স্ক্যান করুন।"}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 flex flex-col items-center justify-center">
            {status === "connected" ? (
              <div className="py-8 space-y-3">
                <div className="h-24 w-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-lg">কানেক্টেড নম্বর:</h3>
                  <p className="text-emerald-500 font-mono text-xl font-bold">
                    +{phone || "WhatsApp"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  এখন যে কেউ এই নম্বরে &quot;Hi&quot; বা বার্তা পাঠালে স্বয়ংক্রিয়ভাবে বাংলা বুকিং বট ও ডিসক্লেইমার শুরু হবে।
                </p>
              </div>
            ) : qrCode ? (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-2xl shadow-inner inline-block border-2 border-slate-200">
                  <img
                    src={qrCode}
                    alt="WhatsApp QR Code"
                    className="h-64 w-64 object-contain"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  লাইভ কিউআর কোড প্রস্তুত (স্ক্যানের জন্য অপেক্ষা করছে...)
                </div>
              </div>
            ) : (
              <div className="py-20 space-y-3">
                <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">কিউআর কোড জেনারেট হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-border w-full flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                disabled={loading}
                className="text-xs border-border text-foreground"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                পুনরায় রিফ্রেশ করুন
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              কীভাবে স্ক্যান করবেন? (How to Connect)
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              ৩টি সহজ পদক্ষেপে আপনার সাধারণ বা বিজনেস হোয়াটসঅ্যাপ যুক্ত করুন
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 border border-border">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                ১
              </span>
              <div>
                <p className="font-semibold text-foreground">আপনার ফোনে WhatsApp খুলুন</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  উপরে ডানদিকের ৩-ডট মেনু (বা Settings) চাপুন।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 border border-border">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                ২
              </span>
              <div>
                <p className="font-semibold text-foreground">&quot;Linked Devices&quot; (সংযুক্ত ডিভাইস)-এ ট্যাপ করুন</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  এরপর <b>&quot;Link a Device&quot;</b> বাটনে চাপ দিন।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/60 border border-border">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                ৩
              </span>
              <div>
                <p className="font-semibold text-foreground">স্ক্রিনের QR Code-টি স্ক্যান করুন</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ক্যামেরা দিয়ে বামদিকের কোডটি স্ক্যান করলেই তাৎক্ষণিক কানেক্ট হয়ে যাবে!
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                সম্পূর্ণ অটোমেশন সক্রিয় থাকবে:
              </p>
              <p>• কাস্টমার ও ড্রাইভার মেনু স্বয়ংক্রিয়ভাবে বাংলায় চলবে।</p>
              <p>• ডিসক্লেইমার সম্মতি ও রিয়েল-টাইম ভাড়া গণনা হবে।</p>
              <p>• ৩-বার বাতিলকরণ নীতি স্বয়ংক্রিয়ভাবে কাজ করবে।</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
