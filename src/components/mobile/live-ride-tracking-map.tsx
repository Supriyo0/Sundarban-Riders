"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Phone, MessageCircle, KeyRound, ShieldAlert, X, Star, RefreshCw, CheckCircle2, Clock, Navigation, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { LiveFareMeter } from "@/lib/mobile/live-fare-meter";
import { DEFAULT_TOTO_PRICING, TotoPricingConfig } from "@/lib/pricing/fare-calculator";

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
    trip_start_time?: string;
    tripStartTime?: string;
  };
  rideStep: "assigned" | "arriving" | "in_trip" | "arrived";
  pickupText: string;
  dropText: string;
  pickupCoords?: [number, number];
  dropCoords?: [number, number];
  tripDistance: number;
  tripFare: number;
  passengerCount?: number;
  pricingConfig?: TotoPricingConfig;
  onCancelRide?: () => void;
  onSosClick?: () => void;
  onTripFinished?: (completedData?: any) => void;
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
  passengerCount = 3,
  pricingConfig = DEFAULT_TOTO_PRICING,
  onCancelRide,
  onSosClick,
  onTripFinished,
}: LiveRideTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeCasingRef = useRef<any>(null);
  const meterRef = useRef<LiveFareMeter>(new LiveFareMeter(passengerCount, pricingConfig, booking?.trip_start_time || booking?.tripStartTime));

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

  // Live timer states: Real-time duration & clock synchronized to server trip_start_time
  const [syncedTripStartTime, setSyncedTripStartTime] = useState<string | null>(
    booking?.trip_start_time || booking?.tripStartTime || null
  );

  useEffect(() => {
    const s = booking?.trip_start_time || booking?.tripStartTime;
    if (s && s !== syncedTripStartTime) {
      setSyncedTripStartTime(s);
    }
  }, [booking?.trip_start_time, booking?.tripStartTime]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentClockTime, setCurrentClockTime] = useState("");

  // Draggable Bottom Slider Sheet State (Tap + Swipe gesture)
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const dragStartYRef = useRef<number | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    hasMovedRef.current = false;
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;
    const delta = clientY - dragStartYRef.current;
    if (Math.abs(delta) > 8) {
      hasMovedRef.current = true;
    }
  };

  const endDrag = (clientY?: number) => {
    if (dragStartYRef.current !== null && clientY !== undefined) {
      const delta = clientY - dragStartYRef.current;
      if (hasMovedRef.current) {
        if (sheetExpanded && delta > 20) {
          setSheetExpanded(false);
        } else if (!sheetExpanded && delta < -20) {
          setSheetExpanded(true);
        }
      }
    }
    dragStartYRef.current = null;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 120);
  };

  const toggleSheet = () => {
    if (hasMovedRef.current) return;
    setSheetExpanded((prev) => !prev);
  };


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
    if (rideStep !== "in_trip") return;
    const startStr = syncedTripStartTime || booking?.trip_start_time || booking?.tripStartTime;
    const startTs = startStr ? new Date(startStr).getTime() : Date.now();

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
  }, [rideStep, syncedTripStartTime, booking?.trip_start_time, booking?.tripStartTime]);

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

  // 2. Poll driver location, trip start time & booking status every 2.5s
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
          onTripFinished?.(b);
          return;
        }

        // Live trip start time synchronization
        if (b.trip_start_time) {
          setSyncedTripStartTime((prev) => prev || b.trip_start_time);
        } else if (b.feedback?.trip_start_time) {
          setSyncedTripStartTime((prev) => prev || b.feedback.trip_start_time);
        }

        // Live distance & fare synchronization from backend
        if (b.actual_distance_km) {
          setLiveMeterKm(Number(b.actual_distance_km));
        } else if (b.feedback?.live_distance_km) {
          setLiveMeterKm(Number(b.feedback.live_distance_km));
        }

        if (b.final_fare) {
          setLiveMeterFare(Number(b.final_fare));
        } else if (b.feedback?.live_fare) {
          setLiveMeterFare(Number(b.feedback.live_fare));
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
            if (upd.totalKm > 0) {
              setLiveMeterKm((prev) => Math.max(prev, upd.totalKm));
              setLiveMeterFare((prev) => Math.max(prev, upd.liveFare));
            }
          }
        }
      } catch {}
      if (mounted) timer = setTimeout(poll, 2500);
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

        // Route casing
        const pts = routeCoords.length > 1 ? routeCoords : [driverPos, rideStep === "in_trip" ? dropCoords : pickupCoords];
        const casing = L.polyline(pts, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeCasingRef.current = casing;

        // Route polyline
        const line = L.polyline(pts, {
          color: rideStep === "in_trip" ? "#059669" : "#0284c7",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineRef.current = line;

        // Fit street zoom bounds
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
  const displayFare = rideStep === "in_trip" && liveMeterFare > 0 ? Math.round(liveMeterFare) : tripFare;
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
                  className="p-1 text-2xl transition-transform active:scale-125"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }`}
                  />
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
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{rated ? "মূল্যায়ন সম্পন্ন" : "মূল্যায়ন জমা দিয়ে সমাপ্ত করুন"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100dvh-58px)] overflow-hidden bg-slate-900 select-none">
      {/* ── 1. FULL SCREEN MAP ── */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── 2. TOP FLOATING STATUS HUD PILL ── */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/90 max-w-[85%]">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-900 leading-tight flex items-center gap-1.5 truncate">
              <span>{rideStep === "in_trip" ? "🛺 যাত্রা চলছে (On Trip)" : "🛺 চালক পিকআপে আসছেন"}</span>
            </p>
            <p className="text-[10px] font-bold leading-tight mt-0.5 truncate" style={{ color: rideStep === "in_trip" ? "#059669" : "#0284c7" }}>
              {rideStep === "in_trip"
                ? `⏱️ ${formatDuration(elapsedSeconds)} • 📏 ${displayKm} কিমি • 💰 ₹${displayFare} • 🕒 ${currentClockTime || "লাইভ"}`
                : etaMinutes !== null
                ? `আনুমানিক ~${etaMinutes} মিনিটে পৌঁছাবেন`
                : "কাছাকাছি আসছেন..."}
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

      {/* ── 3. BOTTOM DRIVER & TRIP CARD (Uber style draggable slider) ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-2 sm:p-3 pb-3 pointer-events-none">
        {/* Floating Quick Map / Details Toggle Button */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={toggleSheet}
            className="pointer-events-auto bg-slate-900/95 hover:bg-black text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow-lg border border-white/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          >
            {sheetExpanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>ম্যাপ দেখুন (View Map)</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                <span>বিস্তারিত তথ্য (Trip Details)</span>
              </>
            )}
          </button>
        </div>

        <div
          className={`pointer-events-auto rounded-3xl overflow-hidden shadow-2xl border border-white/80 transition-all duration-300 ease-in-out select-none ${
            sheetExpanded ? "max-h-[86dvh] pb-8 overflow-y-auto" : "max-h-[150px] overflow-hidden"
          }`}
          style={{ background: "rgba(255,255,255,0.98)", backdropFilter: "blur(24px)" }}
        >
          {/* Interactive Drag / Tap Slider Handle */}
          <div
            role="button"
            tabIndex={0}
            onClick={toggleSheet}
            onTouchStart={(e) => startDrag(e.touches[0].clientY)}
            onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
            onTouchEnd={(e) => endDrag(e.changedTouches[0]?.clientY)}
            onMouseDown={(e) => startDrag(e.clientY)}
            onMouseUp={(e) => endDrag(e.clientY)}
            className="w-full py-2 cursor-pointer flex flex-col items-center justify-center gap-1 select-none group touch-none bg-slate-100/90 hover:bg-slate-200/90 border-b border-slate-200/80 transition-colors"
            title="স্লাইডার উপরে বা নিচে টানুন বা ট্যাপ করুন (Drag or tap to toggle)"
          >
            <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-emerald-500 rounded-full transition-colors" />
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-600 transition-colors">
              {sheetExpanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>মানচিত্র দেখতে নিচে নামান (Slide down for map)</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  <span className="text-emerald-700 font-black">
                    {rideStep === "in_trip"
                      ? `ভাড়া ₹${displayFare} • ${displayKm} কিমি • বিবরণ দেখতে উপরে তুলুন ⌃`
                      : "চালকের বিবরণ ও OTP দেখতে উপরে তুলুন ⌃"}
                  </span>
                </>
              )}
            </div>
          </div>

          {!sheetExpanded ? (
            /* COMPACT MINIMIZED STRIP */
            <div
              onClick={toggleSheet}
              className="p-3 flex items-center justify-between cursor-pointer bg-white/95 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                  🛺
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-slate-900 truncate">{driverName}</p>
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {totoNum}
                    </span>
                  </div>
                  <p className="text-[10.5px] font-bold text-emerald-600 truncate mt-0.5">
                    {rideStep === "in_trip"
                      ? `⏱️ ${formatDuration(elapsedSeconds)} • 📏 ${displayKm} কিমি • লাইভ মিটার`
                      : `রাইড OTP: ${otp || "5821"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900 block leading-tight">₹{displayFare}</span>
                  <span className="text-[9px] font-bold text-emerald-600">নগদ ভাড়া</span>
                </div>
                <a
                  href={`tel:${driverPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs bg-emerald-600 active:scale-95 transition-transform"
                  title="কল করুন"
                >
                  <Phone className="w-4 h-4 text-white fill-white" />
                </a>
              </div>
            </div>
          ) : (
            /* FULL EXPANDED VIEW */
            <>
              {/* ── 4-PILLAR LIVE TRAVELING HUD: DURATION, DISTANCE, TIME, FARE (When in_trip) ── */}
              {rideStep === "in_trip" && (
                <div className="px-3.5 pt-3 pb-2.5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-b border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        লাইভ ট্রিপ মিটার (Live Meter)
                      </span>
                    </div>
                    <span className="text-[9.5px] font-mono font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                      GPS রিয়েলটাইম সিঙ্ক
                    </span>
                  </div>

                  {/* 4 STATS GRID: Duration, Distance, Clock/Time, Fare */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* 1. Travelling Duration */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2 text-center">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tight block">সময়কাল</span>
                      <p className="text-base sm:text-lg font-black font-mono text-sky-400 tabular-nums leading-tight mt-0.5">
                        {formatDuration(elapsedSeconds)}
                      </p>
                      <span className="text-[8px] text-slate-400 block font-medium">মি : সে</span>
                    </div>

                    {/* 2. Travelling Distance */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2 text-center">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tight block">দূরত্ব</span>
                      <p className="text-base sm:text-lg font-black font-mono text-emerald-400 tabular-nums leading-tight mt-0.5">
                        {displayKm}
                      </p>
                      <span className="text-[8px] text-slate-400 block font-medium">কিমি</span>
                    </div>

                    {/* 3. Time (Current Clock) */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-2 text-center">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tight block">বর্তমান ঘড়ি</span>
                      <p className="text-xs sm:text-sm font-black font-mono text-amber-300 leading-tight mt-1 truncate">
                        {currentClockTime ? currentClockTime.replace(/:\d\d\s/, " ") : "--:--"}
                      </p>
                      <span className="text-[8px] text-amber-400/80 block font-medium truncate">
                        {etaMinutes ? `~${etaMinutes}মি গন্তব্য` : "লাইভ সময়"}
                      </span>
                    </div>

                    {/* 4. Live Fare */}
                    <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-2 text-center">
                      <span className="text-[8.5px] font-black text-emerald-300 uppercase tracking-tight block">ভাড়া</span>
                      <p className="text-base sm:text-lg font-black font-mono text-emerald-300 tabular-nums leading-tight mt-0.5">
                        ₹{displayFare}
                      </p>
                      <span className="text-[8px] text-emerald-400 block font-bold">নগদ প্রদেয়</span>
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

                {/* Ride OTP + Fare row */}
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
                        {rideStep === "in_trip" ? "লাইভ মিটার ভাড়া" : "নির্ধারিত ভাড়া"}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
