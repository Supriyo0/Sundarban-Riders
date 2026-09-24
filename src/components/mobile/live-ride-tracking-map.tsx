"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Phone,
  MessageCircle,
  Copy,
  ShieldAlert,
  Navigation,
  CheckCircle2,
  Maximize2,
  LocateFixed,
  RefreshCw,
  Star,
  MapPin,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Compass,
  Milestone,
  Route as RouteIcon,
  ChevronRight,
  Sparkles,
  Shuffle,
  AlertTriangle,
  RotateCw,
  Smartphone,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { playSuccessSound } from "@/lib/mobile/sound";
import "leaflet/dist/leaflet.css";

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
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
  return Math.round(R * c * 10) / 10;
}

// Calculate minimum distance from a point to a route polyline
function getMinDistanceToRoute(point: [number, number], routeCoords: [number, number][]): number {
  if (!routeCoords || routeCoords.length === 0) return 0;
  let minD = 999999;
  for (let i = 0; i < routeCoords.length; i++) {
    const d = calculateDistanceKm(point[0], point[1], routeCoords[i][0], routeCoords[i][1]);
    if (d < minD) minD = d;
  }
  return minD;
}

export type RideJourneyStep = "assigned" | "arriving" | "in_trip" | "arrived";

export interface RouteData {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  routeSummaryBengali: string;
  primaryRoad: string;
  viaRoads: string;
  isAutoSwitched?: boolean;
  steps: Array<{
    road: string;
    distanceMeters: number;
    maneuver: string;
  }>;
}

interface LiveRideTrackingMapProps {
  booking: {
    id: string;
    driverName: string;
    driverPhone: string;
    totoNumber: string;
  };
  pickupCoords: [number, number];
  dropCoords: [number, number];
  pickupText: string;
  dropText: string;
  tripDistance: number;
  tripFare: number;
  selectedTier?: "standard" | "shared" | "reserved";
  paymentMode?: "cash" | "upi";
  rideStep: RideJourneyStep;
  onStepChange: (step: RideJourneyStep) => void;
  onFinishTrip: () => void;
  onCancelClick: () => void;
  onSosClick: () => void;
}

