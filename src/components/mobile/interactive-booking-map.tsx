"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Search,
  Navigation,
  Compass,
  Move,
  RefreshCw,
  LocateFixed,
  Car,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Landmark directory for fast, offline-resilient location naming around Namkhana, Kakdwip, Diamond Harbour, Lakshmikantapur
const SUNDARBAN_LANDMARKS = [
  // Kakdwip Hubs
  { name: "কাকদ্বীপ স্টেশন রোড", lat: 21.8760, lng: 88.1920, desc: "কাকদ্বীপ রেল স্টেশন ও বাজার চত্বর" },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)", lat: 21.8680, lng: 88.1630, desc: "গঙ্গাসাগর ও কচুবেড়িয়া ফেরি পয়েন্ট" },
  { name: "কাকদ্বীপ হাসপাতাল মোড়", lat: 21.8745, lng: 88.1880, desc: "মহকুমা হাসপাতাল ও চৌরাস্তা" },
  { name: "গণেশপুর মোড়", lat: 21.8540, lng: 88.1980, desc: "কাকদ্বীপ-নামখানা সংযোগস্থল" },

  // Namkhana Hubs
  { name: "নামখানা বাসস্ট্যান্ড ও স্টেশন", lat: 21.7674, lng: 88.2325, desc: "নামখানা প্রধান বাস ও ট্রেন টার্মিনাল" },
  { name: "হাতানিয়া দোয়ানিয়া ব্রিজ মোড়", lat: 21.7640, lng: 88.2350, desc: "নামখানা সেতু ও সংযোগ সড়ক" },
  { name: "নারায়ণপুর মোড়", lat: 21.7450, lng: 88.2380, desc: "নামখানা নারায়ণপুর সংযোগস্থল" },
  { name: "বকখালি সৈকত বাসস্ট্যান্ড", lat: 21.5645, lng: 88.2570, desc: "বকখালি সমুদ্র সৈকত ও হোটেল হাব" },
  { name: "ফ্রেজারগঞ্জ ফিশিং হারবার", lat: 21.5850, lng: 88.2510, desc: "ফ্রেজারগঞ্জ বন্দর ও সৈকত" },

  // Diamond Harbour Hubs
  { name: "ডায়মন্ড হারবার স্টেশন ও টার্মিনাল", lat: 22.1912, lng: 88.1903, desc: "ডায়মন্ড হারবার প্রধান টার্মিনাল" },
  { name: "ডায়মন্ড হারবার জেটিঘাট (কেল্লা ঘাট)", lat: 22.1935, lng: 88.1820, desc: "হুগলি নদী পারাপার ও পুরানো কেল্লা" },
  { name: "ডায়মন্ড হারবার এসডিও মোড়", lat: 22.1980, lng: 88.1950, desc: "প্রশাসনিক ভবন ও মহকুমা আদালত" },
  { name: "সরিষা আশ্রম মোড়", lat: 22.2530, lng: 88.2040, desc: "সরিষা রামকৃষ্ণ মিশন ও ১১৭ নং জাতীয় সড়ক" },

  // Lakshmikantapur Hubs
  { name: "লক্ষ্মীকান্তপুর স্টেশন বাজার", lat: 22.1220, lng: 88.3180, desc: "লক্ষ্মীকান্তপুর রেলওয়ে জংশন ও বাজার" },
  { name: "লক্ষ্মীকান্তপুর চৌমাথা মোড়", lat: 22.1250, lng: 88.3195, desc: "কুলপী-মন্দিরবাজার প্রধান মোড়" },
  { name: "মথুরাপুর রোড স্টেশন বাজার", lat: 22.1700, lng: 88.3300, desc: "মথুরাপুর রেল স্টেশন চত্বর" },
  { name: "মন্দিরবাজার থানা মোড়", lat: 22.1480, lng: 88.3350, desc: "মন্দিরবাজার থানা ও ব্লক চত্বর" },
  { name: "কুলপী থানা ও বাজার মোড়", lat: 22.0830, lng: 88.2430, desc: "কুলপী বাসস্টপ ও ১১৭ নং জাতীয় সড়ক" },
  { name: "নিশ্চিন্দাপুর স্টেশন বাজার", lat: 21.9830, lng: 88.2120, desc: "কাকদ্বীপ রোড নিশ্চিন্দাপুর মোড়" },
  { name: "রায়দিঘি বাজার ও জেটিঘাট", lat: 22.0010, lng: 88.4350, desc: "মনি নদী জেটিঘাট ও প্রধান বাজার" },
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
  return Math.max(20, Math.ceil(rawFare / 5) * 5);
}

