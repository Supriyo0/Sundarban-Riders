"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Search,
  Navigation,
  Compass,
  ArrowRight,
  Sparkles,
  Move,
  RefreshCw,
  LocateFixed,
  Car
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Landmark directory for fast, offline-resilient Sundarban location naming
const SUNDARBAN_LANDMARKS = [
  { name: "গোসাবা ফেরিঘাট", lat: 22.1652, lng: 88.8065, desc: "গোসাবা প্রধান ফেরি পয়েন্ট" },
  { name: "পাখিরালা বাজার", lat: 22.1485, lng: 88.8250, desc: "হোটেল ও ট্যুরিজম কেন্দ্র" },
  { name: "গদখালি জেটিঘাট", lat: 22.1932, lng: 88.7841, desc: "সুন্দরবনের প্রবেশদ্বার ঘাট" },
  { name: "সজনেখালি ফরেস্ট গেট", lat: 22.1280, lng: 88.8410, desc: "ন্যাশনাল পার্ক ওয়াচটাওয়ার" },
  { name: "দয়াপুর ঘাট", lat: 22.1390, lng: 88.8310, desc: "দয়াপুর নদী পারাপার" },
  { name: "সোনাখালি বাজার ও বাসস্ট্যান্ড", lat: 22.2150, lng: 88.7180, desc: "বাস ও টোটো সংযোগস্থল" },
  { name: "আমতলী বাজার", lat: 22.1580, lng: 88.7900, desc: "বাজার ও গ্রামীণ কেন্দ্র" },
  { name: "রাঙাবেলিয়া স্কুল মোড়", lat: 22.1720, lng: 88.8150, desc: "রাঙাবেলিয়া দ্বীপ" },
  { name: "ক্যানিং স্টেশন রোড", lat: 22.3120, lng: 88.6570, desc: "লোকাল ট্রেন ও টার্মিনাল" },
  { name: "বালি ১ নং বাজার", lat: 22.1150, lng: 88.8050, desc: "বালি দ্বীপ বাজার" }
];

// Calculate Haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius km
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

// Calculate standard Toto fare
function calculateFare(distanceKm: number) {
  const baseFare = 20;
  const perKm = 10;
  const rawFare = baseFare + distanceKm * perKm;
  // Round to nearest 5 or 10 rupees
  return Math.max(20, Math.ceil(rawFare / 5) * 5);
}

// Find nearest known landmark name
function getNearestLandmark(lat: number, lng: number) {
  let closest = SUNDARBAN_LANDMARKS[0];
  let minD = 999999;
  for (const lm of SUNDARBAN_LANDMARKS) {
    const d = calculateDistanceKm(lat, lng, lm.lat, lm.lng);
    if (d < minD) {
      minD = d;
      closest = lm;
    }
  }
  if (minD < 0.8) {
    return closest.name;
  }
  return `${closest.name} (কাছে)`;
}

interface InteractiveBookingMapProps {
  onRouteSelected: (route: {
    pickup: string;
    drop: string;
    distanceKm: number;
    estimatedFare: number;
    pickupCoords: [number, number];
    dropCoords: [number, number];
  }) => void;
  initialPickup?: string;
  initialDrop?: string;
}

