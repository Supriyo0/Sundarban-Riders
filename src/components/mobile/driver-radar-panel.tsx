"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  LocateFixed,
  RefreshCw,
  User,
  Phone,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Radio,
  ArrowRight,
  History,
  TrendingUp,
  Receipt,
  Clock,
  Calendar,
  X,
  IndianRupee,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Calculate Haversine distance in km
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

interface DriverRadarPanelProps {
  driverSession: {
    phone?: string;
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    totoNumber?: string;
  } | null;
  isOnline: boolean;
  onAcceptRide: (booking: any) => void;
}

export function DriverRadarPanel({
  driverSession,
  isOnline,
  onAcceptRide,
}: DriverRadarPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const myMarkerRef = useRef<any>(null);
  const otherDriversMarkersRef = useRef<any[]>([]);
  const customerMarkersRef = useRef<any[]>([]);

  // Navigation Tab between Radar & Trip History
  const [activeTab, setActiveTab] = useState<"radar" | "trips">("radar");

  // Driver's own current GPS location
  const [driverCoords, setDriverCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [driverLocationName, setDriverLocationName] = useState<string>("কাকদ্বীপ স্টেশন রোড");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("এইমাত্র");
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Entities around driver
  const [otherDrivers, setOtherDrivers] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "customers" | "drivers">("all");
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);

  // Trip History State
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [tripStats, setTripStats] = useState<{
    totalTrips: number;
    completedTrips: number;
    totalEarnings: number;
    todayTripsCount: number;
    todayEarnings: number;
  }>({
    totalTrips: 0,
    completedTrips: 0,
    totalEarnings: 0,
    todayTripsCount: 0,
    todayEarnings: 0,
  });
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripFilter, setTripFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [selectedTripDetail, setSelectedTripDetail] = useState<any | null>(null);

  // 1. Fetch & update Driver's own real-time GPS location
  const updateDriverLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("আপনার ডিভাইসে GPS অবস্থান সমর্থিত নয়");
      return;
    }

    setIsUpdatingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newCoords: [number, number] = [latitude, longitude];

        setDriverCoords(newCoords);
        setGpsAccuracy(Math.round(accuracy));
        setLastUpdatedTime(new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }));

        // Center map to driver
        if (myMarkerRef.current) {
          myMarkerRef.current.setLatLng(newCoords);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(newCoords, 15, { duration: 1.0 });
        }

        // Reverse geocode driver address
        let resolvedName = `অবস্থান (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data && data.name) {
            resolvedName = data.name;
          }
        } catch {}

        setDriverLocationName(resolvedName);
        setIsUpdatingLocation(false);
        toast.success(`📍 আপনার বর্তমান অবস্থান আপডেট হয়েছে: ${resolvedName}`);

        // Persist real location to driver record in database
        if (driverSession?.driverId) {
          try {
            await fetch("/api/drivers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: driverSession.driverId,
                latitude,
                longitude,
                current_location_name: resolvedName,
                is_active: isOnline,
              }),
            });
          } catch {}
        }
      },
      (err) => {
        setIsUpdatingLocation(false);
        console.warn("Driver GPS warning:", err.message);
        if (err.code === 1) {
          toast.error("ব্রাউজারে লোকেশন অনুমতি (Allow) দিন যাতে আপনার বর্তমান অবস্থান স্বয়ংক্রিয়ভাবে পাওয়া যায়।");
        } else {
          toast.info("GPS সিগন্যাল দুর্বল, ম্যাপের ডিফল্ট অবস্থান ব্যবহৃত হচ্ছে।");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [driverSession?.driverId, isOnline]);

  // Proactively fetch driver GPS on component load
  useEffect(() => {
    updateDriverLocation();
  }, [updateDriverLocation]);

  // 2. Fetch Driver Trip History
  const fetchDriverTrips = useCallback(async () => {
    try {
      setLoadingTrips(true);
      const dId = driverSession?.driverId || "";
      const dPhone = driverSession?.driverPhone || driverSession?.phone || "";
      const res = await fetch(`/api/bookings?driver_id=${encodeURIComponent(dId)}&driver_phone=${encodeURIComponent(dPhone)}&history=true`);
      const data = await res.json();
      if (data.trips && Array.isArray(data.trips)) {
        setDriverTrips(data.trips);
      }
      if (data.stats) {
        setTripStats(data.stats);
      }
    } catch (err) {
      console.warn("Error fetching driver trips:", err);
    } finally {
      setLoadingTrips(false);
    }
  }, [driverSession?.driverId, driverSession?.driverPhone, driverSession?.phone]);

  useEffect(() => {
    if (activeTab === "trips") {
      fetchDriverTrips();
    }
  }, [activeTab, fetchDriverTrips]);

  // 3. Poll for other active drivers & waiting customers
  useEffect(() => {
    let pollTimer: NodeJS.Timeout;

    const fetchRadarEntities = async () => {
      try {
        // Fetch real registered drivers
        const dRes = await fetch("/api/drivers");
        const dJson = await dRes.json();
        if (dJson.drivers && Array.isArray(dJson.drivers)) {
          const others = dJson.drivers.filter((d: any) => {
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            const isMe = driverSession?.driverId && d.id === driverSession.driverId;
            return (
              !isMe &&
              d.name &&
              d.is_active !== false &&
              !isNaN(lat) &&
              lat !== 0 &&
              !isNaN(lng) &&
              lng !== 0
            );
          });
          setOtherDrivers(others);
        }

        // Fetch pending waiting customer bookings
        const bRes = await fetch("/api/bookings?status=pending");
        const bJson = await bRes.json();
        if (bJson.bookings && Array.isArray(bJson.bookings)) {
          setPendingBookings(bJson.bookings);
        } else if (bJson.booking) {
          setPendingBookings([bJson.booking]);
        } else {
          setPendingBookings([]);
        }
      } catch (err) {
        console.warn("Radar fetch error:", err);
      }
    };

    fetchRadarEntities();
    pollTimer = setInterval(fetchRadarEntities, 4000);

    return () => clearInterval(pollTimer);
  }, [driverSession?.driverId]);

  // 4. Render Leaflet Map
  useEffect(() => {
    let isMounted = true;
    if (activeTab !== "radar") return;

    async function initDriverMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await import("leaflet");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Map centered on driver
      const map = L.map(mapContainerRef.current, {
        center: driverCoords,
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // A. Driver's Own Vehicle Marker (Pulsing Emerald with vehicle label)
      const myVehicleIcon = L.divIcon({
        className: "driver-my-vehicle-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
            <div style="background: #047857; color: white; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
              ⭐ আমার টোটো (${driverSession?.totoNumber || "আমি"})
            </div>
            <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; inset: 0; background: #10b981; opacity: 0.35; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 32px; height: 32px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(5,150,105,0.6); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                🛺
              </div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      const myMarker = L.marker(driverCoords, { icon: myVehicleIcon, zIndexOffset: 1000 }).addTo(map);
      myMarkerRef.current = myMarker;

      // B. Plot Other Registered Active Drivers (Blue icons)
      otherDriversMarkersRef.current.forEach((m) => m.remove());
      otherDriversMarkersRef.current = [];

      if (filterMode !== "customers" && otherDrivers.length > 0) {
        otherDrivers.forEach((od) => {
          const lat = Number(od.latitude);
          const lng = Number(od.longitude);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          const dist = calculateDistanceKm(driverCoords[0], driverCoords[1], lat, lng);

          const otherDriverIcon = L.divIcon({
            className: "driver-other-pin",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
                <div style="background: white; border: 1.5px solid #2563eb; color: #1e40af; font-weight: 800; font-size: 9px; padding: 1px 6px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                  🛺 ${od.name || "চালক"} [${dist} কিমি]
                </div>
                <div style="width: 28px; height: 28px; background: #eff6ff; border: 2px solid #2563eb; border-radius: 50%; box-shadow: 0 2px 8px rgba(37,99,235,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">
                  🛺
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });

          const odm = L.marker([lat, lng], { icon: otherDriverIcon }).addTo(map);
          odm.on("click", () => {
            setSelectedEntity({ type: "driver", data: od, distance: dist });
          });
          otherDriversMarkersRef.current.push(odm);
        });
      }

      // C. Plot Nearby Waiting Customers (Orange/Red icons)
      customerMarkersRef.current.forEach((m) => m.remove());
      customerMarkersRef.current = [];

      if (filterMode !== "drivers" && pendingBookings.length > 0) {
        pendingBookings.forEach((b) => {
          const lat = b.pickup_lat ? Number(b.pickup_lat) : driverCoords[0] + 0.008;
          const lng = b.pickup_lng ? Number(b.pickup_lng) : driverCoords[1] + 0.006;
          const dist = calculateDistanceKm(driverCoords[0], driverCoords[1], lat, lng);

          const customerIcon = L.divIcon({
            className: "driver-customer-pin",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
                <div style="background: #f97316; color: white; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 8px rgba(249,115,22,0.4); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
                  👤 ${b.customer_name || "যাত্রী"} (₹${b.estimated_fare})
                </div>
                <div style="width: 30px; height: 30px; background: #ea580c; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(234,88,12,0.5); display: flex; align-items: center; justify-content: center; font-size: 15px;">
                  📍
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });

          const cm = L.marker([lat, lng], { icon: customerIcon, zIndexOffset: 500 }).addTo(map);
          cm.on("click", () => {
            setSelectedEntity({ type: "customer", data: b, distance: dist });
          });
          customerMarkersRef.current.push(cm);
        });
      }

      mapInstanceRef.current = map;
    }

    initDriverMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [driverCoords, otherDrivers, pendingBookings, filterMode, driverSession?.totoNumber, activeTab]);

  // Filtered trips list
  const filteredTrips = driverTrips.filter((t) => {
    if (tripFilter === "completed") return t.status === "completed";
    if (tripFilter === "cancelled") return t.status === "cancelled";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* 0. DRIVER PANEL TOP TAB SWITCHER                              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("radar")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "radar"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${activeTab === "radar" ? "text-emerald-600" : ""}`} />
          <span>লাইভ রেডার ও ডিউটি</span>
          {pendingBookings.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("trips")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "trips"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <History className={`w-3.5 h-3.5 ${activeTab === "trips" ? "text-blue-600" : ""}`} />
          <span>আমার সকল ট্রিপ ও আয়</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: LIVE RADAR & DUTY MAP VIEW                             */}
      {/* ============================================================= */}
      {activeTab === "radar" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Driver's Current Location Banner */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  আপনার বর্তমান অবস্থান (Live GPS)
                </span>
              </div>

              <button
                type="button"
                onClick={updateDriverLocation}
                disabled={isUpdatingLocation}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingLocation ? "animate-spin" : ""}`} />
                <span>অবস্থান রিফ্রেশ</span>
              </button>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                  {driverLocationName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                    {driverCoords[0].toFixed(4)}° N, {driverCoords[1].toFixed(4)}° E
                  </span>
                  {gpsAccuracy !== null && (
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      সঠিকতা: {gpsAccuracy}মি
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    আপডেট: {lastUpdatedTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Driver Radar Map */}
          <div className="relative w-full h-[300px] rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Top Floating Entity Filter Pills */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-slate-200 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all ${
                    filterMode === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  সব দেখান
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("customers")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 ${
                    filterMode === "customers"
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-orange-700 hover:bg-orange-50"
                  }`}
                >
                  <span>👤 যাত্রী ({pendingBookings.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("drivers")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 ${
                    filterMode === "drivers"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  <span>🛺 চালক ({otherDrivers.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={updateDriverLocation}
                title="আমার অবস্থানে সেন্টারিং করুন"
                className="w-10 h-10 bg-white hover:bg-slate-50 text-emerald-700 rounded-2xl shadow-md border border-slate-200 flex items-center justify-center pointer-events-auto active:scale-95"
              >
                <LocateFixed className="w-5 h-5 text-emerald-600" />
              </button>
            </div>

            {/* Selected Entity Popup Sheet inside Map */}
            {selectedEntity && (
              <div className="absolute bottom-3 left-3 right-3 z-30 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xl animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {selectedEntity.type === "customer" ? "অপেক্ষমান যাত্রী" : "অন্যান্য চালক"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedEntity(null)}
                    className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕ বন্ধ করুন
                  </button>
                </div>

                {selectedEntity.type === "customer" ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        👤 {selectedEntity.data.customer_name || "যাত্রী"}
                      </h4>
                      <span className="text-sm font-black text-emerald-700">
                        ₹{selectedEntity.data.estimated_fare || 50}.00
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      <p>📍 পিকআপ: <span className="font-bold text-slate-800">{selectedEntity.data.pickup_location}</span></p>
                      <p>🏁 গন্তব্য: <span className="font-bold text-slate-800">{selectedEntity.data.drop_location}</span></p>
                      <p className="text-emerald-700 font-bold text-[11px] mt-1">
                        🚀 আপনার থেকে {selectedEntity.distance} কিমি দূরে
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        onAcceptRide(selectedEntity.data);
                        setSelectedEntity(null);
                      }}
                      className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
                    >
                      ✅ এই রাইডটি গ্রহণ করুন
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-xs">
                    <h4 className="font-extrabold text-sm text-slate-900">
                      🛺 {selectedEntity.data.name || "চালক"} ({selectedEntity.data.toto_number})
                    </h4>
                    <p className="text-slate-600">
                      ফোন: {selectedEntity.data.phone || "অনলাইনে আছেন"}
                    </p>
                    <p className="text-blue-700 font-bold">
                      📍 আপনার থেকে {selectedEntity.distance} কিমি দূরে সক্রিয় আছেন
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waiting Customers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  নিকটবর্তী অপেক্ষমান যাত্রী ({pendingBookings.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">রিয়েলটাইম বুকিং</span>
            </div>

            {pendingBookings.length > 0 ? (
              <div className="space-y-2">
                {pendingBookings.map((b) => {
                  const bLat = b.pickup_lat ? Number(b.pickup_lat) : driverCoords[0] + 0.008;
                  const bLng = b.pickup_lng ? Number(b.pickup_lng) : driverCoords[1] + 0.006;
                  const distKm = calculateDistanceKm(driverCoords[0], driverCoords[1], bLat, bLng);

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-orange-300 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-slate-900">
                              {b.customer_name || "যাত্রী"}
                            </span>
                            <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                              #{b.booking_number}
                            </span>
                          </div>
                          <span className="text-xs text-emerald-700 font-bold block mt-0.5">
                            📍 {distKm} কিমি দূরে অপেক্ষমান
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-black text-emerald-700">
                            ₹{b.estimated_fare || 50}.00
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">নগদ ভাড়া</span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <p className="text-slate-800 line-clamp-1 font-medium">
                          <span className="text-emerald-700 font-bold mr-1">পিকআপ:</span>
                          {b.pickup_location}
                        </p>
                        <p className="text-slate-800 line-clamp-1 font-medium">
                          <span className="text-red-600 font-bold mr-1">গন্তব্য:</span>
                          {b.drop_location}
                        </p>
                      </div>

                      <Button
                        onClick={() => onAcceptRide(b)}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-transform"
                      >
                        <span>✅ রাইড গ্রহণ করুন</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-200 text-center space-y-2">
                <Radio className="w-8 h-8 text-emerald-600 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-700">
                  কাছাকাছি কোনো নতুন বুকিং এই মুহূর্তে খালি নেই
                </p>
                <p className="text-[11px] text-slate-500">
                  যাত্রী বুকিং করলেই সাথে সাথে আপনার স্ক্রিনে পপআপ ও নোটিফিকেশন আসবে।
                </p>
              </div>
            )}

            {/* Other Active Drivers Summary */}
            <div className="pt-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    আশেপাশে সক্রিয় অন্যান্য টোটো ({otherDrivers.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">৫ কিমি রেডিয়াস</span>
              </div>

              {otherDrivers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {otherDrivers.slice(0, 4).map((od) => {
                    const lat = Number(od.latitude);
                    const lng = Number(od.longitude);
                    const dKm = calculateDistanceKm(driverCoords[0], driverCoords[1], lat, lng);

                    return (
                      <div
                        key={od.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                            🛺
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1">{od.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono font-semibold">
                              {od.toto_number}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                          {dKm} কিমি
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic px-1">
                  ৫ কিমির মধ্যে অন্য কোনো চালক এই মুহূর্তে অনলাইন নেই।
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: DRIVER ALL TRIPS & EARNINGS VIEW                       */}
      {/* ============================================================= */}
      {activeTab === "trips" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Earnings & Trips Summary Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-linear-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-4 shadow-md space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> আজকের সংগৃহীত নগদ
              </span>
              <div className="text-2xl font-black">₹{tripStats.todayEarnings}.00</div>
              <p className="text-[11px] text-emerald-100 font-medium">
                আজকের সম্পন্ন: {tripStats.todayTripsCount}টি রাইড
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-600" /> মোট উপার্জিত ভাড়া
              </span>
              <div className="text-2xl font-black text-slate-900">₹{tripStats.totalEarnings}.00</div>
              <p className="text-[11px] text-slate-500 font-medium">
                মোট সম্পন্ন: {tripStats.completedTrips}টি ট্রিপ
              </p>
            </div>
          </div>

          {/* Trip History Header & Filters */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-sm text-slate-900">
                  বিগত ট্রিপের তালিকা ({driverTrips.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={fetchDriverTrips}
                disabled={loadingTrips}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTrips ? "animate-spin" : ""}`} />
                <span>রিফ্রেশ</span>
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setTripFilter("all")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  tripFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                সব ট্রিপ
              </button>
              <button
                type="button"
                onClick={() => setTripFilter("completed")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  tripFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                সম্পন্ন ({driverTrips.filter((t) => t.status === "completed").length})
              </button>
              <button
                type="button"
                onClick={() => setTripFilter("cancelled")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  tripFilter === "cancelled"
                    ? "bg-red-600 text-white shadow-xs"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                বাতিল ({driverTrips.filter((t) => t.status === "cancelled").length})
              </button>
            </div>
          </div>

          {/* Trips List */}
          {loadingTrips ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">ট্রিপের তথ্য লোড হচ্ছে...</p>
            </div>
          ) : filteredTrips.length > 0 ? (
            <div className="space-y-3">
              {filteredTrips.map((t) => {
                const dateFormatted = t.created_at
                  ? new Date(t.created_at).toLocaleDateString("bn-BD", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "তারিখ অনুপলব্ধ";

                const isCompleted = t.status === "completed";
                const isCancelled = t.status === "cancelled";
                const fareAmount = t.final_fare || t.estimated_fare || 50;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTripDetail(t)}
                    className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer space-y-3 active:scale-99"
                  >
                    {/* Header: ID, Date, Status */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                          #{t.booking_number}
                        </span>
                        <span className="text-slate-400 text-[11px]">{dateFormatted}</span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800"
                            : isCancelled
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isCompleted ? "✓ সম্পন্ন" : isCancelled ? "✕ বাতিল" : "⏳ চলমান"}
                      </span>
                    </div>

                    {/* Route */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-slate-800 font-semibold line-clamp-1">
                          {t.pickup_location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-slate-800 font-semibold line-clamp-1">
                          {t.drop_location}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Passenger & Fare */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.customer_name || "যাত্রী"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">
                          ₹{fareAmount}.00
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200 space-y-2">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">কোনো ট্রিপ পাওয়া যায়নি</p>
              <p className="text-xs text-slate-400">
                নতুন ট্রিপ গ্রহণ করলে তার বিস্তারিত তথ্য এখানে সংরক্ষিত থাকবে।
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TRIP DETAILS & RECEIPT MODAL                                */}
      {/* ------------------------------------------------------------- */}
      {selectedTripDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">ট্রিপের বিস্তারিত রসিদ</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTripDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Booking Header */}
            <div className="bg-slate-50 rounded-2xl p-4 text-center space-y-1">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                বুকিং নম্বর
              </span>
              <div className="text-xl font-black text-slate-900">
                #{selectedTripDetail.booking_number}
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-1 ${
                  selectedTripDetail.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : selectedTripDetail.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {selectedTripDetail.status === "completed"
                  ? "✓ ট্রিপ সফলভাবে সম্পন্ন"
                  : selectedTripDetail.status === "cancelled"
                  ? "✕ রাইড বাতিল"
                  : "⏳ ট্রিপ চলমান"}
              </span>
            </div>

            {/* Passenger & Date info */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">তারিখ ও সময়:</span>
                <span className="font-bold text-slate-800">
                  {selectedTripDetail.created_at
                    ? new Date(selectedTripDetail.created_at).toLocaleString("bn-BD")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">যাত্রীর নাম:</span>
                <span className="font-bold text-slate-800">
                  {selectedTripDetail.customer_name || "যাত্রী"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">যাত্রীর ফোন:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {selectedTripDetail.customer_phone || "-"}
                </span>
              </div>
            </div>

            {/* Route */}
            <div className="bg-slate-50 p-4 rounded-2xl space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">পিকআপ পয়েন্ট</span>
                  <span className="font-bold text-slate-800">{selectedTripDetail.pickup_location}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">গন্তব্য</span>
                  <span className="font-bold text-slate-800">{selectedTripDetail.drop_location}</span>
                </div>
              </div>
            </div>

            {/* Fare Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>বেস ফেয়ার (নিয়মিত):</span>
                <span>₹২০.০০</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>দূরত্ব ভিত্তিক ভাড়া:</span>
                <span>₹{(selectedTripDetail.final_fare || selectedTripDetail.estimated_fare || 50) - 20}.০০</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>মোট সংগৃহীত নগদ:</span>
                <span className="text-emerald-700">
                  ₹{selectedTripDetail.final_fare || selectedTripDetail.estimated_fare || 50}.০০
                </span>
              </div>
            </div>

            <Button
              onClick={() => setSelectedTripDetail(null)}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs"
            >
              বন্ধ করুন
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
