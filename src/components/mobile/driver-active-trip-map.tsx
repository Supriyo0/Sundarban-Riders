"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation, ExternalLink, Phone, MessageCircle, KeyRound, CheckCircle2, ShieldAlert, Clock, MapPin } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import "leaflet/dist/leaflet.css";
import { LiveFareMeter, LiveMeterReading } from "@/lib/mobile/live-fare-meter";
import { DEFAULT_TOTO_PRICING, TotoPricingConfig } from "@/lib/pricing/fare-calculator";
import { SwipeToConfirm } from "@/components/mobile/swipe-to-confirm";

interface DriverActiveTripMapProps {
  bookingId?: string;
  bookingNumber?: string;
  pickup: string;
  drop: string;
  pickupCoords?: [number, number];
  dropCoords?: [number, number];
  driverCoords?: [number, number];
  status: "heading_pickup" | "on_trip";
  passengerName?: string;
  passengerPhone?: string;
  passengerCount?: number;
  pricingConfig?: TotoPricingConfig;
  tripStartTime?: string;
  onArrivedAtPickup?: () => void;
  onRequestOtpModal?: () => void;
  onCompleteTrip?: (finalOdometerKm?: number) => Promise<void>;
  onOdometerUpdate?: (reading: LiveMeterReading) => void;
}

