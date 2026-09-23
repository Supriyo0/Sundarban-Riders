"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Car,
  Phone,
  MapPin,
  Clock,
  IndianRupee,
  ShieldCheck,
  Star,
  CheckCircle2,
  Navigation,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TrackBooking {
  id: string;
  booking_no?: string;
  customer_phone: string;
  driver_name?: string;
  driver_phone?: string;
  toto_number?: string;
  pickup_location?: string;
  drop_location?: string;
  distance_km?: number;
  fare?: number;
  status: string;
  created_at: string;
}

export default function TrackRidePage() {
  const params = useParams();
  const bookingId = params?.id as string;
  const supabase = createClient();

  const [booking, setBooking] = useState<TrackBooking | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBooking = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();

      if (!error && data) {
        setBooking(data);
      }
    } catch (err) {
      console.error("Tracking load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();

    const channel = supabase
      .channel(`track_${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          setBooking(payload.new as TrackBooking);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  const mapQuery = booking
    ? encodeURIComponent(`${booking.pickup_location || "Sundarbans"} to ${booking.drop_location || "Sundarbans"}`)
    : "Sundarbans, West Bengal";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-start p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between py-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">সুন্দরবন রাইডার্স</h1>
              <p className="text-xs text-slate-400 font-mono">লাইভ রাইড ট্র্যাকিং</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-emerald-400 font-medium">হেল্পলাইন: 8348122122</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">রাইড তথ্য লোড হচ্ছে...</div>
        ) : !booking ? (
          <Card className="border-slate-800 bg-slate-900 text-slate-100 p-6 text-center">
            <Car className="mx-auto h-12 w-12 text-slate-600 mb-2" />
            <h2 className="text-lg font-bold">রাইড তথ্য পাওয়া যায়নি</h2>
            <p className="text-xs text-slate-400 mt-1">বুকিং লিঙ্কটি সঠিক কিনা অনুগ্রহ করে যাচাই করুন।</p>
          </Card>
        ) : (
          <>
            {/* Live Map Preview */}
            <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900">
              <iframe
                title="Google Maps Route"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0, filter: "invert(90%) hue-rotate(180deg)" }}
                src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
                allowFullScreen
              />
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-xs font-semibold flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                লাইভ জিপিএস রুট
              </div>
            </div>

            {/* Driver & Trip Card */}
            <Card className="border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
                      {booking.driver_name ? booking.driver_name.charAt(0) : "🛺"}
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-white">
                        {booking.driver_name || "চালক খোঁজা হচ্ছে..."}
                      </h2>
                      <p className="text-xs font-mono text-emerald-400 font-semibold">
                        টোটো নং: {booking.toto_number || "অ্যাসাইন অপেক্ষমাণ"}
                      </p>
                    </div>
                  </div>

                  {booking.driver_phone && (
                    <a
                      href={`tel:${booking.driver_phone}`}
                      className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-semibold shadow-lg shadow-emerald-950"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      কল করুন
                    </a>
                  )}
                </div>

                {/* Status Bar */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">রাইড স্ট্যাটাস:</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {booking.status === "completed"
                      ? "যাত্রা সফলভাবে সম্পন্ন"
                      : booking.status === "assigned"
                      ? "চালক পিকআপের দিকে আসছেন"
                      : "চালক খোঁজা হচ্ছে"}
                  </span>
                </div>

                {/* Route Points */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400">পিকআপ:</span>
                      <p className="font-semibold text-slate-200">{booking.pickup_location || "লোকেশন পিন"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-slate-800">
                    <MapPin className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400">গন্তব্য:</span>
                      <p className="font-semibold text-slate-200">{booking.drop_location || "নির্দিষ্ট গন্তব্য"}</p>
                    </div>
                  </div>
                </div>

                {/* Fare Card */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">নির্ধারিত ভাড়া:</span>
                    <div className="text-xl font-bold font-mono text-emerald-400">
                      ₹{booking.fare || 0}.00
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400">দূরত্ব:</span>
                    <div className="text-sm font-semibold text-slate-300">
                      {booking.distance_km || 0} কিমি
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>সুন্দরবন রাইডার্সের আইটি ও আইটিইএস ডিজিটাল প্ল্যাটফর্মে আপনার যাত্রা সুরক্ষিত।</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
