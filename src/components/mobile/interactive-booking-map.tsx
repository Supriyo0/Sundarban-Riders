"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Navigation,
  LocateFixed,
  Search,
  IndianRupee,
  RefreshCw,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Curated Hubs & Landmarks around Namkhana, Kakdwip, Diamond Harbour, Lakshmikantapur
export const REGIONAL_HUBS = [
  // Kakdwip Hubs
  { name: "কাকদ্বীপ স্টেশন রোড", lat: 21.8760, lng: 88.1920, desc: "কাকদ্বীপ রেল স্টেশন ও বাজার চত্বর", aliases: ["কাকদ্বীপ", "kakdwip", "kakdwip station", "কাকদ্বীপ বাজার"] },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)", lat: 21.8680, lng: 88.1630, desc: "গঙ্গাসাগর ও কচুবেড়িয়া ফেরি পয়েন্ট", aliases: ["লট ৮", "হারউড পয়েন্ট", "lot 8", "harwood point", "কাকদ্বীপ ঘাট"] },
  { name: "কাকদ্বীপ হাসপাতাল মোড়", lat: 21.8745, lng: 88.1880, desc: "মহকুমা হাসপাতাল ও চৌরাস্তা", aliases: ["কাকদ্বীপ হাসপাতাল", "হাসপাতাল মোড়", "kakdwip hospital"] },
  { name: "গণেশপুর মোড়", lat: 21.8540, lng: 88.1980, desc: "কাকদ্বীপ-নামখানা সংযোগস্থল", aliases: ["গণেশপুর", "ganeshpur"] },

  // Namkhana Hubs
  { name: "নামখানা বাসস্ট্যান্ড ও স্টেশন", lat: 21.7674, lng: 88.2325, desc: "নামখানা প্রধান বাস ও ট্রেন টার্মিনাল", aliases: ["নামখানা", "namkhana", "নামখানা বাসস্ট্যান্ড", "নামখানা স্টেশন"] },
  { name: "হাতানিয়া দোয়ানিয়া ব্রিজ মোড়", lat: 21.7640, lng: 88.2350, desc: "নামখানা সেতু ও সংযোগ সড়ক", aliases: ["হাতানিয়া ব্রিজ", "দোয়ানিয়া ব্রিজ", "নামখানা ব্রিজ", "hatania bridge"] },
  { name: "নারায়ণপুর মোড়", lat: 21.7450, lng: 88.2380, desc: "নামখানা নারায়ণপুর সংযোগস্থল", aliases: ["নারায়ণপুর", "নারায়নপুর", "narayanpur"] },
  { name: "বকখালি সৈকত বাসস্ট্যান্ড", lat: 21.5645, lng: 88.2570, desc: "বকখালি সমুদ্র সৈকত ও হোটেল হাব", aliases: ["বকখালি", "bakkhali", "বকখালি সৈকত"] },
  { name: "ফ্রেজারগঞ্জ ফিশিং হারবার", lat: 21.5850, lng: 88.2510, desc: "ফ্রেজারগঞ্জ বন্দর ও সৈকত", aliases: ["ফ্রেজারগঞ্জ", "fraserganj"] },

  // Diamond Harbour Hubs
  { name: "ডায়মন্ড হারবার স্টেশন ও টার্মিনাল", lat: 22.1912, lng: 88.1903, desc: "ডায়মন্ড হারবার প্রধান টার্মিনাল", aliases: ["ডায়মন্ড হারবার", "diamond harbour", "diamond", "ডায়মন্ড"] },
  { name: "ডায়মন্ড হারবার জেটিঘাট (কেল্লা ঘাট)", lat: 22.1935, lng: 88.1820, desc: "হুগলি নদী পারাপার ও পুরানো কেল্লা", aliases: ["কেল্লা ঘাট", "ডায়মন্ড জেটি", "diamond jetty"] },
  { name: "ডায়মন্ড হারবার এসডিও মোড়", lat: 22.1980, lng: 88.1950, desc: "প্রশাসনিক ভবন ও মহকুমা আদালত", aliases: ["এসডিও মোড়", "sdo more", "diamond hospital"] },
  { name: "সরিষা আশ্রম মোড়", lat: 22.2530, lng: 88.2040, desc: "সরিষা রামকৃষ্ণ মিশন ও ১১৭ নং জাতীয় সড়ক", aliases: ["সরিষা", "sarisha", "রামকৃষ্ণ মিশন"] },

  // Lakshmikantapur Hubs
  { name: "লক্ষ্মীকান্তপুর স্টেশন বাজার", lat: 22.1220, lng: 88.3180, desc: "লক্ষ্মীকান্তপুর রেলওয়ে জংশন ও বাজার", aliases: ["লক্ষ্মীকান্তপুর", "lakshmikantapur", "laxmikantapur"] },
  { name: "লক্ষ্মীকান্তপুর চৌমাথা মোড়", lat: 22.1250, lng: 88.3195, desc: "কুলপী-মন্দিরবাজার প্রধান মোড়", aliases: ["লক্ষ্মীকান্তপুর চৌমাথা", "চৌমাথা মোড়"] },
  { name: "মথুরাপুর রোড স্টেশন বাজার", lat: 22.1700, lng: 88.3300, desc: "মথুরাপুর রেল স্টেশন চত্বর", aliases: ["মথুরাপুর", "mathurapur", "mathurapur road"] },
  { name: "মন্দিরবাজার থানা মোড়", lat: 22.1480, lng: 88.3350, desc: "মন্দিরবাজার থানা ও ব্লক চত্বর", aliases: ["মন্দিরবাজার", "mandirbazar"] },
  { name: "কুলপী থানা ও বাজার মোড়", lat: 22.0830, lng: 88.2430, desc: "কুলপী বাসস্টপ ও ১১৭ নং জাতীয় সড়ক", aliases: ["কুলপী", "kulpi"] },
  { name: "নিশ্চিন্দাপুর স্টেশন বাজার", lat: 21.9830, lng: 88.2120, desc: "কাকদ্বীপ রোড নিশ্চিন্দাপুর মোড়", aliases: ["নিশ্চিন্দাপুর", "nischindapur"] },
  { name: "রায়দিঘি বাজার ও জেটিঘাট", lat: 22.0010, lng: 88.4350, desc: "মনি নদী জেটিঘাট ও প্রধান বাজার", aliases: ["রায়দিঘি", "raidighi"] },
];

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

