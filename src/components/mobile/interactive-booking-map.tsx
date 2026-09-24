"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MapPin,
  Navigation,
  LocateFixed,
  Search,
  IndianRupee,
  RefreshCw,
  X,
  User,
  ShieldCheck,
  Layers,
  Sparkles,
  Clock,
  Check,
  Zap,
  Maximize2,
  Compass,
  Route as RouteIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Curated Hubs & Landmarks around Namkhana, Kakdwip, Diamond Harbour, Lakshmikantapur
export const REGIONAL_HUBS = [
  // Kakdwip Hubs
  { name: "কাকদ্বীপ স্টেশন রোড", shortName: "কাকদ্বীপ স্টেশন", type: "রেল", lat: 21.8760, lng: 88.1920, desc: "কাকদ্বীপ রেল স্টেশন ও বাজার চত্বর", aliases: ["কাকদ্বীপ", "kakdwip", "kakdwip station", "কাকদ্বীপ বাজার"] },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট)", shortName: "লট ৮ ঘাট", type: "ফেরি", lat: 21.8680, lng: 88.1630, desc: "গঙ্গাসাগর ও কচুবেড়িয়া ফেরি পয়েন্ট", aliases: ["লট ৮", "হারউড পয়েন্ট", "lot 8", "harwood point", "কাকদ্বীপ ঘাট"] },
  { name: "কাকদ্বীপ হাসপাতাল মোড়", shortName: "হাসপাতাল মোড়", type: "হাসপাতাল", lat: 21.8745, lng: 88.1880, desc: "মহকুমা হাসপাতাল ও চৌরাস্তা", aliases: ["কাকদ্বীপ হাসপাতাল", "হাসপাতাল মোড়", "kakdwip hospital"] },
  { name: "গণেশপুর মোড়", shortName: "গণেশপুর", type: "মোড়", lat: 21.8540, lng: 88.1980, desc: "কাকদ্বীপ-নামখানা সংযোগস্থল", aliases: ["গণেশপুর", "ganeshpur"] },

  // Namkhana Hubs
  { name: "নামখানা বাসস্ট্যান্ড ও স্টেশন", shortName: "নামখানা টার্মিনাল", type: "বাস", lat: 21.7674, lng: 88.2325, desc: "নামখানা প্রধান বাস ও ট্রেন টার্মিনাল", aliases: ["নামখানা", "namkhana", "নামখানা বাসস্ট্যান্ড", "নামখানা স্টেশন"] },
  { name: "হাতানিয়া দোয়ানিয়া ব্রিজ মোড়", shortName: "হাতানিয়া ব্রিজ", type: "ব্রিজ", lat: 21.7640, lng: 88.2350, desc: "নামখানা সেতু ও সংযোগ সড়ক", aliases: ["হাতানিয়া ব্রিজ", "দোয়ানিয়া ব্রিজ", "নামখানা ব্রিজ", "hatania bridge"] },
  { name: "নারায়ণপুর মোড়", shortName: "নারায়ণপুর", type: "মোড়", lat: 21.7450, lng: 88.2380, desc: "নামখানা নারায়ণপুর সংযোগস্থল", aliases: ["নারায়ণপুর", "নারায়নপুর", "narayanpur"] },
  { name: "বকখালি সৈকত বাসস্ট্যান্ড", shortName: "বকখালি সৈকত", type: "সৈকত", lat: 21.5645, lng: 88.2570, desc: "বকখালি সমুদ্র সৈকত ও হোটেল হাব", aliases: ["বকখালি", "bakkhali", "বকখালি সৈকত"] },
  { name: "ফ্রেজারগঞ্জ ফিশিং হারবার", shortName: "ফ্রেজারগঞ্জ", type: "বন্দর", lat: 21.5850, lng: 88.2510, desc: "ফ্রেজারগঞ্জ বন্দর ও সৈকত", aliases: ["ফ্রেজারগঞ্জ", "fraserganj"] },

  // Diamond Harbour Hubs
  { name: "ডায়মন্ড হারবার স্টেশন ও টার্মিনাল", shortName: "ডায়মন্ড হারবার", type: "রেল", lat: 22.1912, lng: 88.1903, desc: "ডায়মন্ড হারবার প্রধান টার্মিনাল", aliases: ["ডায়মন্ড হারবার", "diamond harbour", "diamond", "ডায়মন্ড"] },
  { name: "ডায়মন্ড হারবার জেটিঘাট (কেল্লা ঘাট)", shortName: "কেল্লা ঘাট", type: "ঘাট", lat: 22.1935, lng: 88.1820, desc: "হুগলি নদী পারাপার ও পুরানো কেল্লা", aliases: ["কেল্লা ঘাট", "ডায়মন্ড জেটি", "diamond jetty"] },
  { name: "ডায়মন্ড হারবার এসডিও মোড়", shortName: "এসডিও মোড়", type: "প্রশাসনিক", lat: 22.1980, lng: 88.1950, desc: "প্রশাসনিক ভবন ও মহকুমা আদালত", aliases: ["এসডিও মোড়", "sdo more", "diamond hospital"] },
  { name: "সরিষা আশ্রম মোড়", shortName: "সরিষা আশ্রম", type: "আশ্রম", lat: 22.2530, lng: 88.2040, desc: "সরিষা রামকৃষ্ণ মিশন ও ১১৭ নং জাতীয় সড়ক", aliases: ["সরিষা", "sarisha", "রামকৃষ্ণ মিশন"] },

  // Lakshmikantapur Hubs
  { name: "লক্ষ্মীকান্তপুর স্টেশন বাজার", shortName: "লক্ষ্মীকান্তপুর", type: "রেল", lat: 22.1220, lng: 88.3180, desc: "লক্ষ্মীকান্তপুর রেলওয়ে জংশন ও বাজার", aliases: ["লক্ষ্মীকান্তপুর", "lakshmikantapur", "laxmikantapur"] },
  { name: "লক্ষ্মীকান্তপুর চৌমাথা মোড়", shortName: "চৌমাথা মোড়", type: "মোড়", lat: 22.1250, lng: 88.3195, desc: "কুলপী-মন্দিরবাজার প্রধান মোড়", aliases: ["লক্ষ্মীকান্তপুর চৌমাথা", "চৌমাথা মোড়"] },
  { name: "মথুরাপুর রোড স্টেশন বাজার", shortName: "মথুরাপুর", type: "রেল", lat: 22.1700, lng: 88.3300, desc: "মথুরাপুর রেল স্টেশন চত্বর", aliases: ["মথুরাপুর", "mathurapur", "mathurapur road"] },
  { name: "মন্দিরবাজার থানা মোড়", shortName: "মন্দিরবাজার", type: "থানা", lat: 22.1480, lng: 88.3350, desc: "মন্দিরবাজার থানা ও ব্লক চত্বর", aliases: ["মন্দিরবাজার", "mandirbazar"] },
  { name: "কুলপী থানা ও বাজার মোড়", shortName: "কুলপী", type: "থানা", lat: 22.0830, lng: 88.2430, desc: "কুলপী বাসস্টপ ও ১১৭ নং জাতীয় সড়ক", aliases: ["কুলপী", "kulpi"] },
  { name: "নিশ্চিন্দাপুর স্টেশন বাজার", shortName: "নিশ্চিন্দাপুর", type: "রেল", lat: 21.9830, lng: 88.2120, desc: "কাকদ্বীপ রোড নিশ্চিন্দাপুর মোড়", aliases: ["নিশ্চিন্দাপুর", "nischindapur"] },
  { name: "রায়দিঘি বাজার ও জেটিঘাট", shortName: "রায়দিঘি", type: "ঘাট", lat: 22.0010, lng: 88.4350, desc: "মনি নদী জেটিঘাট ও প্রধান বাজার", aliases: ["রায়দিঘি", "raidighi"] },
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

