"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation, ExternalLink, Phone, MessageCircle, KeyRound, CheckCircle2, ShieldAlert, Clock, MapPin } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import "leaflet/dist/leaflet.css";
import { LiveFareMeter, LiveMeterReading } from "@/lib/mobile/live-fare-meter";
import { DEFAULT_TOTO_PRICING, TotoPricingConfig } from "@/lib/pricing/fare-calculator";
import { SwipeToConfirm } from "@/components/mobile/swipe-to-confirm";


function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

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
  pickupCoords = [21.5698, 88.2518],
  dropCoords = [21.5650, 88.2550],
  driverCoords,
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
  const destMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeCasingRef = useRef<any>(null);
  const meterRef = useRef<LiveFareMeter | null>(null);
  // Stable origin snapshot for route fetch — captured once per status change
  const routeOriginRef = useRef<[number, number] | null>(null);
  // Leaflet library ref (set on first map init, reused by route update effect)
  const leafletRef = useRef<any>(null);

  const [routeDistance, setRouteDistance] = useState(2.5);
  const [routeDuration, setRouteDuration] = useState(8);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeLoaded, setRouteLoaded] = useState(false);
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

  // Active continuous driver GPS tracking: Prioritize real live location over hardcoded defaults
  const [activeDriverCoords, setActiveDriverCoords] = useState<[number, number]>(() => {
    if (driverCoords && driverCoords[0] && driverCoords[0] !== 0 && driverCoords[0] !== 21.877) return driverCoords;
    if (typeof window !== "undefined") {
      const latStr = localStorage.getItem("sr_last_known_lat");
      const lngStr = localStorage.getItem("sr_last_known_lng");
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && lat !== 21.877) return [lat, lng];
      }
    }
    // If heading to pickup, do not place driver on top of pickup point with 0 distance
    if (pickupCoords && pickupCoords[0] && pickupCoords[0] !== 0) {
      return [pickupCoords[0] + 0.005, pickupCoords[1] + 0.005];
    }
    return [21.5698, 88.2518];
  });

  useEffect(() => {
    if (driverCoords && driverCoords[0] && driverCoords[0] !== 0 && driverCoords[0] !== 21.877) {
      setActiveDriverCoords(driverCoords);
    }
  }, [driverCoords]);

  // Direct continuous GPS watch on driver's mobile device during the trip (Capacitor Native + Web)
  const lastSyncRef = useRef<{ ts: number; coords: [number, number]; km: number }>({ ts: 0, coords: [0, 0], km: 0 });

  useEffect(() => {
    let watchId: number | null = null;
    let capWatchId: string | null = null;
    let isCancelled = false;

    const handleCoords = (latitude: number, longitude: number, accuracy?: number) => {
      if (latitude && longitude && latitude !== 0) {
        // Filter out coarse cell-tower jumps (> 400m)
        if (accuracy && accuracy > 400 && activeDriverCoords[0] !== 0) {
          return;
        }
        const coords: [number, number] = [latitude, longitude];
        setActiveDriverCoords(coords);

        // Cache last valid location in localStorage for low connection recovery
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("sr_last_known_lat", latitude.toString());
            localStorage.setItem("sr_last_known_lng", longitude.toString());
          }
        } catch {}

        // When heading to pickup, sync location to backend at most once every 4 seconds
        if (status === "heading_pickup" && bookingId) {
          const now = Date.now();
          if (now - lastSyncRef.current.ts >= 4000) {
            lastSyncRef.current.ts = now;
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
      }
    };

    const startWatching = async () => {
      // 1. Native platform (Capacitor) with resilient low-connection fallback
      if (Capacitor.isNativePlatform()) {
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 6000 })
          .then((pos) => {
            if (!isCancelled && pos?.coords) {
              handleCoords(pos.coords.latitude, pos.coords.longitude);
            }
          })
          .catch(() => {
            // Low-connection fallback: standard accuracy cell/WiFi
            Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
              .then((pos) => {
                if (!isCancelled && pos?.coords) {
                  handleCoords(pos.coords.latitude, pos.coords.longitude);
                }
              })
              .catch(() => {});
          });

        try {
          capWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 5000 },
            (position, err) => {
              if (isCancelled || err || !position?.coords) {
                // If high accuracy watch drops in low connection, try reading cached or non-high accuracy
                return;
              }
              handleCoords(position.coords.latitude, position.coords.longitude);
            }
          );
          return;
        } catch {}
      }

      // 2. Web / Browser platform with 2-tier fallback
      if (typeof window !== "undefined" && navigator.geolocation) {
        const fetchOneShot = (highAcc: boolean) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!isCancelled && pos?.coords) {
                handleCoords(pos.coords.latitude, pos.coords.longitude);
              }
            },
            () => {
              if (highAcc) {
                // Retry with standard accuracy (works under low signal/cell towers)
                fetchOneShot(false);
              }
            },
            { enableHighAccuracy: highAcc, timeout: highAcc ? 6000 : 12000, maximumAge: highAcc ? 0 : 30000 }
          );
        };

        fetchOneShot(true);

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            // FIX: was `!isCancelled` (inverted) — GPS watch never fired on web
            if (isCancelled || !pos?.coords) return;
            handleCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            // In case of watch error, attempt non-high accuracy one-shot
            fetchOneShot(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
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
  }, [bookingId, status]);

  const isMeteredTrip = !dropCoords || !dropCoords[0] || dropCoords[0] === 0 || (typeof drop === "string" && (drop.includes("মিটার") || drop.includes("বিনা গন্তব্য")));

  // Safe coordinate normalization
  const safePickup: [number, number] = (Array.isArray(pickupCoords) && pickupCoords.length === 2 && !isNaN(Number(pickupCoords[0])) && Number(pickupCoords[0]) !== 0)
    ? [Number(pickupCoords[0]), Number(pickupCoords[1])]
    : [21.8760, 88.1920];

  const safeDrop: [number, number] = (Array.isArray(dropCoords) && dropCoords.length === 2 && !isNaN(Number(dropCoords[0])) && Number(dropCoords[0]) !== 0)
    ? [Number(dropCoords[0]), Number(dropCoords[1])]
    : safePickup;

  const targetCoords: [number, number] = status === "heading_pickup" ? safePickup : safeDrop;

  const currentFrom: [number, number] = (activeDriverCoords?.[0] && activeDriverCoords[0] !== 0 && activeDriverCoords[0] !== 21.877)
    ? activeDriverCoords
    : (status === "heading_pickup" ? [safePickup[0] + 0.005, safePickup[1] + 0.005] : safePickup);

  const origin: [number, number] = currentFrom;

  // Build Google Maps turn-by-turn navigation URL
  const getNavUrl = (target: [number, number]) => {
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    if (isAndroid) return `google.navigation:q=${target[0]},${target[1]}&mode=d`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${target[0]},${target[1]}&travelmode=driving&dir_action=navigate`;
  };

  const navUrl = getNavUrl(targetCoords);

  // Live Fare Meter — feed GPS into meter when on_trip with persistence against reload/sleep
  useEffect(() => {
    if (status === "on_trip") {
      if (!meterRef.current) {
        let initialKm = 0;
        if (bookingId && typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem(`sr_odometer_${bookingId}`);
            if (saved) {
              const parsed = parseFloat(saved);
              if (!isNaN(parsed) && parsed > 0) initialKm = parsed;
            }
          } catch {}
        }
        meterRef.current = new LiveFareMeter(passengerCount, pricingConfig, tripStartTime, initialKm);
      }
    } else {
      meterRef.current = null;
    }
  }, [status, passengerCount, pricingConfig, tripStartTime, bookingId]);

  useEffect(() => {
    if (status === "on_trip" && meterRef.current && activeDriverCoords?.[0]) {
      const reading = meterRef.current.addGpsReading(activeDriverCoords[0], activeDriverCoords[1]);
      setMeterReading(reading);
      onOdometerUpdate?.(reading);

      if (bookingId && reading.totalKm > 0) {
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(`sr_odometer_${bookingId}`, reading.totalKm.toString());
          }
        } catch {}

        const now = Date.now();
        const kmDiff = Math.abs(reading.totalKm - lastSyncRef.current.km);
        if (now - lastSyncRef.current.ts >= 3500 || kmDiff >= 0.02) {
          lastSyncRef.current.ts = now;
          lastSyncRef.current.km = reading.totalKm;
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
    }
  }, [activeDriverCoords, status, bookingId, onOdometerUpdate]);

  // Stable reference to last fetched origin to prevent infinite fetching while ensuring road route updates
  const lastFetchedOriginRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const to: [number, number] = status === "heading_pickup" ? safePickup : safeDrop;
    if (!to || to[0] === 0 || isNaN(to[0])) return;

    const snapOrigin: [number, number] =
      activeDriverCoords?.[0] && activeDriverCoords[0] !== 0 && activeDriverCoords[0] !== 21.877
        ? activeDriverCoords
        : currentFrom;

    const last = lastFetchedOriginRef.current;
    const distMoved = last
      ? calculateDistanceKm(last[0], last[1], snapOrigin[0], snapOrigin[1])
      : 999;

    // If already have road route and haven't moved > 150m, skip re-fetching
    if (last && distMoved < 0.15 && routeCoords.length > 2) {
      return;
    }

    const fetchRoute = async (origin: [number, number]) => {
      try {
        const res = await fetch(
          `/api/route?fromLat=${origin[0]}&fromLng=${origin[1]}&toLat=${to[0]}&toLng=${to[1]}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.coordinates && Array.isArray(data.coordinates) && data.coordinates.length > 2) {
          setRouteCoords(data.coordinates);
          setRouteLoaded(true);
          lastFetchedOriginRef.current = origin;
        }
        if (data?.distanceKm) setRouteDistance(data.distanceKm);
        if (data?.durationMin) setRouteDuration(data.durationMin);
      } catch {
        // Silently preserve existing route on transient network glitch without drawing straight line
      }
    };

    const timer = setTimeout(() => fetchRoute(snapOrigin), 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, activeDriverCoords, safePickup, safeDrop]);


  // Leaflet map initialization (mounts once and remains stable without white screen)
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      try {
        const LMod = await import("leaflet");
        const L = (LMod as any).default || LMod;
        leafletRef.current = L; // store for later use in route update effect
        if (!mounted || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          if ((mapContainerRef.current as any)._leaflet_id) {
            (mapContainerRef.current as any)._leaflet_id = null;
          }

          const map = L.map(mapContainerRef.current, {
            center: currentFrom,
            zoom: 17,
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: true,
            dragging: true,
          });

          // Google Maps street layer with multi-subdomain rotation and pre-buffering
          L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
            maxZoom: 20,
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            keepBuffer: 8,
            updateWhenIdle: false,
          }).addTo(map);

          // Destination marker (render only when not a metered trip on journey)
          if (!(status === "on_trip" && isMeteredTrip)) {
            const dMarker = L.marker(targetCoords, {
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
            destMarkerRef.current = dMarker;
          }

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
          const drvMarker = L.marker(currentFrom, {
            icon: driverIcon,
            zIndexOffset: 1000,
          }).addTo(map);
          driverMarkerRef.current = drvMarker;

          // NOTE: Route polylines are NOT drawn here at init time.
          // They are drawn by the `routeLoaded` effect once the road route API responds.
          // This prevents a straight fallback line appearing before the real route loads.
          if (status === "on_trip" && isMeteredTrip) {
            map.setView(currentFrom, 16);
          } else {
            // Center map between driver and destination; route will be fitted once loaded
            try {
              const b = L.latLngBounds([currentFrom, targetCoords]);
              map.fitBounds(b, { padding: [70, 70], maxZoom: 17 });
            } catch {
              map.setView(currentFrom, 16);
            }
          }

          // Force Leaflet tile & layout recalculation on mount and after layout paints
          map.whenReady(() => {
            map.invalidateSize();
            setTimeout(() => map?.invalidateSize(), 100);
            setTimeout(() => map?.invalidateSize(), 300);
            setTimeout(() => map?.invalidateSize(), 600);
            setTimeout(() => map?.invalidateSize(), 1200);
          });

          mapInstanceRef.current = map;
        }
      } catch (err) {
        console.warn("Leaflet active trip init error:", err);
      }
    }
    init();

    // ResizeObserver ensures map redraws when container height/visibility toggles
    let ro: ResizeObserver | null = null;
    if (typeof window !== "undefined" && window.ResizeObserver && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      ro.observe(mapContainerRef.current);
    }

    return () => {
      mounted = false;
      if (ro) ro.disconnect();
    };
  }, []);

  // Update driver marker position on every GPS update (smooth tracking)
  useEffect(() => {
    if (!mapInstanceRef.current || !driverMarkerRef.current || !currentFrom?.[0]) return;
    try {
      driverMarkerRef.current.setLatLng(currentFrom);
      mapInstanceRef.current.invalidateSize();
    } catch {}
  }, [currentFrom?.[0], currentFrom?.[1]]);

  // Update route polyline and fit bounds ONLY when route data actually loads
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLoaded) return;
    try {
      const L = leafletRef.current;
      const pts = routeCoords.length > 1 ? routeCoords : [currentFrom, targetCoords];

      if (destMarkerRef.current && targetCoords?.[0]) {
        destMarkerRef.current.setLatLng(targetCoords);
      }

      if (routeCasingRef.current && routeLineRef.current) {
        // Route polylines already exist — just update them
        routeCasingRef.current.setLatLngs(pts);
        routeLineRef.current.setLatLngs(pts);
        routeLineRef.current.setStyle({ color: status === "heading_pickup" ? "#0284c7" : "#059669" });
      } else if (L && !(status === "on_trip" && isMeteredTrip)) {
        // Create polylines fresh if they don't exist yet (first route load)
        const casing = L.polyline(pts, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(mapInstanceRef.current);
        routeCasingRef.current = casing;

        const line = L.polyline(pts, {
          color: status === "heading_pickup" ? "#0284c7" : "#059669",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(mapInstanceRef.current);
        routeLineRef.current = line;
      }

      // Fit bounds to show full route
      if (L && pts.length > 1) {
        try {
          const b = L.latLngBounds(pts);
          mapInstanceRef.current.fitBounds(b, { padding: [70, 70], maxZoom: 17 });
        } catch {}
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLoaded, routeCoords, status]);

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
    <div className="relative w-full overflow-hidden select-none" style={{ minHeight: "100%", height: "100%", background: "#0f172a" }}>

      {/* ── 1. FULL-SCREEN LEAFLET NAVIGATION MAP ── */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ── 2. TOP FLOATING NAVIGATION HUD (Rapido Captain Style) ── */}
      <div className="absolute top-0 sm:top-2 left-0 right-0 z-30 p-3 pt-3 sm:pt-4 pointer-events-none space-y-2">
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
              {status === "on_trip" && (
                <span className="text-[10px] font-semibold text-slate-300 block truncate mt-0.5">
                  ⏱️ {formatDuration(elapsedSeconds)} • 📏 {meterReading.totalKm.toFixed(2)} কিমি • 💰 ₹{meterReading.liveFare}
                </span>
              )}
            </div>
          </div>

          {/* SINGLE DYNAMIC FLOATING SMALL GOOGLE MAP BUTTON */}
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 ml-1.5 px-3 py-2 rounded-xl font-black text-xs text-white shadow-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all flex items-center gap-1.5 border border-white/40 cursor-pointer"
            title={status === "heading_pickup" ? "গুগল ম্যাপে পিকআপে যান" : "গুগল ম্যাপে গন্তব্যে যান"}
          >
            <Navigation className="w-4 h-4 fill-white shrink-0" />
            <span className="whitespace-nowrap font-black text-xs">Google Map</span>
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
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                {/* 1. Travelling Duration */}
                <div className="bg-slate-800/80 rounded-2xl p-1.5 sm:p-2 text-center border border-white/5 min-w-0">
                  <span className="text-[8px] sm:text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block truncate">সময়কাল</span>
                  <p className="text-xs sm:text-base font-black text-sky-400 font-mono tabular-nums leading-tight mt-0.5 truncate">
                    {formatDuration(elapsedSeconds)}
                  </p>
                  <span className="text-[7.5px] sm:text-[8px] text-slate-400 block font-medium">মি : সে</span>
                </div>

                {/* 2. Travelling Distance */}
                <div className="bg-slate-800/80 rounded-2xl p-1.5 sm:p-2 text-center border border-white/5 min-w-0">
                  <span className="text-[8px] sm:text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block truncate">দূরত্ব</span>
                  <p className="text-xs sm:text-base font-black text-emerald-400 font-mono tabular-nums leading-tight mt-0.5 truncate">
                    {meterReading.totalKm.toFixed(2)}
                  </p>
                  <span className="text-[7.5px] sm:text-[8px] text-slate-400 block font-medium">কিমি</span>
                </div>

                {/* 3. Time (Current Clock) */}
                <div className="bg-slate-800/80 rounded-2xl p-1.5 sm:p-2 text-center border border-white/5 min-w-0">
                  <span className="text-[8px] sm:text-[8.5px] text-slate-400 font-bold uppercase tracking-tight block truncate">ঘড়ি</span>
                  <p className="text-[10px] sm:text-xs font-black text-amber-300 font-mono leading-tight mt-1 truncate">
                    {currentClockTime ? currentClockTime.replace(/:\d\d\s/, " ") : "--:--"}
                  </p>
                  <span className="text-[7.5px] sm:text-[8px] text-amber-400/80 block font-medium truncate">
                    {routeDuration ? `~${routeDuration}মি` : "লাইভ"}
                  </span>
                </div>

                {/* 4. Live Cash Fare */}
                <div className="bg-slate-800/80 rounded-2xl p-1.5 sm:p-2 text-center border border-amber-500/25 min-w-0">
                  <span className="text-[8px] sm:text-[8.5px] text-amber-400 font-black uppercase tracking-tight block truncate">ভাড়া</span>
                  <p className="text-xs sm:text-base font-black text-amber-400 font-mono tabular-nums leading-tight mt-0.5 truncate">
                    ₹{meterReading.liveFare}
                  </p>
                  <span className="text-[7.5px] sm:text-[8px] text-slate-400 block font-bold">টাকা</span>
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
                      onRequestOtpModal?.();
                    }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    📍 পিকআপে পৌঁছেছি • যাত্রী ওটিপি নিশ্চিত করুন
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestOtpModal}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                  >
                    <KeyRound className="w-4 h-4" />
                    যাত্রা শুরু ওটিপি / পিন লিখুন (Enter Ride PIN)
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
                    await onCompleteTrip?.(typeof meterReading.totalKm === "number" ? meterReading.totalKm : 0);
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