export function InteractiveBookingMap({
  onRouteSelected,
  initialPickup = "গোসাবা ফেরিঘাট",
  initialDrop = "পাখিরালা বাজার",
}: InteractiveBookingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);

  // Default coordinate center (Gosaba, Sundarbans)
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([22.1652, 88.8065]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([22.1485, 88.8250]);
  const [pickupText, setPickupText] = useState(initialPickup);
  const [dropText, setDropText] = useState(initialDrop);

  const [distanceKm, setDistanceKm] = useState(2.8);
  const [fare, setFare] = useState(50);
  const [isLocating, setIsLocating] = useState(false);
  const [dropSearchQuery, setDropSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof SUNDARBAN_LANDMARKS>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Broadcast route details to parent whenever state changes
  const updateRoute = useCallback(
    (pText: string, dText: string, pCoords: [number, number], dCoords: [number, number]) => {
      const dist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
      const safeDist = dist === 0 ? 1.0 : dist;
      const calcEstimatedFare = calculateFare(safeDist);

      setDistanceKm(safeDist);
      setFare(calcEstimatedFare);

      onRouteSelected({
        pickup: pText,
        drop: dText,
        distanceKm: safeDist,
        estimatedFare: calcEstimatedFare,
        pickupCoords: pCoords,
        dropCoords: dCoords,
      });
    },
    [onRouteSelected]
  );

  // 1. Initialize Leaflet Map (Browser Only)
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await import("leaflet");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [22.158, 88.815],
        zoom: 13,
        zoomControl: false,
      });

      // Google Maps Clean Hybrid / Standard Roads Tile Layer
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // Custom Green Pickup DivIcon
      const greenPickupIcon = L.divIcon({
        className: "custom-pickup-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #10b981; color: white; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
              📍 পিকআপ
            </div>
            <div style="width: 24px; height: 24px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center;">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // Custom Red Drop DivIcon (Draggable with interactive hint)
      const redDropIcon = L.divIcon({
        className: "custom-drop-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
            <div style="background: #ef4444; color: white; font-weight: 800; font-size: 11px; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 8px rgba(239,68,68,0.4); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white; display: flex; align-items: center; gap: 4px;">
              <span>🏁 ড্রপ পয়েন্ট (সরান)</span>
            </div>
            <div style="width: 28px; height: 28px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(239,68,68,0.6); display: flex; align-items: center; justify-content: center; animation: bounce 2s infinite;">
              <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // 1. Pickup Marker (Green)
      const pMarker = L.marker(pickupCoords, { icon: greenPickupIcon }).addTo(map);
      pickupMarkerRef.current = pMarker;

      // 2. Drop Marker (Red & Draggable!)
      const dMarker = L.marker(dropCoords, {
        icon: redDropIcon,
        draggable: true,
        autoPan: true,
      }).addTo(map);
      dropMarkerRef.current = dMarker;

      // 3. Connect Pickup and Drop with Route Polyline
      const line = L.polyline([pickupCoords, dropCoords], {
        color: "#10b981",
        weight: 4,
        dashArray: "6, 8",
        opacity: 0.9,
      }).addTo(map);
      routeLineRef.current = line;

      // Event: Red marker dragged by user
      dMarker.on("dragend", () => {
        const newPos = dMarker.getLatLng();
        const newCoords: [number, number] = [newPos.lat, newPos.lng];
        setDropCoords(newCoords);

        // Update connecting line
        line.setLatLngs([pickupCoords, newCoords]);

        // Auto-detect nearest locality / landmark
        const resolvedName = getNearestLandmark(newCoords[0], newCoords[1]);
        setDropText(resolvedName);
        setDropSearchQuery(resolvedName);

        updateRoute(pickupText, resolvedName, pickupCoords, newCoords);
        toast.success(`ড্রপ লোকেশন আপডেট: ${resolvedName}`);
      });

      // Event: Tap anywhere on map to instantly move the Red Drop Marker
      map.on("click", (e: any) => {
        const clickedCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
        dMarker.setLatLng(clickedCoords);
        setDropCoords(clickedCoords);

        line.setLatLngs([pickupCoords, clickedCoords]);

        const resolvedName = getNearestLandmark(clickedCoords[0], clickedCoords[1]);
        setDropText(resolvedName);
        setDropSearchQuery(resolvedName);

        updateRoute(pickupText, resolvedName, pickupCoords, clickedCoords);
        toast.info(`ড্রপ পয়েন্ট স্থানান্তরিত: ${resolvedName}`);
      });

      mapInstanceRef.current = map;
      if (isMounted) {
        setMapReady(true);
        updateRoute(pickupText, dropText, pickupCoords, dropCoords);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. GPS Auto-Fetch: Auto-locate customer's real position
  const fetchCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("আপনার ব্রাউজারে GPS লোকেশন সমর্থিত নয়");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPickup: [number, number] = [latitude, longitude];

        setPickupCoords(newPickup);

        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng(newPickup);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(newPickup, 14, { duration: 1.2 });
        }

        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([newPickup, dropCoords]);
        }

        // Identify location name
        let detectedName = getNearestLandmark(latitude, longitude);

        // Try reverse geocoding via OpenStreetMap Nominatim for detailed road/area name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(",");
            detectedName = parts.slice(0, 2).join(",").trim() || detectedName;
          }
        } catch {
          // fallback to nearest landmark
        }

        setPickupText(detectedName);
        updateRoute(detectedName, dropText, newPickup, dropCoords);
        setIsLocating(false);
        toast.success(`📍 লাইভ পিকআপ লোকেশন পাওয়া গেছে: ${detectedName}`);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation warning:", err.message);
        toast.info("GPS পাওয়া যায়নি, ডিফল্ট গোসাবা ফেরিঘাট লোকেশন ব্যবহৃত হচ্ছে");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [dropCoords, dropText, updateRoute]);

  // Run auto-fetch on initial load
  useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  // 3. Drop Location Search Handler
  const handleDropSearchInput = (val: string) => {
    setDropSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Filter local Sundarban landmarks
    const q = val.toLowerCase();
    const matches = SUNDARBAN_LANDMARKS.filter(
      (lm) => lm.name.toLowerCase().includes(q) || lm.desc.toLowerCase().includes(q)
    );
    setSearchResults(matches);
    setShowSearchResults(true);
  };

  // 4. Select a search result and smoothly move the Red Drop Marker
  const handleSelectDropLocation = (lm: (typeof SUNDARBAN_LANDMARKS)[0]) => {
    const targetCoords: [number, number] = [lm.lat, lm.lng];
    setDropCoords(targetCoords);
    setDropText(lm.name);
    setDropSearchQuery(lm.name);
    setShowSearchResults(false);

    if (dropMarkerRef.current) {
      dropMarkerRef.current.setLatLng(targetCoords);
    }

    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([pickupCoords, targetCoords]);
    }

    if (mapInstanceRef.current) {
      // Zoom and pan to fit both pickup and drop points comfortably
      const L = (window as any).L;
      if (L && pickupMarkerRef.current) {
        const bounds = L.latLngBounds([pickupCoords, targetCoords]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else {
        mapInstanceRef.current.flyTo(targetCoords, 14, { duration: 1.0 });
      }
    }

    updateRoute(pickupText, lm.name, pickupCoords, targetCoords);
    toast.success(`গন্তব্য নির্বাচন: ${lm.name}`);
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Search & Location Bar */}
      <div className="space-y-2">
        {/* Pickup Auto-Fetched Card */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                পিকআপ লোকেশন (স্বয়ংক্রিয় GPS)
              </span>
              <span className="text-sm font-bold text-slate-900 line-clamp-1">{pickupText}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchCurrentLocation}
            disabled={isLocating}
            className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 px-2 font-semibold flex items-center gap-1"
          >
            {isLocating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>লোকেশন নিন</span>
          </Button>
        </div>

        {/* Drop Location Search Input with Live Suggestions */}
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm" />
            </div>
            <Input
              type="text"
              placeholder="গন্তব্য খুঁজুন (যেমন: পাখিরালা, গদখালি, সজনেখালি)..."
              value={dropSearchQuery || dropText}
              onChange={(e) => handleDropSearchInput(e.target.value)}
              onFocus={() => {
                if (SUNDARBAN_LANDMARKS.length > 0 && !dropSearchQuery) {
                  setSearchResults(SUNDARBAN_LANDMARKS.slice(0, 5));
                  setShowSearchResults(true);
                }
              }}
              className="h-12 pl-10 pr-10 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm font-semibold shadow-sm focus:border-red-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Autocomplete Search Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-14 left-0 right-0 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold px-3 bg-slate-50">
                <span>জনপ্রিয় গন্তব্যসমূহ</span>
                <span className="text-emerald-600">লাল পিন স্বয়ংক্রিয় সরবে</span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((lm, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDropLocation(lm)}
                    className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{lm.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{lm.desc}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                      নির্বাচন করুন
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Map Canvas Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Map Floating Guide Overlay */}
        <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
            <Move className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>ম্যাপে লাল পিনটি টেনে নিয়ে যান বা চাপুন</span>
          </div>

          <button
            type="button"
            onClick={fetchCurrentLocation}
            className="pointer-events-auto w-9 h-9 rounded-xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-emerald-600 active:scale-95 transition-all"
            title="আমার বর্তমান অবস্থান"
          >
            <Navigation className="w-4 h-4 text-emerald-600" />
          </button>
        </div>

        {/* Dynamic Route Stats Badge on Map */}
        <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200 flex items-center gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                দূরত্ব
              </span>
              <span className="text-xs font-black text-slate-900">{distanceKm} কিমি</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                আনুমানিক ভাড়া
              </span>
              <span className="text-xs font-black text-emerald-600">₹{fare}.00 নগদ</span>
            </div>
          </div>

          <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1">
            <Car className="w-3.5 h-3.5" />
            <span>স্মার্ট টোটো</span>
          </div>
        </div>
      </div>
    </div>
  );
}