// Find nearest known landmark name if coords are near
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
  if (minD < 1.0) {
    return closest.name;
  }
  return `পিকআপ (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
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
  initialPickup = "কাকদ্বীপ স্টেশন রোড",
  initialDrop = "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)",
}: InteractiveBookingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);

  // Default coordinate center (Kakdwip - Lot 8 Hub)
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.8680, 88.1630]);
  const [pickupText, setPickupText] = useState(initialPickup);

  // Single source of truth for drop input so backspace / cut / edit NEVER reverts
  const [dropInputValue, setDropInputValue] = useState(initialDrop);

  const [distanceKm, setDistanceKm] = useState(3.5);
  const [fare, setFare] = useState(55);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof SUNDARBAN_LANDMARKS>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Update route data and notify parent
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
        center: pickupCoords,
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

      // Custom Red Drop DivIcon (Draggable with interactive label)
      const redDropIcon = L.divIcon({
        className: "custom-drop-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
            <div style="background: #ef4444; color: white; font-weight: 800; font-size: 11px; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 8px rgba(239,68,68,0.4); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white; display: flex; align-items: center; gap: 4px;">
              <span>🏁 লাল পিন (টেনে সরান)</span>
            </div>
            <div style="width: 28px; height: 28px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(239,68,68,0.6); display: flex; align-items: center; justify-content: center;">
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
      dMarker.on("dragend", async () => {
        const newPos = dMarker.getLatLng();
        const newCoords: [number, number] = [newPos.lat, newPos.lng];
        setDropCoords(newCoords);

        line.setLatLngs([pickupCoords, newCoords]);

        // Resolve drop name via server geocode or landmark
        let resolved = getNearestLandmark(newCoords[0], newCoords[1]);
        try {
          const res = await fetch(`/api/geocode?lat=${newCoords[0]}&lng=${newCoords[1]}`);
          const data = await res.json();
          if (data && data.name) {
            resolved = data.name;
          }
        } catch {}

        setDropInputValue(resolved);
        updateRoute(pickupText, resolved, pickupCoords, newCoords);
        toast.success(`ড্রপ লোকেশন আপডেট: ${resolved}`);
      });

      // Event: Tap anywhere on map to instantly move the Red Drop Marker
      map.on("click", async (e: any) => {
        const clickedCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
        dMarker.setLatLng(clickedCoords);
        setDropCoords(clickedCoords);

        line.setLatLngs([pickupCoords, clickedCoords]);

        let resolved = getNearestLandmark(clickedCoords[0], clickedCoords[1]);
        try {
          const res = await fetch(`/api/geocode?lat=${clickedCoords[0]}&lng=${clickedCoords[1]}`);
          const data = await res.json();
          if (data && data.name) {
            resolved = data.name;
          }
        } catch {}

        setDropInputValue(resolved);
        updateRoute(pickupText, resolved, pickupCoords, clickedCoords);
        toast.info(`ড্রপ পয়েন্ট স্থানান্তরিত: ${resolved}`);
      });

      mapInstanceRef.current = map;
      if (isMounted) {
        updateRoute(pickupText, dropInputValue, pickupCoords, dropCoords);
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

  // 2. Real Browser GPS Auto-Fetch
  const fetchCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("আপনার ব্রাউজারে GPS লোকেশন সমর্থিত নয়");
      return;
    }

    setIsLocating(true);
    toast.info("ব্রাউজারে লোকেশন অনুমতি (Allow) দিন...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPickup: [number, number] = [latitude, longitude];

        setPickupCoords(newPickup);
        setGpsDetected(true);

        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng(newPickup);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(newPickup, 15, { duration: 1.2 });
        }

        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([newPickup, dropCoords]);
        }

        // Resolve location name via server API
        let detectedName = getNearestLandmark(latitude, longitude);
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data && data.name) {
            detectedName = data.name;
          }
        } catch {}

        setPickupText(detectedName);
        updateRoute(detectedName, dropInputValue, newPickup, dropCoords);
        setIsLocating(false);
        toast.success(`📍 লাইভ GPS পিকআপ পাওয়া গেছে: ${detectedName}`);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation warning:", err.message);
        if (err.code === 1) {
          toast.error("লোকেশন পারমিশন ডিনাই করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংসে Location Allow করুন।");
        } else {
          toast.info("GPS সিগন্যাল দুর্বল, ম্যাপে পিন নির্দিষ্ট করুন।");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [dropCoords, dropInputValue, updateRoute]);

  // Attempt auto-locating on load
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((res) => {
        if (res.state === "granted") {
          fetchCurrentLocation();
        }
      }).catch(() => {});
    }
  }, [fetchCurrentLocation]);

  // 3. Drop Search Suggestions Filter
  const handleDropSearchInput = (val: string) => {
    setDropInputValue(val);
    updateRoute(pickupText, val, pickupCoords, dropCoords);

    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

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
    setDropInputValue(lm.name);
    setShowSearchResults(false);

    if (dropMarkerRef.current) {
      dropMarkerRef.current.setLatLng(targetCoords);
    }

    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([pickupCoords, targetCoords]);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(targetCoords, 14, { duration: 1.0 });
    }

    updateRoute(pickupText, lm.name, pickupCoords, targetCoords);
    toast.success(`গন্তব্য নির্বাচন: ${lm.name}`);
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* GPS Location Prompt / Auto-Fetch Banner */}
      {!gpsDetected && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-800">
              আপনার সঠিক অবস্থান স্বয়ংক্রিয়ভাবে পেতে জিপিএস চালু করুন
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={fetchCurrentLocation}
            disabled={isLocating}
            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm shrink-0"
          >
            {isLocating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5 mr-1" />
            )}
            <span>অনুমতি দিন</span>
          </Button>
        </div>
      )}

      {/* Pickup Location Display */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                পিকআপ অবস্থান
              </span>
              {gpsDetected && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  লাইভ GPS ✓
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-slate-900 line-clamp-1">{pickupText}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchCurrentLocation}
          disabled={isLocating}
          className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8 px-2.5 font-bold flex items-center gap-1 rounded-xl"
        >
          {isLocating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5" />
          )}
          <span>আমার লোকেশন</span>
        </Button>
      </div>

      {/* Drop Location Search & Free Typing Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-sm" />
          </div>
          <Input
            type="text"
            placeholder="গন্তব্য খুঁজুন বা লিখুন (যেমন: পাখিরালা বাজার)..."
            value={dropInputValue}
            onChange={(e) => handleDropSearchInput(e.target.value)}
            onFocus={() => {
              if (SUNDARBAN_LANDMARKS.length > 0 && !dropInputValue) {
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
              <span className="text-red-600 font-bold">লাল পিন স্বয়ংক্রিয় সরবে</span>
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
