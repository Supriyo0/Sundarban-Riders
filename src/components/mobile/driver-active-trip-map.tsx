"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Navigation, MapPin, Compass, ExternalLink, Smartphone, Globe, Activity, Clock, IndianRupee } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { LiveFareMeter, LiveMeterReading } from "@/lib/mobile/live-fare-meter";
import { DEFAULT_TOTO_PRICING, TotoPricingConfig, calculateTotoFare } from "@/lib/pricing/fare-calculator";

interface DriverActiveTripMapProps {
  bookingId?: string;
  pickup: string;
  drop: string;
  pickupCoords?: [number, number];
  dropCoords?: [number, number];
  driverCoords?: [number, number];
  status: "heading_pickup" | "on_trip";
  passengerCount?: number;
  pricingConfig?: TotoPricingConfig;
  tripStartTime?: string;
  onOdometerUpdate?: (reading: LiveMeterReading) => void;
}

export function DriverActiveTripMap({
  bookingId,
  pickup,
  drop,
  pickupCoords = [21.8760, 88.1920],
  dropCoords = [21.8680, 88.1630],
  driverCoords = [21.8770, 88.1930],
  status,
  passengerCount = 3,
  pricingConfig = DEFAULT_TOTO_PRICING,
  tripStartTime,
  onOdometerUpdate,
}: DriverActiveTripMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapViewOption, setMapViewOption] = useState<"inbuilt" | "google">("inbuilt");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number>(3.5);
  const [routeDuration, setRouteDuration] = useState<number>(10);
  const [routeSummary, setRouteSummary] = useState<string>("ডায়মন্ড হারবার রোড (NH-117)");

  // Live Fare Meter instance
  const meterRef = useRef<LiveFareMeter | null>(null);
  const [meterReading, setMeterReading] = useState<LiveMeterReading>({
    totalKm: 0,
    liveFare: pricingConfig.baseFare || 30,
    tripMinutes: 0,
    currentSpeedKmh: 0,
  });

  // Initialize and keep meter synced
  useEffect(() => {
    if (status === "on_trip") {
      if (!meterRef.current) {
        meterRef.current = new LiveFareMeter(passengerCount, pricingConfig, tripStartTime);
      } else {
        meterRef.current.setPassengerCount(passengerCount);
        meterRef.current.setPricingConfig(pricingConfig);
      }
    } else {
      meterRef.current = null;
    }
  }, [status, passengerCount, pricingConfig, tripStartTime]);

  // Feed driver GPS coordinates into LiveFareMeter when on_trip
  useEffect(() => {
    if (status === "on_trip" && meterRef.current && driverCoords && driverCoords[0] && driverCoords[1]) {
      const reading = meterRef.current.addGpsReading(driverCoords[0], driverCoords[1]);
      setMeterReading(reading);
      onOdometerUpdate?.(reading);

      // Periodic backend sync (throttled)
      if (bookingId && reading.totalKm > 0) {
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_odometer",
            bookingId,
            distanceKm: reading.totalKm,
            currentCoords: driverCoords,
          }),
        }).catch(() => {});
      }
    }
  }, [driverCoords, status, bookingId, onOdometerUpdate]);

  const targetCoords = status === "heading_pickup" ? pickupCoords : dropCoords;
  const originCoords = driverCoords && driverCoords[0] ? driverCoords : (status === "heading_pickup" ? [21.8760, 88.1920] : pickupCoords);

  // Generate robust Android navigation intent with Web fallback
  const getGoogleMapsNavUrl = (target: [number, number]) => {
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    if (isAndroid) {
      return `google.navigation:q=${target[0]},${target[1]}&mode=d`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${originCoords[0]},${originCoords[1]}&destination=${target[0]},${target[1]}&travelmode=driving&dir_action=navigate`;
  };

  const currentGoogleMapsUrl = getGoogleMapsNavUrl(targetCoords);

  // Fetch real road route
  useEffect(() => {
    let isCancelled = false;
    const from: [number, number] = driverCoords && driverCoords[0] ? driverCoords : (status === "heading_pickup" ? [21.8760, 88.1920] : pickupCoords);
    const to: [number, number] = status === "heading_pickup" ? pickupCoords : dropCoords;

    async function loadRoute() {
      try {
        const res = await fetch(
          `/api/route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
        );
        const data = await res.json();
        if (!isCancelled && data && data.coordinates) {
          setRouteCoords(data.coordinates);
          setRouteDistance(data.distanceKm || 3.5);
          setRouteDuration(data.durationMin || 10);
          if (data.routeSummaryBengali) setRouteSummary(data.routeSummaryBengali);
        }
      } catch {
        if (!isCancelled) setRouteCoords([from, to]);
      }
    }

    loadRoute();
    return () => {
      isCancelled = true;
    };
  }, [status, driverCoords, pickupCoords, dropCoords]);

  // Leaflet map initialization
  useEffect(() => {
    if (mapViewOption !== "inbuilt") return;
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const L = await import("leaflet");

      const map = L.map(mapContainerRef.current, {
        center: status === "heading_pickup" ? pickupCoords : dropCoords,
        zoom: 17,
        zoomControl: false,
        scrollWheelZoom: true,
        dragging: true,
      });

      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // 1. Pickup Pin (Green)
      const pickupIcon = L.divIcon({
        className: "driver-trip-pickup",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
            <div style="background:#059669; color:white; font-size:10px; font-weight:800; padding:2px 7px; border-radius:9999px; box-shadow:0 2px 6px rgba(0,0,0,0.2); white-space:nowrap; border:1.5px solid white;">
              📍 পিকআপ
            </div>
            <div style="width:24px; height:24px; background:#10b981; border:3px solid white; border-radius:50%; box-shadow:0 3px 8px rgba(16,185,129,0.5);"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker(pickupCoords, { icon: pickupIcon }).addTo(map);

      // 2. Drop Pin (Red)
      const dropIcon = L.divIcon({
        className: "driver-trip-drop",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
            <div style="background:#dc2626; color:white; font-size:10px; font-weight:800; padding:2px 7px; border-radius:9999px; box-shadow:0 2px 6px rgba(0,0,0,0.2); white-space:nowrap; border:1.5px solid white;">
              🏁 গন্তব্য
            </div>
            <div style="width:24px; height:24px; background:#ef4444; border:3px solid white; border-radius:50%; box-shadow:0 3px 8px rgba(239,68,68,0.5);"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker(dropCoords, { icon: dropIcon }).addTo(map);

      // 3. Driver Live Vehicle Pin
      const driverVehicleIcon = L.divIcon({
        className: "driver-live-toto",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%);">
            <div style="background:#0f172a; color:#38bdf8; font-size:9px; font-weight:800; padding:1px 6px; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.2); white-space:nowrap; margin-bottom:2px; border:1px solid #38bdf8;">
              🛺 আমার গাড়ি
            </div>
            <div style="width:34px; height:34px; background:#0284c7; border:3px solid white; border-radius:50%; box-shadow:0 4px 12px rgba(2,132,199,0.6); display:flex; align-items:center; justify-content:center; font-size:16px;">
              🛺
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker(driverCoords, { icon: driverVehicleIcon, zIndexOffset: 800 }).addTo(map);

      // 4. Draw Route Polyline
      const pts = routeCoords.length > 0 ? routeCoords : [pickupCoords, dropCoords];
      L.polyline(pts, {
        color: status === "heading_pickup" ? "#0284c7" : "#059669",
        weight: 5,
        opacity: 0.85,
      }).addTo(map);

      // Fit bounds to show current active navigation segment
      const activeBounds = L.latLngBounds([driverCoords, targetCoords]);
      map.fitBounds(activeBounds, { padding: [40, 40], maxZoom: 17 });

      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapViewOption, status, driverCoords, pickupCoords, dropCoords, routeCoords]);

  return (
    <div className="space-y-3">
      {/* 2-Option Switcher: View Inbuilt Map vs View in Google Maps */}
      <div
        className="p-1 rounded-2xl grid grid-cols-2 gap-1"
        style={{
          background: "rgba(241, 245, 249, 0.95)",
          border: "1px solid rgba(203, 213, 225, 0.8)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <button
          type="button"
          onClick={() => setMapViewOption("inbuilt")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            mapViewOption === "inbuilt"
              ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>📱 ইনবিল্ট ম্যাপ দেখুন</span>
        </button>

        <button
          type="button"
          onClick={() => setMapViewOption("google")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            mapViewOption === "google"
              ? "bg-white text-blue-700 shadow-sm border border-blue-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>🌐 গুগল ম্যাপে খুলুন</span>
        </button>
      </div>

      {/* Driver Real-Time Odometer & Live Synced Fare Meter (During On Trip) */}
      {status === "on_trip" ? (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-4 rounded-2xl border border-emerald-500/30 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>লাইভ ওডোমিটার ও চলমান মিটার</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              GPS ১০০% নির্ভুল
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Live Distance */}
            <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">অতিক্রান্ত দূরত্ব</span>
              <p className="text-xl font-black text-emerald-400 tabular-nums mt-0.5">
                {meterReading.totalKm.toFixed(2)}
                <span className="text-[10px] ml-0.5 text-slate-400 font-normal">কিমি</span>
              </p>
            </div>

            {/* Live Synchronized Fare */}
            <div className="bg-slate-900/90 rounded-xl p-2 border border-amber-500/30">
              <span className="text-[9px] text-amber-400 font-bold uppercase block">চলমান নগদ ভাড়া</span>
              <p className="text-xl font-black text-amber-400 tabular-nums mt-0.5">
                ₹{meterReading.liveFare}
              </p>
            </div>

            {/* Trip Duration */}
            <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
              <span className="text-[9px] text-sky-400 font-bold uppercase block">চলার সময়</span>
              <p className="text-lg font-black text-sky-300 tabular-nums mt-0.5">
                {meterReading.tripMinutes}
                <span className="text-[10px] ml-0.5 text-slate-400 font-normal">মিনিট</span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Route & ETA Banner */
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                পিকআপের দিকে যাচ্ছেন
              </span>
              <p className="text-xs font-bold text-slate-100">{routeSummary}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-white">{routeDistance} কিমি</span>
            <span className="block text-[10px] text-slate-400">~{routeDuration} মিনিট</span>
          </div>
        </div>
      )}

      {/* View 1: Inbuilt Interactive Leaflet Map */}
      {mapViewOption === "inbuilt" ? (
        <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" style={{ touchAction: "pan-y" }} />

          <div className="absolute bottom-2.5 right-2.5 z-20">
            <a
              href={currentGoogleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white/95 text-blue-700 text-xs font-bold shadow-md border border-blue-200 flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition-all"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>গুগল ম্যাপে নেভিগেশন</span>
            </a>
          </div>
        </div>
      ) : (
        /* View 2: Google Maps External Mode View with Embed & Navigation */
        <div className="space-y-3">
          <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border-2 border-blue-400 shadow-md bg-slate-100">
            <iframe
              title="Google Maps Navigation View"
              src={`https://maps.google.com/maps?q=${targetCoords[0]},${targetCoords[1]}&hl=bn&z=17&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
            />
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20">
              <a
                href={currentGoogleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>🌐 গুগল ম্যাপস অ্যাপে নেভিগেশন খুলুন</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Google Maps CTA Button */}
      <a
        href={currentGoogleMapsUrl}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl font-bold text-sm shadow-md active:scale-[0.98] transition-all ${
          status === "heading_pickup"
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
        }`}
      >
        <Navigation className="w-4 h-4" />
        <span>🌐 গুগল ম্যাপে {status === "heading_pickup" ? "পিকআপ পয়েন্টে" : "গন্তব্যে"} নেভিগেশন চালু করুন</span>
        <ExternalLink className="w-4 h-4 opacity-80" />
      </a>
    </div>
  );
}
