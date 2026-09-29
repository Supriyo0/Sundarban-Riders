"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Car,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import "leaflet/dist/leaflet.css";

interface TrackBooking {
  id: string;
  booking_no?: string;
  booking_number?: string;
  customer_phone: string;
  customer_name?: string;
  driver_name?: string;
  driver_phone?: string;
  toto_number?: string;
  driver_unique_id?: string;
  pickup_location?: string;
  drop_location?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_lat?: number;
  drop_lng?: number;
  driver_lat?: number;
  driver_lng?: number;
  distance_km?: number;
  fare?: number;
  final_fare?: number;
  estimated_fare?: number;
  status: string;
  created_at: string;
  start_otp?: string;
}

async function getLeaflet() {
  const LModule = await import("leaflet");
  return (LModule as any).default || LModule;
}

export default function TrackRidePage() {
  const params = useParams();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<TrackBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeCasingRef = useRef<any>(null);

  // Haversine distance calculator
  const haversineKm = (a: [number, number], b: [number, number]) => {
    const R = 6371;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLon = ((b[1] - a[1]) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a[0] * Math.PI) / 180) *
        Math.cos((b[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const loadBooking = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(bookingId)}`);
      const data = await res.json();
      if (data?.booking) {
        const b: TrackBooking = data.booking;
        setBooking(b);

        if (b.driver_lat && b.driver_lng) {
          const dPos: [number, number] = [Number(b.driver_lat), Number(b.driver_lng)];
          setDriverPos(dPos);

          const target: [number, number] =
            b.status === "in_progress" && b.drop_lat && b.drop_lng
              ? [Number(b.drop_lat), Number(b.drop_lng)]
              : b.pickup_lat && b.pickup_lng
              ? [Number(b.pickup_lat), Number(b.pickup_lng)]
              : dPos;

          const distLeft = haversineKm(dPos, target);
          setEtaMinutes(Math.max(1, Math.round(distLeft / 0.25))); // ~15 km/h toto speed
        }
      }
    } catch (err) {
      console.error("[TrackRide] Poll error:", err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Initial fetch and continuous 3-second live GPS polling
  useEffect(() => {
    loadBooking();
    const interval = setInterval(loadBooking, 3000);
    return () => clearInterval(interval);
  }, [loadBooking]);

  // Real interactive Leaflet Map Engine
  useEffect(() => {
    let mounted = true;

    async function initOrUpdateMap() {
      if (!mapContainerRef.current || !booking) return;

      const pLat = booking.pickup_lat ? Number(booking.pickup_lat) : 21.876;
      const pLng = booking.pickup_lng ? Number(booking.pickup_lng) : 88.192;
      const dLat = booking.drop_lat ? Number(booking.drop_lat) : pLat + 0.012;
      const dLng = booking.drop_lng ? Number(booking.drop_lng) : pLng + 0.012;

      const pickupCoord: [number, number] = [pLat, pLng];
      const dropCoord: [number, number] = [dLat, dLng];
      const activeDriverCoord = driverPos || [pLat + 0.002, pLng + 0.002];

      const L = await getLeaflet();
      if (!mounted) return;

      if (!mapInstanceRef.current) {
        (mapContainerRef.current as any)._leaflet_id = null;

        const map = L.map(mapContainerRef.current, {
          center: activeDriverCoord,
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          dragging: true,
        });

        // Crisp Google Maps street tiles
        L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        }).addTo(map);

        // Green Pickup Pin
        L.marker(pickupCoord, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
              <div style="background:#059669;color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;white-space:nowrap;border:2px solid white;margin-bottom:3px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">📍 পিকআপ</div>
              <div style="width:20px;height:20px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(16,185,129,0.6);"></div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);

        // Red Destination Pin
        L.marker(dropCoord, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
              <div style="background:#dc2626;color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;white-space:nowrap;border:2px solid white;margin-bottom:3px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">🏁 গন্তব্য</div>
              <div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(239,68,68,0.6);"></div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);

        // Moving Live Toto Marker with Pulse Ring
        const driverMarker = L.marker(activeDriverCoord, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-50%);position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:56px;height:56px;background:rgba(16,185,129,0.25);border-radius:50%;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="position:absolute;width:42px;height:42px;background:rgba(5,150,105,0.3);border-radius:50%;"></div>
              <div style="position:relative;width:38px;height:38px;background:linear-gradient(135deg,#047857,#10b981);border:3px solid white;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:20px;">🛺</div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);
        driverMarkerRef.current = driverMarker;

        // Street Polyline
        const pts = [pickupCoord, dropCoord];
        const casing = L.polyline(pts, {
          color: "#064e3b",
          weight: 7,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeCasingRef.current = casing;

        const line = L.polyline(pts, {
          color: "#10b981",
          weight: 4,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineRef.current = line;

        try {
          const bounds = L.latLngBounds([pickupCoord, dropCoord, activeDriverCoord]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } catch {}

        mapInstanceRef.current = map;
      } else {
        // Move live driver marker smoothly
        if (driverMarkerRef.current && activeDriverCoord) {
          driverMarkerRef.current.setLatLng(activeDriverCoord);
          mapInstanceRef.current.panTo(activeDriverCoord, { animate: true, duration: 1.0 });
        }
      }
    }

    initOrUpdateMap();

    return () => {
      mounted = false;
    };
  }, [booking, driverPos]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const fareDisplay = booking?.final_fare || booking?.fare || booking?.estimated_fare || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-start p-3 sm:p-6 font-sans">
      <div className="w-full max-w-lg space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between py-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xs">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-black text-base text-white tracking-tight">সুন্দরবন রাইডার্স</h1>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-xs text-emerald-400 font-bold">লাইভ GPS ট্র্যাকিং</p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-mono block">জরুরি হেল্পলাইন</span>
            <a href="tel:8348122122" className="text-xs text-emerald-400 font-black hover:underline">
              8348122122
            </a>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
            <div className="text-sm font-bold text-slate-300">লাইভ রাইড তথ্য লোড হচ্ছে...</div>
          </div>
        ) : !booking ? (
          <Card className="border-slate-800 bg-slate-900 text-slate-100 p-8 text-center rounded-3xl">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-400 mb-3" />
            <h2 className="text-lg font-bold">রাইড তথ্য পাওয়া যায়নি</h2>
            <p className="text-xs text-slate-400 mt-1">বুকিং লিঙ্কটি সঠিক কিনা অনুগ্রহ করে যাচাই করুন।</p>
          </Card>
        ) : (
          <>
            {/* Real Interactive Leaflet Live Map */}
            <div className="relative w-full h-72 sm:h-80 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Status Overlay Badge */}
              <div className="absolute top-3 left-3 z-[1000] bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700 text-xs font-bold flex items-center gap-2 text-emerald-400 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>
                  {booking.status === "in_progress"
                    ? "🛺 যাত্রা চলছে..."
                    : booking.status === "assigned"
                    ? etaMinutes
                      ? `চালক পৌঁছাচ্ছেন (~${etaMinutes} মিনিট)`
                      : "চালক পিকআপের পথে"
                    : booking.status === "completed"
                    ? "✅ রাইড সম্পন্ন"
                    : "🔍 চালক খোঁজা হচ্ছে..."}
                </span>
              </div>
            </div>

            {/* Driver & Trip Card */}
            <Card className="border-slate-800/90 bg-slate-900/90 backdrop-blur-md text-slate-100 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl font-black shadow-inner">
                      {booking.driver_name ? booking.driver_name.charAt(0) : "🛺"}
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-white">
                        {booking.driver_name || "টোটো চালক"}
                      </h2>
                      <p className="text-xs font-mono text-emerald-400 font-bold">
                        🆔 {booking.driver_unique_id || booking.toto_number || "অ্যাসাইন অপেক্ষমাণ"}
                      </p>
                    </div>
                  </div>

                  {booking.driver_phone && (
                    <a
                      href={`tel:${booking.driver_phone}`}
                      className="h-10 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-black shadow-lg shadow-emerald-950/60 active:scale-95 transition-transform"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      কল করুন
                    </a>
                  )}
                </div>

                {/* Ride Status Banner */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">রাইড স্ট্যাটাস:</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {booking.status === "completed"
                      ? "যাত্রা সফলভাবে সম্পন্ন"
                      : booking.status === "in_progress"
                      ? "যাত্রা শুরু হয়েছে"
                      : booking.status === "assigned"
                      ? "চালক পিকআপে পৌঁছাচ্ছেন"
                      : "চালক অনুসন্ধান চলছে"}
                  </span>
                </div>

                {/* Start OTP if assigned */}
                {booking.status === "assigned" && booking.start_otp && (
                  <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-300 font-medium">যাত্রা শুরুর OTP:</span>
                      <p className="text-[11px] text-slate-400">টোটো ওঠার পর চালককে এই কোডটি বলুন</p>
                    </div>
                    <span className="text-lg font-black tracking-widest font-mono text-emerald-400 bg-emerald-900/60 px-3 py-1 rounded-xl border border-emerald-500/40">
                      {booking.start_otp}
                    </span>
                  </div>
                )}

                {/* Route Points */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-slate-400 font-medium">পিকআপ:</span>
                      <p className="font-bold text-slate-100 truncate">{booking.pickup_location || "লোকেশন পিন"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-800/80">
                    <MapPin className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-slate-400 font-medium">গন্তব্য:</span>
                      <p className="font-bold text-slate-100 truncate">{booking.drop_location || "নির্দিষ্ট গন্তব্য"}</p>
                    </div>
                  </div>
                </div>

                {/* Fare Card */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">ভাড়া:</span>
                    <div className="text-xl font-black font-mono text-emerald-400">
                      ₹{fareDisplay}.00
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">দূরত্ব:</span>
                    <div className="text-sm font-bold text-slate-200">
                      {booking.distance_km || 0} কিমি
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-800/30 text-[11px] text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>সুন্দরবন রাইডার্সের অফিসিয়াল ডিজিটাল প্ল্যাটফর্মে আপনার যাত্রা সুরক্ষিত।</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
