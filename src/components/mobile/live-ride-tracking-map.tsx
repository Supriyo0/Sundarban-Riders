"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Phone, MessageCircle, KeyRound, ShieldAlert, X, Star, RefreshCw, CheckCircle2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { LiveFareMeter } from "@/lib/mobile/live-fare-meter";

async function getLeaflet() {
  const mod = await import("leaflet");
  return (mod as any).default || mod;
}

interface LiveRideTrackingMapProps {
  booking: {
    id?: string;
    booking_number?: string;
    bookingNumber?: string;
    driver_name?: string;
    driverName?: string;
    driver_phone?: string;
    driverPhone?: string;
    toto_number?: string;
    totoNumber?: string;
    uniqueId?: string;
    start_otp?: string;
    startOtp?: string;
    driver_lat?: number | string;
    driver_lng?: number | string;
  };
  rideStep: "assigned" | "arriving" | "in_trip" | "arrived";
  pickupText: string;
  dropText: string;
  pickupCoords?: [number, number];
  dropCoords?: [number, number];
  tripDistance: number;
  tripFare: number;
  onCancelRide?: () => void;
  onSosClick?: () => void;
  onTripFinished?: () => void;
}

export function LiveRideTrackingMap({
  booking,
  rideStep = "arriving",
  pickupText,
  dropText,
  pickupCoords = [21.876, 88.192],
  dropCoords = [21.868, 88.163],
  tripDistance,
  tripFare,
  onCancelRide,
  onSosClick,
  onTripFinished,
}: LiveRideTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeCasingRef = useRef<any>(null);
  const meterRef = useRef<LiveFareMeter>(new LiveFareMeter());

  const [driverPos, setDriverPos] = useState<[number, number]>(() => {
    if (booking?.driver_lat && booking?.driver_lng) {
      return [Number(booking.driver_lat), Number(booking.driver_lng)];
    }
    return [pickupCoords[0] + 0.003, pickupCoords[1] + 0.003];
  });
  const [liveMeterKm, setLiveMeterKm] = useState(0);
  const [liveMeterFare, setLiveMeterFare] = useState(tripFare);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [rating, setRating] = useState(5);
  const [rated, setRated] = useState(false);

  // Haversine distance for ETA calc
  const haversineKm = (a: [number, number], b: [number, number]) => {
    const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLon = ((b[1] - a[1]) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  // 1. Fetch real street-following road route from /api/route
  useEffect(() => {
    let cancelled = false;
    const target = rideStep === "in_trip" ? dropCoords : pickupCoords;
    const from = driverPos;
    fetch(`/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${target[0]}&toLng=${target[1]}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 1) {
          setRouteCoords(data.coordinates);
        } else {
          setRouteCoords([from, target]);
        }
      })
      .catch(() => {
        if (!cancelled) setRouteCoords([from, target]);
      });
    return () => {
      cancelled = true;
    };
  }, [rideStep, driverPos, pickupCoords, dropCoords]);

  // 2. Poll driver location & booking status every 3s
  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout;
    const poll = async () => {
      const bId = booking?.id || booking?.booking_number || booking?.bookingNumber;
      if (!bId || !mounted) return;
      try {
        const res = await fetch(`/api/bookings?id=${bId}`);
        const data = await res.json();
        const b = data?.booking;
        if (!b || !mounted) return;

        // If booking was completed or cancelled, trigger trip finish
        if (b.status === "completed" || b.status === "cancelled") {
          onTripFinished?.();
          return;
        }

        let dLat: number | null = null, dLng: number | null = null;
        if (b.driver_lat && b.driver_lng) { dLat = Number(b.driver_lat); dLng = Number(b.driver_lng); }
        else if (b.drivers?.latitude && b.drivers?.longitude) { dLat = Number(b.drivers.latitude); dLng = Number(b.drivers.longitude); }
        if (dLat && dLng) {
          setDriverPos([dLat, dLng]);
          const target = rideStep === "in_trip" ? dropCoords : pickupCoords;
          const distLeft = haversineKm([dLat, dLng], target);
          setEtaMinutes(Math.max(1, Math.round(distLeft / 0.25))); // ~15 km/h toto speed
          if (rideStep === "in_trip") {
            const upd = meterRef.current.addGpsReading(dLat, dLng);
            if (upd.totalKm > 0) { setLiveMeterKm(upd.totalKm); setLiveMeterFare(upd.liveFare); }
          }
        }
      } catch {}
      if (mounted) timer = setTimeout(poll, 3000);
    };
    poll();
    return () => { mounted = false; clearTimeout(timer); };
  }, [booking?.id, booking?.booking_number, booking?.bookingNumber, rideStep, pickupCoords, dropCoords, onTripFinished]);

  // 3. Init Leaflet map with high-resolution street tiles and street-level zoom
  useEffect(() => {
    let mounted = true;
    const initMap = async () => {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await getLeaflet();
      if (!mounted) return;

      if (!mapInstanceRef.current) {
        (mapContainerRef.current as any)._leaflet_id = null;
        const map = L.map(mapContainerRef.current, {
          center: driverPos,
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          dragging: true,
        });

        // Google Maps street layer with high-res crisp street tiles
        L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        }).addTo(map);

        // Pickup pin
        L.marker(pickupCoords, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
              <div style="background:#059669;color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;white-space:nowrap;border:2px solid white;margin-bottom:3px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">📍 পিকআপ</div>
              <div style="width:20px;height:20px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(16,185,129,0.6);"></div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);

        // Drop pin
        L.marker(dropCoords, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
              <div style="background:#dc2626;color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;white-space:nowrap;border:2px solid white;margin-bottom:3px;box-shadow:0 3px 8px rgba(0,0,0,0.3);">🏁 গন্তব্য</div>
              <div style="width:20px;height:20px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(239,68,68,0.6);"></div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);

        // Moving toto driver marker with Uber-style radar pulse ring
        const totoIcon = L.divIcon({
          className: "",
          html: `<div style="transform:translate(-50%,-50%);position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:64px;height:64px;background:rgba(16,185,129,0.22);border-radius:50%;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;width:48px;height:48px;background:rgba(5,150,105,0.3);border-radius:50%;"></div>
            <div style="position:relative;width:44px;height:44px;background:linear-gradient(135deg,#047857,#10b981);border:3px solid white;border-radius:50%;box-shadow:0 6px 16px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:24px;">🛺</div>
          </div>`,
          iconSize: [0, 0],
        });
        const dMarker = L.marker(driverPos, { icon: totoIcon, zIndexOffset: 1000 }).addTo(map);
        driverMarkerRef.current = dMarker;

        // Route casing (outer shadow line)
        const pts = routeCoords.length > 1 ? routeCoords : [driverPos, rideStep === "in_trip" ? dropCoords : pickupCoords];
        const casing = L.polyline(pts, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeCasingRef.current = casing;

        // Route polyline (inner solid street line)
        const line = L.polyline(pts, {
          color: rideStep === "in_trip" ? "#059669" : "#0284c7",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineRef.current = line;

        // Street zoom bounds
        try {
          const b = L.latLngBounds(pts);
          map.fitBounds(b, { padding: [80, 80], maxZoom: 17 });
        } catch {}

        mapInstanceRef.current = map;
      } else {
        // Animate driver marker
        if (driverMarkerRef.current) driverMarkerRef.current.setLatLng(driverPos);

        // Update route polyline
        const pts = routeCoords.length > 1 ? routeCoords : [driverPos, rideStep === "in_trip" ? dropCoords : pickupCoords];
        if (routeCasingRef.current) routeCasingRef.current.setLatLngs(pts);
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs(pts);
          routeLineRef.current.setStyle({ color: rideStep === "in_trip" ? "#059669" : "#0284c7" });
        }

        // Pan map smoothly to follow driver
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(driverPos, { animate: true, duration: 1.0 });
        }
      }
    };
    initMap();
    return () => { mounted = false; };
  }, [driverPos, pickupCoords, dropCoords, rideStep, routeCoords]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  const driverPhone = (booking?.driver_phone || booking?.driverPhone || "9593177885").replace(/\D/g, "").slice(-10);
  const otp = booking?.start_otp || booking?.startOtp || "";
  const totoNum = booking?.toto_number || booking?.totoNumber || booking?.uniqueId || "WB-96-T-8421";
  const driverName = booking?.driver_name || booking?.driverName || "সুন্দরবন চালক";
  const displayFare = rideStep === "in_trip" ? Math.round(liveMeterFare) : tripFare;
  const displayKm = rideStep === "in_trip" && liveMeterKm > 0 ? liveMeterKm.toFixed(2) : tripDistance.toFixed(1);

  // If ride is arrived/completed: Show completion modal
  if (rideStep === "arrived") {
    return (
      <div className="relative w-full h-[calc(100dvh-58px)] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md z-50">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🏁
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">গন্তব্যে পৌঁছে গেছেন!</h3>
            <p className="text-xs text-slate-500 mt-1 font-semibold">আপনার সুন্দরবন স্মার্ট টোটো যাত্রা সফলভাবে সমাপ্ত হয়েছে।</p>
          </div>

          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">চূড়ান্ত ভাড়া</span>
              <span className="text-2xl font-black text-emerald-900 font-mono">₹{displayFare}</span>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
              নগদে প্রদান করুন
            </span>
          </div>

          {/* Star Rating */}
          <div className="py-2 border-y border-slate-100 space-y-2">
            <span className="text-xs font-bold text-slate-700">চালক {driverName}-কে রেট দিন:</span>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star className={`w-8 h-8 ${star <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`} />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setRated(true);
              onTripFinished?.();
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-xl active:scale-[0.98] transition-all cursor-pointer"
          >
            ✓ সম্পূর্ণ (Done)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ height: "calc(100dvh - 58px)", background: "#f1f5f9" }}>

      {/* ── 1. FULL SCREEN LEAFLET STREET MAP ── */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── 2. TOP FLOATING STATUS HUD PILL ── */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3.5 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-slate-200/90">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <p className="text-xs font-black text-slate-900 leading-tight">
              {rideStep === "in_trip" ? "🛺 গন্তব্যে যাত্রা চলছে" : "🛺 চালক পিকআপে আসছেন"}
            </p>
            <p className="text-[10.5px] font-semibold leading-tight mt-0.5" style={{ color: rideStep === "in_trip" ? "#059669" : "#0284c7" }}>
              {etaMinutes !== null
                ? rideStep === "in_trip"
                  ? `লাইভ GPS ট্র্যাকিং • ${liveMeterKm.toFixed(2)} কিমি চলেছে`
                  : `আনুমানিক ~${etaMinutes} মিনিটে পৌঁছাবেন`
                : rideStep === "in_trip" ? "লাইভ GPS সক্রিয়" : "কাছাকাছি আসছেন..."}
            </p>
          </div>
        </div>

        {/* SOS Button */}
        {onSosClick && (
          <button
            type="button"
            onClick={onSosClick}
            className="pointer-events-auto w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}
            title="জরুরি SOS"
          >
            <ShieldAlert className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* ── 3. BOTTOM DRIVER & TRIP CARD (Uber style) ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-4 pointer-events-none">
        <div
          className="pointer-events-auto rounded-3xl overflow-hidden shadow-2xl border border-white/80"
          style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(24px)" }}
        >
          {/* Live meter bar (only when in_trip) */}
          {rideStep === "in_trip" && (
            <div className="px-4 pt-3.5 pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">লাইভ মিটার</span>
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  GPS সিঙ্ক সক্রিয়
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-2.5">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase block">অতিক্রান্ত দূরত্ব</span>
                  <span className="text-lg font-black text-emerald-900 tabular-nums">{displayKm} কিমি</span>
                </div>
                <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-2.5">
                  <span className="text-[9px] font-bold text-amber-800 uppercase block">চলমান নগদ ভাড়া</span>
                  <span className="text-lg font-black text-amber-900 tabular-nums">₹{displayFare}</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Driver header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
                  🛺
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900">{driverName}</h3>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">★ 4.9</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                    {totoNum}
                  </span>
                </div>
              </div>

              {/* Call & WhatsApp buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${driverPhone}`}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
                  title="কল করুন"
                >
                  <Phone className="w-4.5 h-4.5 text-white fill-white" />
                </a>
                <a
                  href={`https://wa.me/91${driverPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#25d366,#128c7e)" }}
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4.5 h-4.5 text-white fill-white" />
                </a>
              </div>
            </div>

            {/* Highlighted Ride OTP + Fare row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">রাইড OTP</span>
                  <span className="text-xl font-black font-mono tracking-widest text-amber-950 leading-none">{otp || "5821"}</span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-600 block">
                    {rideStep === "in_trip" ? "লাইভ ভাড়া" : "নির্ধারিত ভাড়া"}
                  </span>
                  <span className="text-xl font-black text-slate-900 leading-none">₹{displayFare}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">{displayKm} কিমি</span>
              </div>
            </div>

            {/* Pickup / Drop Route preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">{pickupText}</p>
              </div>
              <div className="w-px h-2.5 bg-slate-300 ml-1" />
              <div className="flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" />
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">{dropText}</p>
              </div>
            </div>

            {/* Cancel (only before trip starts) */}
            {rideStep !== "in_trip" && onCancelRide && (
              <button
                type="button"
                onClick={onCancelRide}
                className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
                রাইড বাতিল করুন
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