export function LiveRideTrackingMap({
  booking,
  pickupCoords,
  dropCoords,
  pickupText,
  dropText,
  tripDistance,
  tripFare,
  selectedTier = "standard",
  paymentMode = "cash",
  rideStep,
  onStepChange,
  onFinishTrip,
  onCancelClick,
  onSosClick,
}: LiveRideTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const arrivingPolylineRef = useRef<any>(null);
  const dropPolylineRef = useRef<any>(null);
  const isReroutingRef = useRef(false);

  // Initial driver position offset (simulating arriving from nearby road hub)
  const initialDriverPos = useRef<[number, number]>([
    pickupCoords[0] + 0.009,
    pickupCoords[1] + 0.008,
  ]);

  // Current Toto vehicle live position
  const [driverPos, setDriverPos] = useState<[number, number]>(initialDriverPos.current);
  const [mapLayer, setMapLayer] = useState<"streets" | "hybrid">("streets");
  const [mapViewOption, setMapViewOption] = useState<"inbuilt" | "google">("inbuilt");
  const [activeRouteView, setActiveRouteView] = useState<"arriving" | "drop">(
    rideStep === "in_trip" || rideStep === "arrived" ? "drop" : "arriving"
  );

  // Real Road Route Data
  const [arrivingRoute, setArrivingRoute] = useState<RouteData | null>(null);
  const [dropRoute, setDropRoute] = useState<RouteData | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [isAutoRerouting, setIsAutoRerouting] = useState(false);
  const [hasDeviatedAlert, setHasDeviatedAlert] = useState(false);

  // Live navigation metrics
  const [driverEtaMin, setDriverEtaMin] = useState(4);
  const [distanceToTargetKm, setDistanceToTargetKm] = useState(1.5);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Automatically adjust route view tab when rideStep updates
  useEffect(() => {
    if (rideStep === "in_trip" || rideStep === "arrived") {
      setActiveRouteView("drop");
    } else {
      setActiveRouteView("arriving");
    }
  }, [rideStep]);

  // Function to perform Auto Route Switch if rider takes a different route
  const triggerAutoRouteSwitch = useCallback(
    async (currentPos: [number, number], target: [number, number], phase: "arriving" | "drop") => {
      if (isReroutingRef.current) return;
      isReroutingRef.current = true;
      setIsAutoRerouting(true);

      try {
        const res = await fetch(
          `/api/route?fromLat=${currentPos[0]}&fromLng=${currentPos[1]}&toLat=${target[0]}&toLng=${target[1]}`
        );
        const data = await res.json();

        if (data && data.coordinates && data.coordinates.length > 0) {
          const updatedRoute: RouteData = {
            ...data,
            isAutoSwitched: true,
            routeSummaryBengali: `🔄 বিকল্প রুট: ${data.routeSummaryBengali}`,
          };

          if (phase === "arriving") {
            setArrivingRoute(updatedRoute);
            setDistanceToTargetKm(data.distanceKm);
            setDriverEtaMin(data.durationMin);
            if (arrivingPolylineRef.current) {
              arrivingPolylineRef.current.setLatLngs(data.coordinates);
            }
          } else {
            setDropRoute(updatedRoute);
            setDistanceToTargetKm(data.distanceKm);
            setDriverEtaMin(data.durationMin);
            if (dropPolylineRef.current) {
              dropPolylineRef.current.setLatLngs(data.coordinates);
            }
          }

          setHasDeviatedAlert(true);
          playSuccessSound();
          toast.success(
            `🔄 চালক ভিন্ন রাস্তা নিয়েছেন! ম্যাপ স্বয়ংক্রিয়ভাবে নতুন রুটে আপডেট হয়েছে (${data.distanceKm} কিমি, ~${data.durationMin} মিনিট)`
          );
        }
      } catch (err) {
        console.warn("Auto-reroute failed:", err);
      } finally {
        setIsAutoRerouting(false);
        setTimeout(() => {
          isReroutingRef.current = false;
        }, 3000);
      }
    },
    []
  );

  // 1. Initial Fetch of Real Road Routes
  useEffect(() => {
    let isCancelled = false;

    async function loadRoadRoutes() {
      setIsLoadingRoutes(true);

      try {
        // Fetch Arriving Route (Driver's current position to Passenger Pickup)
        const arrRes = await fetch(
          `/api/route?fromLat=${initialDriverPos.current[0]}&fromLng=${initialDriverPos.current[1]}&toLat=${pickupCoords[0]}&toLng=${pickupCoords[1]}`
        );
        const arrData = await arrRes.json();

        // Fetch Drop Route (Pickup location to Passenger Drop location)
        const dropRes = await fetch(
          `/api/route?fromLat=${pickupCoords[0]}&fromLng=${pickupCoords[1]}&toLat=${dropCoords[0]}&toLng=${dropCoords[1]}`
        );
        const dData = await dropRes.json();

        if (!isCancelled) {
          if (arrData && arrData.coordinates) {
            setArrivingRoute(arrData);
            if (rideStep === "assigned" || rideStep === "arriving") {
              setDistanceToTargetKm(arrData.distanceKm);
              setDriverEtaMin(arrData.durationMin);
            }
          }

          if (dData && dData.coordinates) {
            setDropRoute(dData);
            if (rideStep === "in_trip") {
              setDistanceToTargetKm(dData.distanceKm);
              setDriverEtaMin(dData.durationMin);
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch road routes:", err);
      } finally {
        if (!isCancelled) setIsLoadingRoutes(false);
      }
    }

    loadRoadRoutes();

    return () => {
      isCancelled = true;
    };
  }, [pickupCoords, dropCoords, rideStep]);

  // 2. Real Driver GPS Tracking (Polls real live coordinates from database instead of mock movement)
  useEffect(() => {
    let gpsPollInterval: NodeJS.Timeout;

    const pollDriverRealLocation = async () => {
      if (!booking?.id) return;
      try {
        const res = await fetch(`/api/bookings?id=${booking.id}`);
        const data = await res.json();
        if (data.booking) {
          const d = data.booking.drivers;
          const lat = d?.latitude ? Number(d.latitude) : null;
          const lng = d?.longitude ? Number(d.longitude) : null;

          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            setDriverPos((prev) => {
              if (Math.abs(prev[0] - lat) > 0.0001 || Math.abs(prev[1] - lng) > 0.0001) {
                const target = rideStep === "in_trip" ? dropCoords : pickupCoords;
                const remainingKm = calculateDistanceKm(lat, lng, target[0], target[1]);
                setDistanceToTargetKm(remainingKm);
                setDriverEtaMin(Math.max(1, Math.round(remainingKm * 2.6)));

                // Check Deviation against planned road route
                const waypoints = rideStep === "in_trip" ? dropRoute?.coordinates : arrivingRoute?.coordinates;
                if (waypoints && waypoints.length > 0) {
                  const deviation = getMinDistanceToRoute([lat, lng], waypoints);
                  if (deviation > 0.15 && !isReroutingRef.current) {
                    triggerAutoRouteSwitch([lat, lng], target, rideStep === "in_trip" ? "drop" : "arriving");
                  }
                }
                return [lat, lng];
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    pollDriverRealLocation();
    gpsPollInterval = setInterval(pollDriverRealLocation, 3000);
    return () => clearInterval(gpsPollInterval);
  }, [booking?.id, rideStep, pickupCoords, dropCoords, arrivingRoute, dropRoute, triggerAutoRouteSwitch]);

  // 3. Update Leaflet markers and Polylines when routes or driverPos update
  useEffect(() => {
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(driverPos);
    }
  }, [driverPos]);

  useEffect(() => {
    if (arrivingPolylineRef.current && arrivingRoute?.coordinates) {
      arrivingPolylineRef.current.setLatLngs(arrivingRoute.coordinates);
    }
    if (dropPolylineRef.current && dropRoute?.coordinates) {
      dropPolylineRef.current.setLatLngs(dropRoute.coordinates);
    }
  }, [arrivingRoute, dropRoute]);

  // 4. Initialize Leaflet Tracking Map
  useEffect(() => {
    let isMounted = true;

    async function initTrackingMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await import("leaflet");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapContainerRef.current, {
        center: driverPos,
        zoom: 14,
        zoomControl: false,
      });

      const tileUrl =
        mapLayer === "hybrid"
          ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      L.tileLayer(tileUrl, {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // 1. Moving Toto Vehicle DivIcon (Uber/Rapido Caliber Animated)
      const totoVehicleIcon = L.divIcon({
        className: "moving-toto-vehicle-marker",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
            <div style="background: #0f172a; color: white; font-weight: 800; font-size: 10px; padding: 2.5px 8px; border-radius: 9999px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid #10b981; display: flex; align-items: center; gap: 4px;">
              <span>🛺 ${booking.driverName}</span>
              <span style="color: #34d399; font-family: monospace;">(${booking.totoNumber})</span>
            </div>
            <div style="position: relative; width: 42px; height: 42px; background: #ecfdf5; border: 3px solid #10b981; border-radius: 50%; box-shadow: 0 4px 14px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; font-size: 22px;">
              🛺
              <div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid #10b981; opacity: 0.6; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // 2. Pickup Pin (Green)
      const greenPickupIcon = L.divIcon({
        className: "tracking-pickup-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #059669; color: white; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
              📍 পিকআপ
            </div>
            <div style="width: 24px; height: 24px; background: #059669; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 3px 8px rgba(5,150,105,0.4); display: flex; align-items: center; justify-content: center;">
              <div style="width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // 3. Drop Pin (Red)
      const redDropIcon = L.divIcon({
        className: "tracking-drop-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #ef4444; color: white; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
              🏁 গন্তব্য
            </div>
            <div style="width: 26px; height: 26px; background: #dc2626; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 3px 8px rgba(239,68,68,0.4); display: flex; align-items: center; justify-content: center;">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // Add Markers
      pickupMarkerRef.current = L.marker(pickupCoords, { icon: greenPickupIcon }).addTo(map);
      dropMarkerRef.current = L.marker(dropCoords, { icon: redDropIcon }).addTo(map);
      driverMarkerRef.current = L.marker(driverPos, {
        icon: totoVehicleIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      // Add Real Road Polylines
      const arrCoords = arrivingRoute?.coordinates || [initialDriverPos.current, pickupCoords];
      arrivingPolylineRef.current = L.polyline(arrCoords, {
        color: "#0284c7",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        dashArray: "6, 8",
      }).addTo(map);

      const drpCoords = dropRoute?.coordinates || [pickupCoords, dropCoords];
      dropPolylineRef.current = L.polyline(drpCoords, {
        color: "#059669",
        weight: 6,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Fit bounds to show current relevant path
      try {
        const bounds = L.latLngBounds([driverPos, pickupCoords, dropCoords]);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      } catch {}

      mapInstanceRef.current = map;
    }

    initTrackingMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickupCoords, dropCoords, mapLayer]);

  // Center camera on Toto Vehicle
  const handleCenterOnDriver = useCallback(() => {
    if (mapInstanceRef.current && driverPos) {
      mapInstanceRef.current.flyTo(driverPos, 16, { duration: 1.0 });
    }
  }, [driverPos]);

  // Fit bounds to entire route
  const handleFitRoute = useCallback(() => {
    if (mapInstanceRef.current) {
      import("leaflet").then((L) => {
        const bounds = L.latLngBounds([driverPos, pickupCoords, dropCoords]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      });
    }
  }, [driverPos, pickupCoords, dropCoords]);

  // Focus view specifically on Arriving Route or Drop Route
  const handleSwitchRouteView = (view: "arriving" | "drop") => {
    setActiveRouteView(view);
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (view === "arriving") {
        const bounds = L.latLngBounds([driverPos, pickupCoords]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else {
        const bounds = L.latLngBounds([pickupCoords, dropCoords]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    });
  };

  // Simulate Driver taking a Different Route (Detour / Shortcut) for testing & real behavior verification
  const handleSimulateDifferentRoute = () => {
    toast.info("🔀 সিমুলেশন: চালক বিকল্প রাস্তায় বাঁক নিচ্ছেন...");

    // Shift driver coordinates onto a parallel road connector
    const shiftedPos: [number, number] = [
      driverPos[0] + 0.005,
      driverPos[1] + 0.004,
    ];
    setDriverPos(shiftedPos);

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng(shiftedPos);
    }

    const target =
      rideStep === "in_trip" || activeRouteView === "drop" ? dropCoords : pickupCoords;
    const phase =
      rideStep === "in_trip" || activeRouteView === "drop" ? "drop" : "arriving";

    triggerAutoRouteSwitch(shiftedPos, target, phase);
  };

  const currentActiveRoute = activeRouteView === "arriving" ? arrivingRoute : dropRoute;

  // Exact Dropping Clock Time and Total Remaining Minutes calculation
  const totalDropDurationMin = dropRoute?.durationMin || Math.max(6, Math.round(tripDistance * 3.5 + 2));
  const now = new Date();
  const estimatedDropDate = new Date(now.getTime() + totalDropDurationMin * 60000);
  const droppingTimeBangla = estimatedDropDate.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit", hour12: true });
  const droppingTimeEnglish = estimatedDropDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300 pb-36">
      {/* ------------------------------------------------------------- */}
      {/* 0. PROMINENT DROPPING TIME & ROUTE BANNER (Requested by User) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-4 rounded-3xl shadow-xl border border-emerald-400/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-amber-300 shrink-0 border border-white/20 shadow-inner">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-200 block">
                🏁 আনুমানিক ড্রপ টাইম (Dropping Time)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white tracking-tight">{droppingTimeBangla}</span>
                <span className="text-xs font-bold text-emerald-300">({droppingTimeEnglish})</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-300/40 px-2.5 py-1 rounded-xl">
              ~{totalDropDurationMin} মিনিট বাকি
            </span>
          </div>
        </div>

        {/* Drop Destination & Route Summary */}
        <div className="bg-black/25 backdrop-blur-sm rounded-2xl p-3 border border-white/10 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider flex items-center gap-1">
              <RouteIcon className="w-3 h-3 text-emerald-300" />
              <span>রোড রুট (Road Route):</span>
            </span>
            <span className="text-[11px] font-bold text-white">
              দূরত্ব: {tripDistance} কিমি
            </span>
          </div>
          <p className="font-bold text-sm text-white truncate flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 inline-block" />
            <span>গন্তব্য: {dropText}</span>
          </p>
          <p className="text-[11px] text-slate-300 font-medium truncate">
            🛣️ {dropRoute?.routeSummaryBengali || "ডায়মন্ড হারবার রোড (NH-117) ➔ মূল সংযোগ সড়ক হয়ে গন্তব্য"}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. LIVE ROAD NAVIGATION & AUTO ROUTE SWITCH BAR               */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-xl border border-slate-800 space-y-3">
        {/* Route Selector Switcher Tabs */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchRouteView("arriving")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeRouteView === "arriving"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30 scale-102"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>🚗 পিকআপে আসার রুট</span>
              {rideStep === "arriving" && (
                <span className="w-2 h-2 rounded-full bg-sky-200 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchRouteView("drop")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeRouteView === "drop"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-102"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>🏁 গন্তব্যে যাওয়ার রুট</span>
              {rideStep === "in_trip" && (
                <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping" />
              )}
            </button>
          </div>

          {/* Auto-Route Switch Indicator */}
          <div className="flex items-center gap-1">
            {isAutoRerouting ? (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                রুট পুনর্গণনা...
              </span>
            ) : currentActiveRoute?.isAutoSwitched ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                স্বয়ংক্রিয় রুট সুইচড
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono font-semibold">
                লাইভ রোড
              </span>
            )}
          </div>
        </div>

        {/* Detailed Route Path Breakdown (Bengali Road Guidance) */}
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                activeRouteView === "arriving"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}
            >
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">
                  {activeRouteView === "arriving"
                    ? "📍 চালকের আগমন পথ (Arriving Route):"
                    : "🏁 গন্তব্যের মূল সড়ক পথ (Drop Location Route):"}
                </span>

                {currentActiveRoute?.isAutoSwitched && (
                  <span className="text-[9px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md">
                    ভিন্ন রাস্তায় সুইচড ✓
                  </span>
                )}
              </div>

              <p className="text-sm font-black text-white leading-snug tracking-tight mt-0.5">
                {currentActiveRoute?.routeSummaryBengali ||
                  (activeRouteView === "arriving"
                    ? "কাকদ্বীপ স্টেশন রোড ➔ ডায়মন্ড হারবার রোড (NH-117) হয়ে আসছেন"
                    : "ডায়মন্ড হারবার রোড (NH-117) ➔ লট ৮ ফেরিঘাট রোড হয়ে গন্তব্য")}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar: ETA + Distance + Current Road */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-slate-800/80 rounded-2xl p-2 border border-slate-700/60">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">দূরত্ব</span>
              <span className="text-sm font-extrabold text-emerald-400">
                {currentActiveRoute?.distanceKm ? `${currentActiveRoute.distanceKm} কিমি` : `${distanceToTargetKm} কিমি`}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-2 border border-slate-700/60">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">আনুমানিক সময়</span>
              <span className="text-sm font-extrabold text-amber-300">
                {currentActiveRoute?.durationMin ? `~${currentActiveRoute.durationMin} মিনিট` : `~${driverEtaMin} মিনিট`}
              </span>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-2 border border-slate-700/60">
              <span className="text-[9px] text-slate-400 uppercase font-bold block">প্রধান সড়ক</span>
              <span className="text-xs font-bold text-slate-200 truncate block">
                {currentActiveRoute?.primaryRoad || "NH-117"}
              </span>
            </div>
          </div>

          {/* Quick Detour / Different Route Simulation Button */}
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              চালক রাস্তা পরিবর্তন করলে ম্যাপ স্বয়ংক্রিয়ভাবে রুট বদল করবে
            </span>
            <button
              type="button"
              onClick={handleSimulateDifferentRoute}
              disabled={isAutoRerouting}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-all active:scale-95"
            >
              <Shuffle className="w-3 h-3" />
              <span>বিকল্প রাস্তা টেস্ট করুন</span>
            </button>
          </div>
        </div>
      </div>

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

      {/* ------------------------------------------------------------- */}
      {/* 2. LIVE INTERACTIVE TRACKING MAP CONTAINER                     */}
      {/* ------------------------------------------------------------- */}
      {mapViewOption === "inbuilt" ? (
        <div className="relative w-full h-[330px] rounded-3xl overflow-hidden border-2 border-emerald-400 shadow-xl bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Top Status Banner (Uber/Rapido Live Indicator) */}
          <div className="absolute top-3 left-3 right-16 z-20">
            <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-xl border border-slate-700/60 flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <div className="text-xs truncate">
                {rideStep === "assigned" || rideStep === "arriving" ? (
                  <span>
                    চালক আসছেন: <strong className="text-emerald-400">{distanceToTargetKm} কিমি</strong> দূরে •{" "}
                    <strong className="text-amber-300">~{driverEtaMin} মিনিটে পিকআপ</strong>
                  </span>
                ) : rideStep === "in_trip" ? (
                  <span>
                    যাত্রা চলমান: <strong className="text-emerald-400">{distanceToTargetKm} কিমি</strong> বাকি •{" "}
                    <strong className="text-amber-300">~{driverEtaMin} মিনিটে গন্তব্যে</strong>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">✓ আপনি গন্তব্যে পৌঁছে গেছেন!</span>
                )}
              </div>
            </div>
          </div>

          {/* Top-Right Map Controls: Satellite Toggle */}
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              onClick={() => setMapLayer((p) => (p === "streets" ? "hybrid" : "streets"))}
              title="ম্যাপ ভিউ পরিবর্তন"
              className="w-9 h-9 bg-white/95 backdrop-blur hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 flex items-center justify-center transition-all active:scale-95"
            >
              <Layers className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {/* Bottom Floating Map Controls: Focus on Toto & Fit All */}
          <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCenterOnDriver}
              title="চলমান টোটোতে ফোকাস করুন"
              className="w-10 h-10 bg-white hover:bg-slate-50 text-emerald-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-95"
            >
              <LocateFixed className="w-5 h-5 text-emerald-600" />
            </button>

            <button
              type="button"
              onClick={handleFitRoute}
              title="সম্পূর্ণ রুট দেখুন"
              className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Google Maps Mode View with Embed & Navigation */
        <div className="space-y-3">
          <div className="relative w-full h-[330px] rounded-3xl overflow-hidden border-2 border-blue-400 shadow-xl bg-slate-100">
            <iframe
              title="Google Map Live View"
              src={`https://maps.google.com/maps?q=${(rideStep === "in_trip" ? dropCoords : pickupCoords)[0]},${(rideStep === "in_trip" ? dropCoords : pickupCoords)[1]}&hl=bn&z=15&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
            />
            {/* Overlay Navigation Button */}
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${driverPos[0]},${driverPos[1]}&destination=${(rideStep === "in_trip" ? dropCoords : pickupCoords)[0]},${(rideStep === "in_trip" ? dropCoords : pickupCoords)[1]}&travelmode=driving`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>🌐 গুগল ম্যাপস অ্যাপে নেভিগেশন খুলুন (Open Google Maps)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. LIVE JOURNEY STEPPER (Uber/Rapido Interactive Track)        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-500 uppercase tracking-wider text-[10px]">রাইড স্ট্যাটাস ট্র্যাকিং</span>
          <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            {rideStep === "assigned"
              ? "চালক নির্ধারিত"
              : rideStep === "arriving"
              ? "🚗 চালক পিকআপে আসছেন"
              : rideStep === "in_trip"
              ? "🛺 যাত্রা চলমান (টোটোতে আছেন)"
              : "🏁 গন্তব্যে পৌঁছেছেন ✓"}
          </span>
        </div>

        {/* Stepper Buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: "assigned", label: "নির্ধারিত", icon: "✓" },
            { id: "arriving", label: "আসছেন", icon: "🚗" },
            { id: "in_trip", label: "চলমান", icon: "🛺" },
            { id: "arrived", label: "পৌঁছেছেন", icon: "🏁" },
          ].map((step) => {
            const stepOrder = ["assigned", "arriving", "in_trip", "arrived"];
            const currentIdx = stepOrder.indexOf(rideStep);
            const thisIdx = stepOrder.indexOf(step.id);
            const isDone = thisIdx <= currentIdx;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  onStepChange(step.id as RideJourneyStep);
                  if (step.id === "in_trip") {
                    setActiveRouteView("drop");
                    playSuccessSound();
                    toast.success("যাত্রা শুরু হয়েছে! চালক আপনাকে গন্তব্যে নিয়ে যাচ্ছেন।");
                  } else if (step.id === "arrived") {
                    setActiveRouteView("drop");
                    playSuccessSound();
                    toast.success("গন্তব্যে পৌঁছেছেন! ট্রিপ সমাপ্ত করুন।");
                  }
                }}
                className={`p-2 rounded-2xl text-center border transition-all ${
                  isDone
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold"
                    : "bg-slate-50 text-slate-400 border-slate-200 font-medium hover:bg-slate-100"
                }`}
              >
                <div className="text-xs mb-0.5">{step.icon}</div>
                <div className="text-[10px] leading-tight">{step.label}</div>
              </button>
            );
          })}
        </div>
      </div>


      {/* ------------------------------------------------------------- */}
      {/* 5. DRIVER PROFILE CARD WITH CALL & WHATSAPP CHAT               */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center text-2xl shadow-sm shrink-0">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-sm text-slate-900">{booking.driverName}</h4>
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold flex items-center">
                  <Star className="w-2.5 h-2.5 fill-amber-500 mr-0.5" /> 4.9
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-700 text-xs block">
                {booking.totoNumber}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">সুন্দরবন অনুমোদিত চালক ✓</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Chat Button */}
            <a
              href={`https://wa.me/91${booking.driverPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                `নমস্কার ${booking.driverName}! আমি আপনার টোটো যাত্রী (#${booking.id})। আমার পিকআপ অবস্থান: ${pickupText}।`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
              title="WhatsApp-এ বার্তা পাঠান"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
            </a>

            {/* Direct Phone Call Button */}
            <a
              href={`tel:${booking.driverPhone}`}
              className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
              title="চালকের সাথে কথা বলুন"
            >
              <Phone className="w-4 h-4 fill-white" />
            </a>
          </div>
        </div>

        {/* Route Details */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">পিকআপ:</span>
              <span className="font-bold text-slate-800 ml-1">{pickupText}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">গন্তব্য:</span>
              <span className="font-bold text-slate-800 ml-1">{dropText}</span>
            </div>
          </div>
        </div>

        {/* Fare and Payment Mode */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-medium">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800">
              {selectedTier === "shared" ? "🛺⚡ শেয়ার্ড" : selectedTier === "reserved" ? "🛺✨ রিজার্ভ" : "🛺 স্ট্যান্ডার্ড"}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800">
              {paymentMode === "upi" ? "📱 UPI" : "💵 নগদ"}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 mr-1.5">মোট ভাড়া:</span>
            <span className="font-black text-slate-900 text-base">₹{tripFare}.০০</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. SAFETY SOS & SHARE LIVE TRIP BAR                           */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSosClick}
          className="p-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>জরুরি SOS সুরক্ষা</span>
        </button>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `🚨 আমার টোটো রাইড লাইভ ট্র্যাকিং:\n🛺 চালক: ${booking.driverName}\n📞 ফোন: ${booking.driverPhone}\n🔢 টোটো: ${booking.totoNumber}\n📍 পিকআপ: ${pickupText}\n🏁 গন্তব্য: ${dropText}\n🛣️ রুট: ${arrivingRoute?.routeSummaryBengali || "ডায়মন্ড হারবার রোড"}\nবুকিং আইডি: #${booking.id}`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
        >
          <Navigation className="w-4 h-4 text-blue-600" />
          <span>পরিবারকে শেয়ার করুন</span>
        </a>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 7. FINISH TRIP & CANCEL ACTIONS                                */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-2 pt-1">
        <Button
          size="lg"
          className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          onClick={onFinishTrip}
        >
          <span>🏁 ট্রিপ সমাপ্ত ও ডিজিটাল রসিদ দেখুন</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-9 font-semibold"
          onClick={onCancelClick}
        >
          বুকিং বাতিল করুন
        </Button>
      </div>
    </div>
  );
}
