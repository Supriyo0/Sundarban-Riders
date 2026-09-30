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
  ShieldCheck,
  Radio,
  ArrowRight,
  TrendingUp,
  Receipt,
  Clock,
  Calendar,
  X,
  IndianRupee,
  Layers,
  ChevronRight,
  AlertTriangle,
  Star,
  LogOut,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

function cleanLocation(text?: string | null): string {
  if (!text) return "নির্দিষ্ট করা হয়নি";
  return text.replace(/\s*\(GPS:[^)]*\)/i, "").trim();
}

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
    uniqueId?: string;
  } | null;
  isOnline: boolean;
  onAcceptRide: (booking: any) => void;
  onToggleOnline?: (nextState: boolean) => void;
  onLogout?: () => void;
  initialTab?: "radar" | "trips";
}

export function DriverRadarPanel({
  driverSession,
  isOnline,
  onAcceptRide,
  onToggleOnline,
  onLogout,
  initialTab = "radar",
}: DriverRadarPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const myMarkerRef = useRef<any>(null);
  const customerMarkersRef = useRef<any[]>([]);

  // Tab between Radar & Trip History
  const [activeTab, setActiveTab] = useState<"radar" | "trips">(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Map Tile Mode
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");

  // Driver GPS Location (Strict: null/0 if permission denied, no fake Kakdwip)
  const [driverCoords, setDriverCoords] = useState<[number, number]>([0, 0]);
  const [driverLocationName, setDriverLocationName] = useState<string>("");
  const [hasValidLocation, setHasValidLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Entities around driver
  const [otherDrivers, setOtherDrivers] = useState<any[]>([]);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

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
  const [selectedTripDetail, setSelectedTripDetail] = useState<any | null>(null);

  // 1. Fetch & update Driver's own real-time GPS location
  const updateDriverLocation = useCallback(async (userInitiated = false) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      const msg = "আপনার ডিভাইসে GPS অবস্থান সমর্থিত নয়";
      setLocationError(msg);
      if (userInitiated) toast.error(msg);
      return;
    }

    setIsUpdatingLocation(true);

    const handleDriverPosition = async (latitude: number, longitude: number) => {
      const newCoords: [number, number] = [latitude, longitude];
      setDriverCoords(newCoords);
      setHasValidLocation(true);
      setLocationError(null);

      // Center map & update driver Toto marker
      if (myMarkerRef.current) {
        myMarkerRef.current.setLatLng(newCoords);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(newCoords, 16, { duration: 1.0 });
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
      if (userInitiated) {
        toast.success(`📍 আপনার অবস্থান আপডেট হয়েছে: ${resolvedName}`);
      }

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
    };

    const handleFail = (err: GeolocationPositionError) => {
      setIsUpdatingLocation(false);
      setHasValidLocation(false);
      const msg =
        err.code === 1
          ? "⚠️ চালকের GPS পারমিশন বন্ধ আছে। রাইড পেতে ফোনের লোকেশন অন করুন।"
          : "⚠️ GPS সিগন্যাল পাওয়া যাচ্ছে না। অনুগ্রহ করে ফোনের লোকেশন/GPS অন করুন।";
      setLocationError(msg);
      setDriverLocationName("লোকেশন বন্ধ");
      // Do NOT set a fake random coordinate!
      setDriverCoords([0, 0]);

      if (userInitiated) {
        toast.error(msg, { duration: 5000 });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => handleDriverPosition(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => handleDriverPosition(fallbackPos.coords.latitude, fallbackPos.coords.longitude),
          (fallbackErr) => handleFail(fallbackErr),
          { enableHighAccuracy: false, timeout: 8000 }
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [driverSession?.driverId, isOnline]);

  useEffect(() => {
    updateDriverLocation(false);

    if (typeof window === "undefined" || !navigator.geolocation) return;

    // Continuous real live location tracking for driver radar
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude && longitude && latitude !== 0) {
          const newCoords: [number, number] = [latitude, longitude];
          setDriverCoords(newCoords);
          setHasValidLocation(true);
          setLocationError(null);

          if (myMarkerRef.current) {
            myMarkerRef.current.setLatLng(newCoords);
          }

          // Persist real live coordinates to database periodically
          if (driverSession?.driverId && isOnline) {
            fetch("/api/drivers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: driverSession.driverId,
                latitude,
                longitude,
                is_active: true,
              }),
            }).catch(() => {});
          }
        }
      },
      (err) => {
        console.warn("[DriverRadar] Continuous GPS watch notice:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 4000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updateDriverLocation, driverSession?.driverId, isOnline]);

  // 2. Fetch Driver Trip History & Today's Earnings
  const fetchDriverTrips = useCallback(async () => {
    try {
      setLoadingTrips(true);
      const dId = driverSession?.driverId || "";
      const dPhone = driverSession?.driverPhone || driverSession?.phone || "";
      const dUniqueId = driverSession?.uniqueId || driverSession?.totoNumber || "";
      const res = await fetch(
        `/api/bookings?driver_id=${encodeURIComponent(dId)}&driver_phone=${encodeURIComponent(dPhone)}&unique_id=${encodeURIComponent(dUniqueId)}&history=true`
      );
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
  }, [driverSession?.driverId, driverSession?.driverPhone, driverSession?.phone, driverSession?.uniqueId, driverSession?.totoNumber]);

  useEffect(() => {
    fetchDriverTrips();
  }, [fetchDriverTrips]);

  // 3. Poll for active drivers & waiting customers
  useEffect(() => {
    let pollTimer: NodeJS.Timeout;

    const fetchRadarEntities = async () => {
      try {
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

        const qParams = hasValidLocation && driverCoords[0] !== 0
          ? `?status=pending&driver_lat=${driverCoords[0]}&driver_lng=${driverCoords[1]}`
          : `?status=pending`;
        const bRes = await fetch(`/api/bookings${qParams}`);
        const bJson = await bRes.json();
        const rawBookings = bJson.bookings || (bJson.booking ? [bJson.booking] : []);
        // Strictly filter out any pending ride older than 3 minutes (180s) or taken by another driver or > 5 km
        const validPending = rawBookings.filter((b: any) => {
          if (b.status !== "pending") return false;
          if (b.driver_id) return false;
          if (b.created_at && Date.now() - new Date(b.created_at).getTime() > 180 * 1000) return false;
          if (hasValidLocation && driverCoords[0] !== 0) {
            const pLat = Number(b.pickup_lat || b.start_coords?.[0]);
            const pLng = Number(b.pickup_lng || b.start_coords?.[1]);
            if (pLat && pLng && !isNaN(pLat) && !isNaN(pLng)) {
              const dKm = calculateDistanceKm(driverCoords[0], driverCoords[1], pLat, pLng);
              if (dKm > 5.0) return false;
            }
          }
          return true;
        });
        setPendingBookings(validPending);
      } catch (err) {
        console.warn("Radar fetch error:", err);
      }
    };

    fetchRadarEntities();
    pollTimer = setInterval(fetchRadarEntities, 3500);

    return () => clearInterval(pollTimer);
  }, [driverSession?.driverId]);

  // 4. Initialize Full-Screen Leaflet Map
  useEffect(() => {
    let isMounted = true;
    if (activeTab !== "radar") return;

    async function initDriverMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
        return;
      }

      const L = (await import("leaflet")).default || (await import("leaflet"));

      if (mapContainerRef.current) {
        (mapContainerRef.current as any)._leaflet_id = null;
      }

      const initialCenter: [number, number] = hasValidLocation && driverCoords[0] !== 0
        ? driverCoords
        : [21.585, 88.251]; // Fraserganj region overview

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 16,
        zoomControl: false,
      });

      const streetUrl = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
      const tiles = L.tileLayer(streetUrl, {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Driver's Live Toto Marker (Only added if valid GPS coordinates)
      if (hasValidLocation && driverCoords[0] !== 0) {
        const driverTotoIcon = L.divIcon({
          className: "custom-driver-toto-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
              <div style="position: absolute; width: 48px; height: 48px; background: rgba(16,185,129,0.25); border-radius: 50%; animation: ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="width: 36px; height: 36px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 14px rgba(5,150,105,0.6); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white;">
                🛺
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });
        const dMarker = L.marker(driverCoords, { icon: driverTotoIcon }).addTo(map);
        myMarkerRef.current = dMarker;
      }

      if (isMounted) {
        mapInstanceRef.current = map;
      }

      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {}
      }, 200);
    }

    initDriverMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        myMarkerRef.current = null;
      }
    };
  }, [activeTab]);

  // Update Pending Customer Requests on Map
  useEffect(() => {
    if (!mapInstanceRef.current || activeTab !== "radar") return;

    import("leaflet").then((mod) => {
      const L = (mod as any).default || mod;

      customerMarkersRef.current.forEach((m) => m.remove());
      customerMarkersRef.current = [];

      pendingBookings.forEach((b) => {
        const lat = Number(b.pickup_lat);
        const lng = Number(b.pickup_lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        const dist = hasValidLocation && driverCoords[0] !== 0
          ? calculateDistanceKm(driverCoords[0], driverCoords[1], lat, lng)
          : null;

        const customerPin = L.divIcon({
          className: "custom-customer-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer;">
              <div style="background: #0f172a; color: white; font-weight: 800; font-size: 10.5px; padding: 3px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid #f59e0b; display: flex; align-items: center; gap: 3px;">
                <span>👤 ₹${b.estimated_fare || 40}</span>
                ${dist !== null ? `<span style="color:#94a3b8; font-size:9px;">• ${dist}km</span>` : ""}
              </div>
              <div style="width: 24px; height: 24px; background: #f59e0b; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(245,158,11,0.5); display: flex; align-items: center; justify-content: center;">
                <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });

        try {
          const marker = L.marker([lat, lng], { icon: customerPin }).addTo(mapInstanceRef.current);
          marker.on("click", () => {
            setSelectedCustomer({ ...b, distanceKm: dist });
            if (mapInstanceRef.current) mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 0.8 });
          });
          customerMarkersRef.current.push(marker);
        } catch {}
      });
    });
  }, [pendingBookings, driverCoords, hasValidLocation, activeTab]);

  // Toggle Map Style
  const toggleMapLayer = () => {
    const nextLayer = mapLayer === "streets" ? "satellite" : "streets";
    setMapLayer(nextLayer);

    if (tileLayerRef.current) {
      const newUrl =
        nextLayer === "streets"
          ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          : "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      tileLayerRef.current.setUrl(newUrl);
      toast.info(nextLayer === "streets" ? "🗺️ স্ট্রিট ভিউ সক্রিয়" : "🛰️ স্যাটেলাইট ভিউ সক্রিয়");
    }
  };

  // -------------------------------------------------------------
  // VIEW A: TRIP HISTORY & EARNINGS TAB (Matches Screenshot 2 Style)
  // -------------------------------------------------------------
  if (activeTab === "trips") {
    return (
      <div className="w-full h-full flex-1 overflow-y-auto p-4 space-y-4 pb-32 bg-slate-50 select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">আমার রাইড ও আয়</h2>
            <p className="text-xs text-slate-500 font-medium">আজকের সম্পন্ন ট্রিপ ও ডিজিটাল রসিদ</p>
          </div>
          <button
            type="button"
            onClick={fetchDriverTrips}
            disabled={loadingTrips}
            className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-600 ${loadingTrips ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Today's Earnings Summary Cards (Uber Captain Style) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg space-y-1">
            <span className="text-[11px] font-bold text-emerald-100 flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>আজকের মোট আয়</span>
            </span>
            <div className="text-2xl font-black font-mono">
              ₹{tripStats.todayEarnings}.০০
            </div>
            <span className="text-[10px] text-emerald-100 font-medium block">
              আজ {tripStats.todayTripsCount}টি ট্রিপ সম্পন্ন
            </span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>সর্বমোট আয়</span>
            </span>
            <div className="text-2xl font-black font-mono text-slate-900">
              ₹{tripStats.totalEarnings}.০০
            </div>
            <span className="text-[10px] text-slate-500 font-medium block">
              মোট {tripStats.completedTrips}টি সফল ট্রিপ
            </span>
          </div>
        </div>

        {/* Trips List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-900">পূর্ববর্তী ট্রিপসমূহ ({driverTrips.length})</h3>

          {loadingTrips ? (
            <div className="p-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">হিস্ট্রি লোড হচ্ছে...</p>
            </div>
          ) : driverTrips.length === 0 ? (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto">
                🛺
              </div>
              <h4 className="font-bold text-sm text-slate-900">এখনও কোনো ট্রিপ নেই</h4>
              <p className="text-xs text-slate-500">অনলাইন থাকুন, শীঘ্রই রাইড অনুরোধ আসবে!</p>
            </div>
          ) : (
            driverTrips.map((trip: any, idx: number) => {
              const dateStr = trip.created_at
                ? new Date(trip.created_at).toLocaleDateString("bn-BD", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "আজ";
              const isCompleted = trip.status === "completed";

              return (
                <div
                  key={trip.id || idx}
                  onClick={() => setSelectedTripDetail(trip)}
                  className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-2.5 transition-all hover:shadow-md cursor-pointer active:scale-[0.99] group"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        🛺
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">
                          #{trip.booking_number || trip.id?.slice(0, 8)}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium">{dateStr}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-emerald-700">
                        ₹{trip.final_fare || trip.estimated_fare || 30}.০০
                      </span>
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded block ${
                          isCompleted ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
                        }`}
                      >
                        {isCompleted ? "সম্পন্ন ✓" : "বাতিল"}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600">
                    <p className="truncate">
                      📍 পিকআপ: <strong className="text-slate-800">{cleanLocation(trip.pickup_location)}</strong>
                    </p>
                    <p className="truncate">
                      🏁 গন্তব্য: <strong className="text-slate-800">{cleanLocation(trip.drop_location)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-emerald-700 font-bold border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Receipt className="w-3 h-3" />
                      <span>রসিদ ও যাত্রীর বিবরণ দেখতে ট্যাপ করুন</span>
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detailed Trip Receipt Modal for Driver */}
        {selectedTripDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg font-black">
                    🛺
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">
                      #{selectedTripDetail.booking_number || selectedTripDetail.id?.slice(0, 8)}
                    </h3>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      ডিজিটাল ট্রিপ ভাউচার
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTripDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Fare & Status */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] text-slate-500 font-bold block">প্রাপ্ত ভাড়া</span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    ₹{selectedTripDetail.final_fare || selectedTripDetail.estimated_fare || 30}.০০
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${
                      selectedTripDetail.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedTripDetail.status === "completed" ? "সফল ট্রিপ ✓" : "বাতিল ট্রিপ"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedTripDetail.created_at
                      ? new Date(selectedTripDetail.created_at).toLocaleTimeString("bn-BD", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "আজ"}
                  </span>
                </div>
              </div>

              {/* Route Info */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">পিকআপ পয়েন্ট</span>
                    <span className="font-bold text-slate-800">
                      {cleanLocation(selectedTripDetail.pickup_location)}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">গন্তব্য পয়েন্ট</span>
                    <span className="font-bold text-slate-800">
                      {cleanLocation(selectedTripDetail.drop_location)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    👤
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {selectedTripDetail.customer_name || "যাত্রী বন্ধু"}
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      {selectedTripDetail.customer_phone ? `+91 ${selectedTripDetail.customer_phone.slice(-10)}` : "ফোন সংরক্ষিত"}
                    </span>
                  </div>
                </div>
                {selectedTripDetail.customer_phone && (
                  <a
                    href={`tel:${selectedTripDetail.customer_phone}`}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer"
                    title="যাত্রীকে কল করুন"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <Button
                type="button"
                onClick={() => setSelectedTripDetail(null)}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                বন্ধ করুন
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: 100% FULL-SCREEN UBER DRIVER RADAR HUD (IDLE & RADAR)
  // -------------------------------------------------------------
  return (
    <div className="relative w-full h-full min-h-[calc(100dvh-114px)] flex-1 overflow-hidden select-none bg-slate-100">
      {/* 1. EDGE-TO-EDGE FULL CANVAS NAVIGATION MAP */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. TOP FLOATING UBER DRIVER STATUS HUD */}
      <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none">
        <div className="pointer-events-auto rounded-3xl p-3 shadow-[0_10px_35px_rgba(0,0,0,0.14)] border border-slate-200/80 bg-white/95 backdrop-blur-xl flex items-center justify-between gap-2">
          {/* Driver Profile Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg font-black shrink-0">
              🛺
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs text-slate-900 truncate">
                  {driverSession?.driverName || "চালকের ড্যাশবোর্ড"}
                </span>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                  ★ 5.0
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 block truncate">
                🆔 {driverSession?.uniqueId || driverSession?.totoNumber || "SR-DRV"}
              </span>
            </div>
          </div>

          {/* Today's Earnings Pill & Online Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Earnings Pill */}
            <button
              type="button"
              onClick={() => setActiveTab("trips")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-black font-mono transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>₹{tripStats.todayEarnings}</span>
            </button>

            {/* Online / Offline Toggle Button */}
            <button
              type="button"
              onClick={() => onToggleOnline?.(!isOnline)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                isOnline
                  ? "bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-red-500"}`} />
              <span>{isOnline ? "অনলাইন" : "অফলাইন"}</span>
            </button>
          </div>
        </div>

        {/* Location Permission Warning Banner (If GPS Denied / Blocked) */}
        {locationError && (
          <div className="mt-2 pointer-events-auto p-2.5 rounded-2xl bg-amber-50/98 backdrop-blur-md border border-amber-300 text-amber-950 shadow-lg flex items-center justify-between gap-2 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold leading-tight line-clamp-2">
                {locationError}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateDriverLocation(true)}
              disabled={isUpdatingLocation}
              className="shrink-0 text-[10.5px] font-black bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-xl shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
            >
              {isUpdatingLocation ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
              <span>অনুমতি দিন</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. FLOATING MAP ON-SCREEN CONTROLS */}
      {/* Map Layer Switcher: Street vs Satellite */}
      <button
        type="button"
        onClick={toggleMapLayer}
        title={mapLayer === "streets" ? "স্যাটেলাইট ভিউ" : "স্ট্রিট ভিউ"}
        className="absolute bottom-48 right-3.5 z-20 pointer-events-auto w-11 h-11 bg-white/95 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
      >
        <Layers className="w-5 h-5 text-slate-700" />
      </button>

      {/* GPS Recenter Button */}
      <button
        type="button"
        onClick={() => updateDriverLocation(true)}
        disabled={isUpdatingLocation}
        title="আমার অবস্থান"
        className="absolute bottom-34 right-3.5 z-20 pointer-events-auto w-11 h-11 bg-white hover:bg-emerald-50 text-emerald-600 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
      >
        {isUpdatingLocation ? (
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        ) : (
          <LocateFixed className="w-5 h-5 text-emerald-600" />
        )}
      </button>

      {/* 4. SLIDING UBER DRIVER BOTTOM DRAWER */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto mx-2 sm:mx-3 mb-2 rounded-3xl bg-white/98 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.16)] border border-slate-200/90 p-4 space-y-3 animate-in slide-in-from-bottom-6 duration-300">
          {/* Drag Handle */}
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto" />

          {selectedCustomer ? (
            /* STATE A: A WAITING CUSTOMER HAS BEEN SELECTED ON MAP */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>অপেক্ষমান যাত্রী</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                >
                  ✕ বন্ধ করুন
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900">
                    👤 {selectedCustomer.customer_name || "যাত্রী"}
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {selectedCustomer.distanceKm !== null
                      ? `🚀 আপনার থেকে ~${selectedCustomer.distanceKm} কিমি দূরে`
                      : "কাছাকাছি এলাকা"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-emerald-700">
                    ₹{selectedCustomer.estimated_fare || 40}.০০
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block">নগদ ভাড়া</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5 text-slate-700">
                <p className="truncate">
                  📍 পিকআপ: <strong className="text-slate-900">{cleanLocation(selectedCustomer.pickup_location)}</strong>
                </p>
                <p className="truncate">
                  🏁 গন্তব্য: <strong className="text-slate-900">{cleanLocation(selectedCustomer.drop_location)}</strong>
                </p>
              </div>

              <Button
                size="lg"
                onClick={() => {
                  onAcceptRide(selectedCustomer);
                  setSelectedCustomer(null);
                }}
                className="w-full h-13 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-base shadow-xl active:scale-98 transition-all cursor-pointer"
              >
                ✅ রাইড গ্রহণ করুন (Accept Ride)
              </Button>
            </div>
          ) : (
            /* STATE B: IDLE / DRIVER WAITING FOR RIDE (UBER CAPTAIN STYLE) */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900 leading-tight">
                    {isOnline ? "🟢 আপনি অনলাইন আছেন" : "🔴 আপনি অফলাইন"}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-[260px]">
                    📍 {hasValidLocation && driverLocationName ? driverLocationName : "অবস্থান সনাক্ত হচ্ছে..."}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                  🛺
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-500 animate-ping" : "bg-red-400"}`} />
                  <span className="font-bold text-slate-700">
                    {isOnline
                      ? pendingBookings.length > 0
                        ? `ম্যাপে ${pendingBookings.length}টি রাইড অনুরোধ দৃশ্যমান`
                        : "রাইড অনুরোধের অপেক্ষায়... নতুন রাইড আসলে অ্যালার্ট বাজবে"
                      : "রাইড গ্রহণ করতে ওপরে অনলাইন বাটনে ট্যাপ করুন"}
                  </span>
                </div>
                {pendingBookings.length > 0 && (
                  <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg">
                    {pendingBookings.length}টি রাইড
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