export type RideTier = "standard" | "shared" | "reserved";

function calculateTierFares(distanceKm: number) {
  const base = 20;
  const perKm = 10;
  const raw = base + distanceKm * perKm;
  const standard = Math.max(20, Math.ceil(raw / 5) * 5);
  // Shared: ~30% off, minimum 15
  const shared = Math.max(15, Math.ceil((standard * 0.7) / 5) * 5);
  // Reserved: ~50% premium for entire private toto
  const reserved = Math.max(40, Math.ceil((standard * 1.5) / 5) * 5);

  return { standard, shared, reserved };
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
    rideTier?: RideTier;
    pickupCoords: [number, number];
    dropCoords: [number, number];
    paymentMode?: "cash" | "upi";
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
  const tileLayerRef = useRef<any>(null);
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
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);

  // Uber/Rapido Ride Options
  const [selectedTier, setSelectedTier] = useState<RideTier>("standard");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [mapLayer, setMapLayer] = useState<"streets" | "hybrid">("streets");
  const [showMapPreview, setShowMapPreview] = useState<boolean>(false);

  // Road Routing Data from /api/route
  const [roadRouteSummary, setRoadRouteSummary] = useState<string>(
    "কাকদ্বীপ স্টেশন রোড ➔ ডায়মন্ড হারবার রোড (NH-117) ➔ লট ৮ ফেরিঘাট রোড"
  );
  const [roadDurationMin, setRoadDurationMin] = useState<number>(7);
  const [isLoadingRoadRoute, setIsLoadingRoadRoute] = useState<boolean>(false);

  // Search states for typed locations
  const [pickupSearchResults, setPickupSearchResults] = useState<typeof REGIONAL_HUBS>([]);
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [dropSearchResults, setDropSearchResults] = useState<typeof REGIONAL_HUBS>([]);
  const [showDropSearch, setShowDropSearch] = useState(false);

  // Real registered drivers only (Strictly NO mock data)
  const [realDrivers, setRealDrivers] = useState<any[]>([]);

  // Dynamic Fares calculation
  const fares = useMemo(() => {
    return calculateTierFares(distanceKm);
  }, [distanceKm]);

  // Current active fare based on tier
  const activeFare = useMemo(() => {
    if (selectedTier === "shared") return fares.shared;
    if (selectedTier === "reserved") return fares.reserved;
    return fares.standard;
  }, [selectedTier, fares]);

  // Proximity to nearest real registered driver
  const nearestDriverInfo = useMemo(() => {
    if (realDrivers.length === 0) return null;
    let minKm = 9999;
    let closestDriver: any = null;

    realDrivers.forEach((d) => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const dKm = calculateDistanceKm(pickupCoords[0], pickupCoords[1], lat, lng);
        if (dKm < minKm) {
          minKm = dKm;
          closestDriver = d;
        }
      }
    });

    if (minKm === 9999) return null;
    const etaMin = Math.max(2, Math.round(minKm * 2.5 + 1));
    return {
      distanceKm: minKm,
      etaMin,
      driverName: closestDriver?.name || "টোটো চালক",
    };
  }, [realDrivers, pickupCoords]);

  // Update route data and notify parent (with live road route geometry & accurate road distance)
  const updateRoute = useCallback(
    async (
      pText: string,
      dText: string,
      pCoords: [number, number],
      dCoords: [number, number],
      tier: RideTier = selectedTier,
      payMode: "cash" | "upi" = paymentMode
    ) => {
      let safeDist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
      if (safeDist === 0) safeDist = 1.0;

      setIsLoadingRoadRoute(true);

      try {
        const res = await fetch(
          `/api/route?fromLat=${pCoords[0]}&fromLng=${pCoords[1]}&toLat=${dCoords[0]}&toLng=${dCoords[1]}`
        );
        const data = await res.json();

        if (data && data.coordinates && data.coordinates.length > 0) {
          if (routeLineRef.current) {
            routeLineRef.current.setLatLngs(data.coordinates);
          }
          if (data.routeSummaryBengali) {
            setRoadRouteSummary(data.routeSummaryBengali);
          }
          if (data.distanceKm) {
            safeDist = data.distanceKm;
          }
          if (data.durationMin) {
            setRoadDurationMin(data.durationMin);
          }
        }
      } catch (err) {
        console.warn("Could not fetch road route:", err);
      } finally {
        setIsLoadingRoadRoute(false);
      }

      setDistanceKm(safeDist);
      const tierFares = calculateTierFares(safeDist);
      const fareToReport =
        tier === "shared" ? tierFares.shared : tier === "reserved" ? tierFares.reserved : tierFares.standard;

      onRouteSelected({
        pickup: pText,
        drop: dText,
        distanceKm: safeDist,
        estimatedFare: fareToReport,
        rideTier: tier,
        pickupCoords: pCoords,
        dropCoords: dCoords,
        paymentMode: payMode,
      });
    },
    [onRouteSelected, selectedTier, paymentMode]
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

      // Google Maps Tile Layer
      const tileUrl =
        mapLayer === "hybrid"
          ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      const tiles = L.tileLayer(tileUrl, {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Custom Green Pickup DivIcon (Pulsing Uber-style pin)
      const greenPickupIcon = L.divIcon({
        className: "custom-pickup-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #10b981; color: white; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
              📍 পিকআপ (আপনার অবস্থান)
            </div>
            <div style="position: relative; width: 26px; height: 26px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center;">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });

      // Custom Red Drop DivIcon (Draggable with interactive Rapido-style pin)
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
        color: "#059669",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      routeLineRef.current = line;

      // Fit map to show both pickup and drop
      try {
        const bounds = L.latLngBounds([pickupCoords, dropCoords]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch {}

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
      if (isMounted && showMapPreview) {
        updateRoute(pickupInputValue, dropInputValue, pickupCoords, dropCoords);
      }
    }

    if (showMapPreview) {
      initMap();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [realDrivers, mapLayer, showMapPreview]);

  // Initial Route & Fare calculation on component load
  useEffect(() => {
    updateRoute(pickupInputValue, dropInputValue, pickupCoords, dropCoords, selectedTier, paymentMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Fit bounds to both points
  const handleFitBounds = () => {
    if (mapInstanceRef.current && pickupCoords && dropCoords) {
      import("leaflet").then((L) => {
        const bounds = L.latLngBounds([pickupCoords, dropCoords]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      });
    }
  };

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
    const matches = REGIONAL_HUBS.filter(
      (lm) =>
        lm.name.toLowerCase().includes(q) ||
        lm.desc.toLowerCase().includes(q) ||
        lm.aliases?.some((a) => a.toLowerCase().includes(q))
    );
    setDropSearchResults(matches);
    setShowDropSearch(true);
  };

  // Select drop location (both from autocomplete and Quick Destination Pills)
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
    toast.success(`গন্তব্য: ${lm.name}`);
  };

  // Swap Pickup and Drop Locations (Uber/Rapido standard feature)
  const handleSwapRoute = () => {
    const nextPickupText = dropInputValue;
    const nextDropText = pickupInputValue;
    const nextPickupCoords = dropCoords;
    const nextDropCoords = pickupCoords;

    setPickupInputValue(nextPickupText);
    setDropInputValue(nextDropText);
    setPickupCoords(nextPickupCoords);
    setDropCoords(nextDropCoords);

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLatLng(nextPickupCoords);
    }
    if (dropMarkerRef.current) {
      dropMarkerRef.current.setLatLng(nextDropCoords);
    }
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs([nextPickupCoords, nextDropCoords]);
    }

    updateRoute(nextPickupText, nextDropText, nextPickupCoords, nextDropCoords, selectedTier, paymentMode);
    toast.success("পিকআপ ও গন্তব্য স্থান অদল-বদল করা হয়েছে ⇅");
  };

  // Select Ride Tier
  const handleSelectTier = (tier: RideTier) => {
    setSelectedTier(tier);
    updateRoute(pickupInputValue, dropInputValue, pickupCoords, dropCoords, tier, paymentMode);
  };

  // Select Payment Mode
  const handleSelectPayment = (mode: "cash" | "upi") => {
    setPaymentMode(mode);
    updateRoute(pickupInputValue, dropInputValue, pickupCoords, dropCoords, selectedTier, mode);
  };

  return (
    <div className="space-y-3.5">
      {/* ----------------------------------------------------------- */}
      {/* 1. Fast Availability & Proximity Bar (Uber/Rapido Style)     */}
      {/* ----------------------------------------------------------- */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg shrink-0">
            🛺
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {realDrivers.length > 0 ? `${realDrivers.length}টি টোটো সক্রিয়` : "সুন্দরবন রাইডার্স"}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {nearestDriverInfo ? `কাছের টোটো ~${nearestDriverInfo.etaMin} মিনিটে পৌঁছাবে` : "নিকটবর্তী সক্রিয় চালকদের দ্রুত বুকিং"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMapPreview((p) => !p)}
          className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
        >
          <span>{showMapPreview ? "ম্যাপ লুকান ▲" : "🗺️ ম্যাপ প্রিভিউ ▼"}</span>
        </button>
      </div>

      {/* Conditionally Render Map Preview only if passenger explicitly toggled it */}
      {showMapPreview && (
        <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 animate-in fade-in duration-200">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Top Floating Bar: Real Registered Drivers Badge */}
          <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-md border border-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-slate-800">
              {realDrivers.length > 0
                ? `${realDrivers.length}টি নিবন্ধিত টোটো সক্রিয়`
                : "নিকটবর্তী টোটো খুঁজছে..."}
            </span>
          </div>

          {/* Top-Right Map Controls: Satellite Toggle & Fit Route */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMapLayer((prev) => (prev === "streets" ? "hybrid" : "streets"))}
              title={mapLayer === "streets" ? "স্যাটেলাইট ভিউ" : "ম্যাপ ভিউ"}
              className="h-9 px-2.5 bg-white/95 backdrop-blur hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 flex items-center gap-1 text-[11px] font-bold transition-all active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>{mapLayer === "streets" ? "স্যাটেলাইট" : "রোড"}</span>
            </button>

            <button
              type="button"
              onClick={handleFitBounds}
              title="সম্পূর্ণ রুট দেখুন"
              className="w-9 h-9 bg-white/95 backdrop-blur hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 flex items-center justify-center transition-all active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Floating Bar: Proximity ETA Banner */}
          {nearestDriverInfo && (
            <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl shadow-lg border border-slate-700/50 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium">
                কাছের টোটো <strong className="text-emerald-400">{nearestDriverInfo.distanceKm} কিমি</strong> দূরে •{" "}
                <strong className="text-amber-300">~{nearestDriverInfo.etaMin} মিনিটে</strong> পিকআপ
              </span>
            </div>
          )}

          {/* Bottom-Right GPS Live Locate Button */}
          <button
            type="button"
            onClick={fetchCurrentLocation}
            disabled={isLocating}
            title="আমার রিয়েলটাইম জিপিএস অবস্থানে যান"
            className="absolute bottom-3 right-3 z-20 w-11 h-11 bg-white hover:bg-slate-50 text-emerald-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-95"
          >
            {isLocating ? (
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            ) : (
              <LocateFixed className="w-5 h-5 text-emerald-600" />
            )}
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 2. Pickup & Drop Location Search Inputs                     */}
      {/* ----------------------------------------------------------- */}
      <div className="space-y-2.5">
        {/* Typable Pickup Input */}
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
              className="h-12 pl-10 pr-28 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm font-semibold shadow-xs focus:border-emerald-500"
            />
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

        {/* Swap Pickup & Drop Button (Uber/Rapido style) */}
        <div className="relative flex justify-center -my-1 z-20">
          <button
            type="button"
            onClick={handleSwapRoute}
            title="পিকআপ ও গন্তব্য অদল-বদল করুন"
            className="h-7 px-3 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-700 flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-95 hover:border-slate-300"
          >
            <span className="text-sm">⇅</span>
            <span>স্থান অদল-বদল</span>
          </button>
        </div>

        {/* Typable Drop Input */}
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-xs" />
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
              className="h-12 pl-10 pr-10 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm font-semibold shadow-xs focus:border-red-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Drop Autocomplete Search Dropdown */}
          {showDropSearch && dropSearchResults.length > 0 && (
            <div className="absolute top-14 left-0 right-0 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold px-3 bg-slate-50">
                <span>কাকদ্বীপ, নামখানা, ডায়মন্ড ও লক্ষ্মীকান্তপুর হাব</span>
                <span className="text-red-600 font-bold">লাল পিন সরবে</span>
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
        {/* 3. Quick Destination Hub Pills (১-ট্যাপে জনপ্রিয় গন্তব্য)   */}
        {/* ----------------------------------------------------------- */}
        <div>
          <div className="flex items-center justify-between pb-1.5 px-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ⚡ দ্রুত ১-ট্যাপ গন্তব্য:
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">ম্যাপে লাল পিন যাবে</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {REGIONAL_HUBS.slice(0, 8).map((hub, idx) => {
              const isSelected = dropInputValue.includes(hub.shortName) || dropInputValue === hub.name;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDropLocation(hub)}
                  className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>
                    {hub.type === "রেল"
                      ? "🚉"
                      : hub.type === "ফেরি" || hub.type === "ঘাট"
                      ? "⛴️"
                      : hub.type === "হাসপাতাল"
                      ? "🏥"
                      : hub.type === "সৈকত"
                      ? "🏖️"
                      : hub.type === "বাস"
                      ? "🚌"
                      : "📍"}
                  </span>
                  <span>{hub.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 3.5. Live Road Route Indicator (Which Route Will Be Taken)  */}
      {/* ----------------------------------------------------------- */}
      {showMapPreview && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Compass className="w-3.5 h-3.5 animate-spin-slow" />
              <span>গন্তব্যে যাওয়ার রুট (Drop Route via Road)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">
              {isLoadingRoadRoute ? "রুট খোঁজা হচ্ছে..." : `~${roadDurationMin} মিনিট • ${distanceKm} কিমি`}
            </span>
          </div>
          <p className="text-xs font-black text-slate-100 leading-snug">
            🛣️ {roadRouteSummary}
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 4. Uber / Rapido Ride Tier Selector (স্ট্যান্ডার্ড/শেয়ার্ড/রিজার্ভ) */}
      {/* ----------------------------------------------------------- */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>🛺 রাইড নির্বাচন করুন</span>
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            {distanceKm} কিমি • ~{roadDurationMin} মিনিট
          </span>
        </div>

        <div className="space-y-2">
          {/* Tier 1: Standard Toto (স্ট্যান্ডার্ড টোটো) */}
          <div
            onClick={() => handleSelectTier("standard")}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              selectedTier === "standard"
                ? "bg-emerald-50/90 border-emerald-500 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl shadow-xs shrink-0">
                🛺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm text-slate-900">স্ট্যান্ডার্ড টোটো</h4>
                  <span className="text-[9px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">
                    সেরা পছন্দ
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
                    <User className="w-3 h-3" /> ৪
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {nearestDriverInfo ? `~${nearestDriverInfo.etaMin} মিনিটে পিকআপ` : "২-৩ মিনিট"} • দ্রুত ও নির্ভরযোগ্য
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-base font-black text-slate-900">₹{fares.standard}.00</div>
              <span className="text-[10px] text-slate-400 line-through">₹{fares.standard + 10}</span>
            </div>
          </div>

          {/* Tier 2: Shared Economy Toto (শেয়ার্ড টোটো) */}
          <div
            onClick={() => handleSelectTier("shared")}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              selectedTier === "shared"
                ? "bg-blue-50/90 border-blue-500 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shadow-xs shrink-0">
                🛺⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm text-slate-900">শেয়ার্ড ইকোনমি</h4>
                  <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-md">
                    ৩০% সাশ্রয়ী
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-0.5">
                    <User className="w-3 h-3" /> ১-২
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  সহযাত্রীর সাথে শেয়ার • পকেট-ফ্রেন্ডলি ভাড়া
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-base font-black text-blue-700">₹{fares.shared}.00</div>
              <span className="text-[10px] text-slate-400 line-through">₹{fares.standard}</span>
            </div>
          </div>

          {/* Tier 3: Reserved / Private Toto (রিজার্ভ টোটো) */}
          <div
            onClick={() => handleSelectTier("reserved")}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              selectedTier === "reserved"
                ? "bg-purple-50/90 border-purple-500 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl shadow-xs shrink-0">
                🛺✨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm text-slate-900">স্পেশাল / রিজার্ভ</h4>
                  <span className="text-[9px] font-extrabold bg-purple-600 text-white px-1.5 py-0.5 rounded-md">
                    ভিআইপি প্রাইভেট
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  সম্পূর্ণ টোটো একা • সরাসরি নন-স্টপ আরাম
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-base font-black text-purple-700">₹{fares.reserved}.00</div>
              <span className="text-[10px] text-purple-600 font-bold">নন-স্টপ</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- */}
      {/* 5. Payment Method & Safety Shield Bar (Uber/Rapido style)   */}
      {/* ----------------------------------------------------------- */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-bold">পেমেন্ট:</span>
          <button
            type="button"
            onClick={() => handleSelectPayment("cash")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              paymentMode === "cash"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            💵 নগদ (Cash)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPayment("upi")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              paymentMode === "upi"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            📱 UPI স্ক্যান
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>নিরাপদ যাচাই</span>
        </div>
      </div>
    </div>
  );
}