export function DriverActiveTripMap({
  bookingId,
  bookingNumber,
  pickup,
  drop,
  pickupCoords = [21.876, 88.192],
  dropCoords = [21.868, 88.163],
  driverCoords = [21.877, 88.193],
  status,
  passengerName = "যাত্রী",
  passengerPhone = "",
  passengerCount = 3,
  pricingConfig = DEFAULT_TOTO_PRICING,
  tripStartTime,
  onArrivedAtPickup,
  onRequestOtpModal,
  onCompleteTrip,
  onOdometerUpdate,
}: DriverActiveTripMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeCasingRef = useRef<any>(null);
  const meterRef = useRef<LiveFareMeter | null>(null);

  const [routeDistance, setRouteDistance] = useState(2.5);
  const [routeDuration, setRouteDuration] = useState(8);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [meterReading, setMeterReading] = useState<LiveMeterReading>({
    totalKm: 0,
    liveFare: 34,
    tripMinutes: 0,
    currentSpeedKmh: 0,
  });
  const [hasArrived, setHasArrived] = useState(false);

  // Live timer states: Real-time duration & clock
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentClockTime, setCurrentClockTime] = useState("");

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs.toString().padStart(2, "0")}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Real-time ticking interval for Travelling Duration & Clock
  useEffect(() => {
    if (status !== "on_trip") return;
    const startTs = tripStartTime ? new Date(tripStartTime).getTime() : Date.now();

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startTs) / 1000));
      setElapsedSeconds(diffSec);
      setCurrentClockTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status, tripStartTime]);

  // Active continuous driver GPS tracking
  const [activeDriverCoords, setActiveDriverCoords] = useState<[number, number]>(() => {
    if (driverCoords && driverCoords[0] && driverCoords[0] !== 0) return driverCoords;
    if (pickupCoords && pickupCoords[0] && pickupCoords[0] !== 0) return pickupCoords;
    return [21.876, 88.192];
  });

  useEffect(() => {
    if (driverCoords && driverCoords[0] && driverCoords[0] !== 0) {
      setActiveDriverCoords(driverCoords);
    }
  }, [driverCoords]);

  // Direct continuous GPS watch on driver's mobile device during the trip (Capacitor Native + Web)
  useEffect(() => {
    let watchId: number | null = null;
    let capWatchId: string | null = null;
    let isCancelled = false;

    const handleCoords = (latitude: number, longitude: number) => {
      if (latitude && longitude && latitude !== 0) {
        const coords: [number, number] = [latitude, longitude];
        setActiveDriverCoords(coords);
        if (bookingId) {
          fetch("/api/bookings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sync_live_trip",
              bookingId,
              currentCoords: coords,
            }),
          }).catch(() => {});
        }
      }
    };

    const startWatching = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          capWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 0 },
            (position, err) => {
              if (isCancelled || err || !position?.coords) return;
              handleCoords(position.coords.latitude, position.coords.longitude);
            }
          );
        } catch {}
      }

      if (typeof window !== "undefined" && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (isCancelled || !pos?.coords) return;
            handleCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    };

    startWatching();

    return () => {
      isCancelled = true;
      if (watchId !== null && typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (capWatchId) {
        Geolocation.clearWatch({ id: capWatchId }).catch(() => {});
      }
    };
  }, [bookingId]);

  const targetCoords = status === "heading_pickup" ? pickupCoords : dropCoords;
  const origin = activeDriverCoords?.[0] ? activeDriverCoords : pickupCoords;

  // Build Google Maps turn-by-turn navigation URL
  const getNavUrl = (target: [number, number]) => {
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    if (isAndroid) return `google.navigation:q=${target[0]},${target[1]}&mode=d`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${target[0]},${target[1]}&travelmode=driving&dir_action=navigate`;
  };

  const navUrl = getNavUrl(targetCoords);

  // Live Fare Meter — feed GPS into meter when on_trip
  useEffect(() => {
    if (status === "on_trip") {
      if (!meterRef.current) {
        meterRef.current = new LiveFareMeter(passengerCount, pricingConfig, tripStartTime);
      }
    } else {
      meterRef.current = null;
    }
  }, [status, passengerCount, pricingConfig, tripStartTime]);

  useEffect(() => {
    if (status === "on_trip" && meterRef.current && activeDriverCoords?.[0]) {
      const reading = meterRef.current.addGpsReading(activeDriverCoords[0], activeDriverCoords[1]);
      setMeterReading(reading);
      onOdometerUpdate?.(reading);
      if (bookingId && reading.totalKm > 0) {
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_odometer",
            bookingId,
            distanceKm: reading.totalKm,
            currentCoords: activeDriverCoords,
          }),
        }).catch(() => {});
      }
    }
  }, [activeDriverCoords, status, bookingId, onOdometerUpdate]);

  // Fetch real street road route from /api/route
  useEffect(() => {
    let cancelled = false;
    const from: [number, number] = driverCoords?.[0] ? driverCoords : pickupCoords;
    const to: [number, number] = status === "heading_pickup" ? pickupCoords : dropCoords;
    fetch(`/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 1) {
          setRouteCoords(data.coordinates);
        }
        if (data?.distanceKm) setRouteDistance(data.distanceKm);
        if (data?.durationMin) setRouteDuration(data.durationMin);
      })
      .catch(() => {
        if (!cancelled) setRouteCoords([from, to]);
      });
    return () => {
      cancelled = true;
    };
  }, [status, driverCoords, pickupCoords, dropCoords]);

  // Leaflet map initialization with street-level zoom
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const LMod = await import("leaflet");
      const L = (LMod as any).default || LMod;
      if (!mounted) return;

      const currentFrom = driverCoords?.[0] ? driverCoords : (status === "heading_pickup" ? pickupCoords : dropCoords);

      if (!mapInstanceRef.current) {
        (mapContainerRef.current as any)._leaflet_id = null;
        const map = L.map(mapContainerRef.current, {
          center: currentFrom,
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          dragging: true,
        });

        // Google Maps street layer
        L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        }).addTo(map);

        // Destination marker
        L.marker(targetCoords, {
          icon: L.divIcon({
            className: "",
            html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
              <div style="background:${status === "heading_pickup" ? "#059669" : "#dc2626"};color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;box-shadow:0 3px 8px rgba(0,0,0,0.3);white-space:nowrap;border:2px solid white;margin-bottom:3px;">
                ${status === "heading_pickup" ? "📍 পিকআপ" : "🏁 গন্তব্য"}
              </div>
              <div style="width:22px;height:22px;background:${status === "heading_pickup" ? "#10b981" : "#ef4444"};border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.4);"></div>
            </div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);

        // Moving driver Toto marker with radar beacon
        const driverIcon = L.divIcon({
          className: "",
          html: `<div style="transform:translate(-50%,-50%);position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:64px;height:64px;background:rgba(2,132,199,0.25);border-radius:50%;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;width:48px;height:48px;background:rgba(2,132,199,0.35);border-radius:50%;"></div>
            <div style="position:relative;width:44px;height:44px;background:linear-gradient(135deg,#0284c7,#38bdf8);border:3px solid white;border-radius:50%;box-shadow:0 6px 16px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:24px;">🛺</div>
          </div>`,
          iconSize: [0, 0],
        });
        const dMarker = L.marker(currentFrom, {
          icon: driverIcon,
          zIndexOffset: 1000,
        }).addTo(map);
        driverMarkerRef.current = dMarker;

        // Street route casing
        const pts = routeCoords.length > 1 ? routeCoords : [currentFrom, targetCoords];
        const casing = L.polyline(pts, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeCasingRef.current = casing;

        // Street route line
        const line = L.polyline(pts, {
          color: status === "heading_pickup" ? "#0284c7" : "#059669",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineRef.current = line;

        // Fit map bounds to show driver and destination at street zoom
        try {
          const b = L.latLngBounds(pts);
          map.fitBounds(b, { padding: [70, 70], maxZoom: 17 });
        } catch {}

        mapInstanceRef.current = map;
      } else {
        // Smoothly update driver marker
        if (driverMarkerRef.current && activeDriverCoords?.[0]) {
          driverMarkerRef.current.setLatLng(activeDriverCoords);
          mapInstanceRef.current.panTo(activeDriverCoords, { animate: true, duration: 1.0 });
        }
        const pts = routeCoords.length > 1 ? routeCoords : [currentFrom, targetCoords];
        if (routeCasingRef.current) routeCasingRef.current.setLatLngs(pts);
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs(pts);
          routeLineRef.current.setStyle({ color: status === "heading_pickup" ? "#0284c7" : "#059669" });
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [activeDriverCoords, pickupCoords, dropCoords, status, routeCoords, targetCoords]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const cleanPhone = (passengerPhone || "").replace(/\D/g, "").slice(-10);

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ height: "calc(100dvh - 58px)", background: "#0f172a" }}>

      {/* ── 1. FULL-SCREEN LEAFLET NAVIGATION MAP ── */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── 2. TOP FLOATING NAVIGATION HUD (Rapido Captain Style) ── */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 pointer-events-none space-y-2">
        <div
          className="pointer-events-auto rounded-3xl p-3 shadow-2xl border border-white/20 flex items-center justify-between"
          style={{
            background: status === "heading_pickup"
              ? "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,58,95,0.93))"
              : "linear-gradient(135deg,rgba(5,46,22,0.95),rgba(20,83,45,0.93))",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner"
              style={{ background: status === "heading_pickup" ? "rgba(96,165,250,0.25)" : "rgba(52,211,153,0.25)" }}
            >
              {status === "heading_pickup" ? "📍" : "🛺"}
            </div>
            <div className="min-w-0 flex-1">
              <span
                className="text-[9.5px] font-black uppercase tracking-wider block"
                style={{ color: status === "heading_pickup" ? "#93c5fd" : "#6ee7b7" }}
              >
                {status === "heading_pickup" ? "পিকআপে যাচ্ছেন" : "গন্তব্যে যাত্রা চলছে (On Trip)"}
              </span>
              <p className="text-xs sm:text-sm font-extrabold text-white truncate mt-0.5">
                {status === "heading_pickup" ? pickup : drop}
              </p>
              <span className="text-[10px] font-semibold text-slate-300 block truncate mt-0.5">
                {status === "on_trip"
                  ? `⏱️ ${formatDuration(elapsedSeconds)} • 📏 ${meterReading.totalKm.toFixed(2)} কিমি • 💰 ₹${meterReading.liveFare}`
                  : `${routeDistance} কিমি • ~${routeDuration} মিনিট`}
              </span>
            </div>
          </div>

          {/* Quick Google Maps Button */}
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 ml-2 px-3 py-2 rounded-2xl font-black text-xs text-white shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            style={{
              background: status === "heading_pickup"
                ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                : "linear-gradient(135deg,#059669,#10b981)",
            }}
            title="গুগল ম্যাপে নেভিগেশন"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>নেভিগেশন</span>
          </a>
        </div>
      </div>

      {/* ── 3. BOTTOM FLOATING ACTION & METER SHEET (Rapido / Uber Driver) ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-4 pointer-events-none">
        <div
          className="pointer-events-auto rounded-3xl overflow-hidden shadow-2xl border border-white/80"
          style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(24px)" }}
        >
          {/* ── 4-PILLAR LIVE TRAVELING HUD: DURATION, DISTANCE, TIME, FARE (When on_trip) ── */}
          {status === "on_trip" && (
            <div className="px-3.5 pt-3 pb-2.5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white rounded-t-3xl border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  লাইভ মিটার সক্রিয় (GPS Odometer)
                </span>
                <span className="text-[9.5px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-white/10">
                  নিখুঁত রেট হিসাব
                </span>
              </div>

              {/* 4 STATS GRID: Duration, Distance, Clock/Time, Fare */}
              <div className="grid grid-cols-4 gap-1.5">
                {/* 1. Travelling Duration */}
                <div className="bg-slate-800/80 rounded-2xl p-2 text-center border border-white/5">
                  <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block">সময়কাল</span>
                  <p className="text-base sm:text-lg font-black text-sky-400 font-mono tabular-nums leading-tight mt-0.5">
                    {formatDuration(elapsedSeconds)}
                  </p>
                  <span className="text-[8px] text-slate-400 block font-medium">মি : সে</span>
                </div>

                {/* 2. Travelling Distance */}
                <div className="bg-slate-800/80 rounded-2xl p-2 text-center border border-white/5">
                  <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block">দূরত্ব</span>
                  <p className="text-base sm:text-lg font-black text-emerald-400 font-mono tabular-nums leading-tight mt-0.5">
                    {meterReading.totalKm.toFixed(2)}
                  </p>
                  <span className="text-[8px] text-slate-400 block font-medium">কিমি</span>
                </div>

                {/* 3. Time (Current Clock) */}
                <div className="bg-slate-800/80 rounded-2xl p-2 text-center border border-white/5">
                  <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block">বর্তমান ঘড়ি</span>
                  <p className="text-xs sm:text-sm font-black text-amber-300 font-mono leading-tight mt-1 truncate">
                    {currentClockTime ? currentClockTime.replace(/:\d\d\s/, " ") : "--:--"}
                  </p>
                  <span className="text-[8px] text-amber-400/80 block font-medium truncate">
                    {routeDuration ? `~${routeDuration}মি গন্তব্য` : "লাইভ সময়"}
                  </span>
                </div>

                {/* 4. Live Cash Fare */}
                <div className="bg-slate-800/80 rounded-2xl p-2 text-center border border-amber-500/25">
                  <span className="text-[8.5px] text-amber-400 font-black uppercase tracking-tight block">নগদ ভাড়া</span>
                  <p className="text-base sm:text-lg font-black text-amber-400 font-mono tabular-nums leading-tight mt-0.5">
                    ₹{meterReading.liveFare}
                  </p>
                  <span className="text-[8px] text-slate-400 block font-bold">টাকা</span>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Passenger Header + Direct Call & WhatsApp */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center text-xl font-black shadow-xs shrink-0">
                  👤
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black text-slate-900 truncate">{passengerName}</h4>
                  <p className="text-xs font-mono font-bold text-emerald-700">
                    +91 {cleanPhone || "9593177885"}
                  </p>
                </div>
              </div>

              {/* Call & WhatsApp buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${cleanPhone}`}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
                  title="যাত্রীকে ফোন করুন"
                >
                  <Phone className="w-4.5 h-4.5 text-white fill-white" />
                </a>
                <a
                  href={`https://wa.me/91${cleanPhone}`}
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

            {/* Target address pill */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status === "heading_pickup" ? "bg-emerald-500" : "bg-red-500"}`} />
              <p className="text-xs font-semibold text-slate-800 truncate">
                {status === "heading_pickup" ? `পিকআপ: ${pickup}` : `গন্তব্য: ${drop}`}
              </p>
            </div>

            {/* Actions depending on step */}
            {status === "heading_pickup" ? (
              <div className="space-y-2">
                {!hasArrived ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHasArrived(true);
                      onArrivedAtPickup?.();
                    }}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    পিকআপ লোকেশনে পৌঁছেছি (I Have Arrived)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestOtpModal}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                  >
                    <KeyRound className="w-4 h-4" />
                    যাত্রা শুরু ওটিপি লিখুন (Enter Ride OTP)
                  </button>
                )}
              </div>
            ) : (
              /* ON TRIP: Swipe to complete */
              <div className="pt-1">
                <SwipeToConfirm
                  label="যাত্রার শেষ প্রান্তে সোয়াইপ করুন 🏁"
                  confirmedLabel="ট্রিপ সম্পন্ন হচ্ছে..."
                  onConfirm={async () => {
                    await onCompleteTrip?.(meterReading.totalKm > 0 ? meterReading.totalKm : undefined);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