function calculateFare(distanceKm: number) {
  const baseFare = 20;
  const perKm = 10;
  const rawFare = baseFare + distanceKm * perKm;
  return Math.max(20, Math.ceil(rawFare / 5) * 5);
}

function getNearestHub(lat: number, lng: number) {
  let closest = REGIONAL_HUBS[0];
  let minD = 999999;
  for (const lm of REGIONAL_HUBS) {
    const d = calculateDistanceKm(lat, lng, lm.lat, lm.lng);
    if (d < minD) {
      minD = d;
      closest = lm;
    }
  }
  if (minD < 0.8) {
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
  initialDrop = "লট ৮ ফেরিঘাট (হারউড point)",
}: InteractiveBookingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const driverMarkersRef = useRef<any[]>([]);

  // Default coordinate center (Kakdwip - Lot 8 Hub)
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.8680, 88.1630]);
  const [pickupInputValue, setPickupInputValue] = useState(initialPickup);
  const [dropInputValue, setDropInputValue] = useState(initialDrop);

  const [distanceKm, setDistanceKm] = useState(3.5);
  const [fare, setFare] = useState(55);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);

  // Search states for typed locations
  const [pickupSearchResults, setPickupSearchResults] = useState<typeof REGIONAL_HUBS>([]);
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [dropSearchResults, setDropSearchResults] = useState<typeof REGIONAL_HUBS>([]);
  const [showDropSearch, setShowDropSearch] = useState(false);

  // Real registered drivers only (Strictly NO mock data)
  const [realDrivers, setRealDrivers] = useState<any[]>([]);

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

  // Load ONLY real registered drivers from database
  useEffect(() => {
    async function loadRealDrivers() {
      try {
        const res = await fetch("/api/drivers");
        const json = await res.json();
        if (json.drivers && Array.isArray(json.drivers)) {
          const valid = json.drivers.filter((d: any) => {
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            return (
              d.name &&
              d.toto_number &&
              d.is_active !== false &&
              !isNaN(lat) &&
              lat !== 0 &&
              !isNaN(lng) &&
              lng !== 0
            );
          });
          setRealDrivers(valid);
        }
      } catch (err) {
        console.warn("Could not fetch real drivers:", err);
      }
    }
    loadRealDrivers();
  }, []);

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
        zoom: 14,
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
              <span>🏁 গন্তব্য (টেনে সরান)</span>
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

      // 2. Drop Marker (Red & Draggable)
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

        let resolved = getNearestHub(newCoords[0], newCoords[1]);
        try {
          const res = await fetch(`/api/geocode?lat=${newCoords[0]}&lng=${newCoords[1]}`);
          const data = await res.json();
          if (data && data.name) {
            resolved = data.name;
          }
        } catch {}

        setDropInputValue(resolved);
        updateRoute(pickupInputValue, resolved, pickupCoords, newCoords);
        toast.success(`ড্রপ লোকেশন আপডেট: ${resolved}`);
      });

      // Event: Tap anywhere on map to instantly move the Red Drop Marker
      map.on("click", async (e: any) => {
        const clickedCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
        dMarker.setLatLng(clickedCoords);
        setDropCoords(clickedCoords);

        line.setLatLngs([pickupCoords, clickedCoords]);

        let resolved = getNearestHub(clickedCoords[0], clickedCoords[1]);
        try {
          const res = await fetch(`/api/geocode?lat=${clickedCoords[0]}&lng=${clickedCoords[1]}`);
          const data = await res.json();
          if (data && data.name) {
            resolved = data.name;
          }
        } catch {}

        setDropInputValue(resolved);
        updateRoute(pickupInputValue, resolved, pickupCoords, clickedCoords);
        toast.info(`ড্রপ পয়েন্ট স্থানান্তরিত: ${resolved}`);
      });

      // 4. Render REAL Registered Drivers only (Strictly NO mock data)
      driverMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current = [];

      if (realDrivers.length > 0) {
        realDrivers.forEach((driver) => {
          const lat = Number(driver.latitude);
          const lng = Number(driver.longitude);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          const totoIcon = L.divIcon({
            className: "toto-real-driver-icon",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
                <div style="background: white; border: 1.5px solid #10b981; color: #065f46; font-weight: 800; font-size: 9px; padding: 2px 7px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                  🛺 ${driver.name || "টোটো চালক"} (${driver.toto_number})
                </div>
                <div style="width: 32px; height: 32px; background: #ecfdf5; border: 2.5px solid #10b981; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                  🛺
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });

          const dm = L.marker([lat, lng], { icon: totoIcon }).addTo(map);
          driverMarkersRef.current.push(dm);
        });
      }

      mapInstanceRef.current = map;
      if (isMounted) {
        updateRoute(pickupInputValue, dropInputValue, pickupCoords, dropCoords);
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
  }, [realDrivers]);

  // 2. Real Browser GPS Auto-Fetch: Sets customer real-time location as pickup
  const fetchCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("আপনার ব্রাউজারে GPS লোকেশন সমর্থিত নয়");
      return;
    }

    setIsLocating(true);

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
          mapInstanceRef.current.flyTo(newPickup, 16, { duration: 1.2 });
        }

        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([newPickup, dropCoords]);
        }

        // Resolve location name via server API
        let detectedName = getNearestHub(latitude, longitude);
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data && data.name) {
            detectedName = data.name;
          }
        } catch {}

        setPickupInputValue(detectedName);
        updateRoute(detectedName, dropInputValue, newPickup, dropCoords);
        setIsLocating(false);
        toast.success(`📍 আপনার বর্তমান রিয়েলটাইম লোকেশন নেওয়া হয়েছে: ${detectedName}`);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation warning:", err.message);
        if (err.code === 1) {
          toast.error("ব্রাউজারে লোকেশন অনুমতি (Allow) দিন যাতে আপনার বর্তমান অবস্থান স্বয়ংক্রিয়ভাবে পাওয়া যায়।");
        } else {
          toast.info("GPS অবস্থান নির্ণয় করা যায়নি, ম্যাপ থেকে পিকআপ নির্বাচন করুন।");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [dropCoords, dropInputValue, updateRoute]);

  // Automatically fetch customer real-time location on component mount
  useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  // 3. Handle Pickup Typing & Regional Hub Autocomplete
  const handlePickupSearchInput = (val: string) => {
    setPickupInputValue(val);
    setGpsDetected(false);

    if (!val.trim()) {
      setPickupSearchResults([]);
      setShowPickupSearch(false);
      return;
    }

    const q = val.toLowerCase();
    // Prioritize our regional hubs first
    const matches = REGIONAL_HUBS.filter(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        lm.desc.toLowerCase().includes(q) ||
        lm.aliases?.some((a) => a.toLowerCase().includes(q))
    );
    setPickupSearchResults(matches);
    setShowPickupSearch(true);
  };

  // Select typed pickup location
  const handleSelectPickupLocation = (lm: (typeof REGIONAL_HUBS)[0]) => {
    const targetCoords: [number, number] = [lm.lat, lm.lng];
    setPickupCoords(targetCoords);
    setPickupInputValue(lm.name);
    setShowPickupSearch(false);

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng(targetCoords);
    }
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([targetCoords, dropCoords]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(targetCoords, 15, { duration: 1.0 });
    }

    updateRoute(lm.name, dropInputValue, targetCoords, dropCoords);
    toast.success(`পিকআপ অবস্থান: ${lm.name}`);
  };

  // 4. Handle Drop Typing & Regional Hub Autocomplete
  const handleDropSearchInput = (val: string) => {
    setDropInputValue(val);

    if (!val.trim()) {
      setDropSearchResults([]);
      setShowDropSearch(false);
      return;
    }

    const q = val.toLowerCase();
    // Prioritize our regional hubs first
    const matches = REGIONAL_HUBS.filter(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        lm.desc.toLowerCase().includes(q) ||
        lm.aliases?.some((a) => a.toLowerCase().includes(q))
    );
    setDropSearchResults(matches);
    setShowDropSearch(true);
  };

  // Select typed drop location
  const handleSelectDropLocation = (lm: (typeof REGIONAL_HUBS)[0]) => {
    const targetCoords: [number, number] = [lm.lat, lm.lng];
    setDropCoords(targetCoords);
    setDropInputValue(lm.name);
    setShowDropSearch(false);

    if (dropMarkerRef.current) {
      dropMarkerRef.current.setLatLng(targetCoords);
    }
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([pickupCoords, targetCoords]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(targetCoords, 14, { duration: 1.0 });
    }

    updateRoute(pickupInputValue, lm.name, pickupCoords, targetCoords);
    toast.success(`গন্তব্য অবস্থান: ${lm.name}`);
  };

  return (
    <div className="space-y-3">
      {/* ----------------------------------------------------------- */}
      {/* Interactive Map Container */}
      {/* ----------------------------------------------------------- */}
      <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* GPS Live Locate Button on Map */}
        <button
          type="button"
          onClick={fetchCurrentLocation}
          disabled={isLocating}
          title="আমার রিয়েলটাইম লোকেশনে যান"
          className="absolute bottom-4 right-4 z-20 w-11 h-11 bg-white hover:bg-slate-50 text-emerald-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-95"
        >
          {isLocating ? (
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          ) : (
            <LocateFixed className="w-5 h-5 text-emerald-600" />
          )}
        </button>

        {/* Real Registered Drivers Count Badge */}
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">
            {realDrivers.length > 0
              ? `${realDrivers.length}টি নিবন্ধিত টোটো সক্রিয়`
              : "নিকটবর্তী টোটো খুঁজছে..."}
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 1. TYPABLE PICKUP LOCATION INPUT (Prioritizes Regional Hubs) */}
      {/* ----------------------------------------------------------- */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600">
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <Input
            type="text"
            placeholder="পিকআপ অবস্থান লিখুন বা জিপিএস ব্যবহার করুন..."
            value={pickupInputValue}
            onChange={(e) => handlePickupSearchInput(e.target.value)}
            onFocus={() => {
              if (REGIONAL_HUBS.length > 0 && !pickupInputValue) {
                setPickupSearchResults(REGIONAL_HUBS.slice(0, 5));
                setShowPickupSearch(true);
              }
            }}
            className="h-12 pl-10 pr-28 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm font-semibold shadow-sm focus:border-emerald-500"
          />
          {/* Action buttons inside Pickup Input */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={fetchCurrentLocation}
              disabled={isLocating}
              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 transition-colors"
            >
              {isLocating ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <LocateFixed className="w-3 h-3" />
              )}
              <span>লাইভ GPS</span>
            </button>
            {pickupInputValue && (
              <button
                type="button"
                onClick={() => {
                  setPickupInputValue("");
                  setShowPickupSearch(false);
                }}
                className="w-5 h-5 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Pickup Autocomplete Search Dropdown */}
        {showPickupSearch && pickupSearchResults.length > 0 && (
          <div className="absolute top-14 left-0 right-0 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold px-3 bg-slate-50">
              <span>কাকদ্বীপ, নামখানা, ডায়মন্ড ও লক্ষ্মীকান্তপুর হাব</span>
              <span className="text-emerald-700 font-bold">পিকআপ পয়েন্ট</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {pickupSearchResults.map((lm, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPickupLocation(lm)}
                  className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{lm.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{lm.desc}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                    নির্বাচন করুন
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 2. TYPABLE DROP LOCATION INPUT (Prioritizes Regional Hubs)  */}
      {/* ----------------------------------------------------------- */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-sm" />
          </div>
          <Input
            type="text"
            placeholder="গন্তব্য খুঁজুন বা লিখুন (যেমন: লট ৮ ফেরিঘাট)..."
            value={dropInputValue}
            onChange={(e) => handleDropSearchInput(e.target.value)}
            onFocus={() => {
              if (REGIONAL_HUBS.length > 0 && !dropInputValue) {
                setDropSearchResults(REGIONAL_HUBS.slice(0, 5));
                setShowDropSearch(true);
              }
            }}
            className="h-12 pl-10 pr-10 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm font-semibold shadow-sm focus:border-red-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Drop Autocomplete Search Dropdown */}
        {showDropSearch && dropSearchResults.length > 0 && (
          <div className="absolute top-14 left-0 right-0 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold px-3 bg-slate-50">
              <span>কাকদ্বীপ, নামখানা, ডায়মন্ড ও লক্ষ্মীকান্তপুর হাব</span>
              <span className="text-red-600 font-bold">লাল পিন স্বয়ংক্রিয় সরবে</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {dropSearchResults.map((lm, idx) => (
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

      {/* ----------------------------------------------------------- */}
      {/* Route Distance & Fare Information Card                      */}
      {/* ----------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">দূরত্ব</span>
            <span className="text-sm font-extrabold text-slate-900">{distanceKm} কিমি</span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-l border-slate-100 pl-3">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">আনুমানিক ভাড়া</span>
            <span className="text-sm font-extrabold text-emerald-700">₹{fare}.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
