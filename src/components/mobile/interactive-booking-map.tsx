"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MapPin,
  LocateFixed,
  Search,
  RefreshCw,
  X,
  User,
  ShieldCheck,
  ArrowUpDown,
  Compass,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Safely resolve Leaflet ES module default export in Next.js
async function getLeaflet() {
  const LModule = await import("leaflet");
  return (LModule as any).default || LModule;
}

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
  return { standard };
}

interface PlaceSuggestion {
  name: string;
  full_address: string;
  lat: number;
  lng: number;
}

interface InteractiveBookingMapProps {
  initialPickup?: string;
  initialDrop?: string;
  onRouteSelected?: (route: {
    pickup: string;
    drop: string;
    distanceKm: number;
    estimatedFare: number;
    rideTier?: RideTier;
    pickupCoords?: [number, number];
    dropCoords?: [number, number];
    paymentMode?: "cash" | "upi";
  }) => void;
  onConfirmBooking?: () => void;
}

export function InteractiveBookingMap({
  initialPickup = "আপনার বর্তমান অবস্থান (Live GPS)",
  initialDrop = "",
  onRouteSelected,
  onConfirmBooking,
}: InteractiveBookingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const driverMarkersRef = useRef<any[]>([]);
  const onRouteSelectedRef = useRef(onRouteSelected);
  onRouteSelectedRef.current = onRouteSelected;

  // Active Coordinates
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.876, 88.192]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.868, 88.163]);

  // Input States
  const [pickupInputValue, setPickupInputValue] = useState(initialPickup);
  const [dropInputValue, setDropInputValue] = useState(initialDrop);

  // Live Real Place Suggestions (Google Maps / OpenStreetMap Geocoding)
  const [activeSearchField, setActiveSearchField] = useState<"pickup" | "drop" | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Geolocation & Permissions
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const hasFetchedLocationRef = useRef(false);

  // Metrics
  const [distanceKm, setDistanceKm] = useState(0);
  const [roadDurationMin, setRoadDurationMin] = useState(2);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);

  // Dynamic Fares calculation (Single Toto Option)
  const fares = useMemo(() => {
    if (distanceKm === 0) return { standard: 20 };
    return calculateTierFares(distanceKm);
  }, [distanceKm]);

  // Nearest Driver Proximity
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

  // Resolve Location Address from Coordinates
  const resolveLocationAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data && data.name) return data.name;
    } catch {}
    return `লোকেশন (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Update Route Polyline & notify parent
  const updateRoute = useCallback(
    async (
      pText: string,
      dText: string,
      pCoords: [number, number],
      dCoords: [number, number]
    ) => {
      if (!dText || !dText.trim()) {
        setDistanceKm(0);
        if (routeLineRef.current) routeLineRef.current.setLatLngs([]);
        onRouteSelectedRef.current?.({
          pickup: pText,
          drop: "",
          distanceKm: 0,
          estimatedFare: 20,
          rideTier: "standard",
          pickupCoords: pCoords,
          dropCoords: dCoords,
          paymentMode: "cash",
        });
        return;
      }

      let safeDist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
      if (safeDist === 0) safeDist = 1.0;

      try {
        const res = await fetch(
          `/api/route?fromLat=${pCoords[0]}&fromLng=${pCoords[1]}&toLat=${dCoords[0]}&toLng=${dCoords[1]}`
        );
        const data = await res.json();
        if (data?.coordinates?.length) {
          if (routeLineRef.current) routeLineRef.current.setLatLngs(data.coordinates);
          if (data.distanceKm) safeDist = data.distanceKm;
          if (data.durationMin) setRoadDurationMin(data.durationMin);
        } else if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([pCoords, dCoords]);
        }
      } catch {
        if (routeLineRef.current) routeLineRef.current.setLatLngs([pCoords, dCoords]);
      }

      setDistanceKm(safeDist);
      const tierFares = calculateTierFares(safeDist);

      onRouteSelectedRef.current?.({
        pickup: pText,
        drop: dText,
        distanceKm: safeDist,
        estimatedFare: tierFares.standard,
        rideTier: "standard",
        pickupCoords: pCoords,
        dropCoords: dCoords,
        paymentMode: "cash",
      });
    },
    []
  );

  // Load registered active drivers from database
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
      } catch {}
    }
    loadRealDrivers();
  }, []);

  // Check Geolocation Permission
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          setPermissionState(result.state as any);
          if (result.state === "granted") setGpsDetected(true);
          result.onchange = () => {
            setPermissionState(result.state as any);
            if (result.state === "granted") setGpsDetected(true);
          };
        })
        .catch(() => {});
    }
  }, []);

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
        return;
      }

      try {
        const L = await getLeaflet();

        if (mapContainerRef.current) {
          (mapContainerRef.current as any)._leaflet_id = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: pickupCoords,
          zoom: 14,
          zoomControl: false,
        });

        // Google Hybrid Map Tile Layer
        const tileUrl = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
        const tiles = L.tileLayer(tileUrl, {
          maxZoom: 20,
          attribution: "© Google Maps",
        }).addTo(map);
        tileLayerRef.current = tiles;

        // Pickup Icon (Green)
        const greenPickupIcon = L.divIcon({
          className: "custom-pickup-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
              <div style="background: #10b981; color: white; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
                📍 পিকআপ
              </div>
              <div style="position: relative; width: 26px; height: 26px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center;">
                <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const pMarker = L.marker(pickupCoords, { icon: greenPickupIcon, draggable: true }).addTo(map);
        pickupMarkerRef.current = pMarker;

        pMarker.on("dragend", async () => {
          const newPos = pMarker.getLatLng();
          const newCoords: [number, number] = [newPos.lat, newPos.lng];
          setPickupCoords(newCoords);
          setGpsDetected(true);
          const resolved = await resolveLocationAddress(newCoords[0], newCoords[1]);
          setPickupInputValue(resolved);
          updateRoute(resolved, dropInputValue, newCoords, dropCoords);
        });

        // Drop Icon (Red Draggable Pin)
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

        if (dropInputValue) {
          const dMarker = L.marker(dropCoords, { icon: redDropIcon, draggable: true }).addTo(map);
          dropMarkerRef.current = dMarker;

          dMarker.on("dragend", async () => {
            const newPos = dMarker.getLatLng();
            const newCoords: [number, number] = [newPos.lat, newPos.lng];
            setDropCoords(newCoords);
            const resolved = await resolveLocationAddress(newCoords[0], newCoords[1]);
            setDropInputValue(resolved);
            updateRoute(pickupInputValue, resolved, pickupCoords, newCoords);
          });
        }

        // Road Route Polyline
        const line = L.polyline(dropInputValue ? [pickupCoords, dropCoords] : [], {
          color: "#10b981",
          weight: 5,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineRef.current = line;

        // Tap on map to set/drag drop location
        map.on("click", async (e: any) => {
          const clickedCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
          setDropCoords(clickedCoords);

          if (!dropMarkerRef.current) {
            const dMarker = L.marker(clickedCoords, {
              icon: redDropIcon,
              draggable: true,
            }).addTo(map);
            dropMarkerRef.current = dMarker;

            dMarker.on("dragend", async () => {
              const newPos = dMarker.getLatLng();
              const newCoords: [number, number] = [newPos.lat, newPos.lng];
              setDropCoords(newCoords);
              const resolved = await resolveLocationAddress(newCoords[0], newCoords[1]);
              setDropInputValue(resolved);
              updateRoute(pickupInputValue, resolved, pickupCoords, newCoords);
            });
          } else {
            dropMarkerRef.current.setLatLng(clickedCoords);
          }

          if (routeLineRef.current) {
            routeLineRef.current.setLatLngs([pickupCoords, clickedCoords]);
          }

          const resolved = await resolveLocationAddress(clickedCoords[0], clickedCoords[1]);
          setDropInputValue(resolved);
          updateRoute(pickupInputValue, resolved, pickupCoords, clickedCoords);
          toast.info(`গন্তব্য স্থান নির্বাচিত: ${resolved}`);
        });

        if (isMounted) {
          mapInstanceRef.current = map;
        }
      } catch (err) {
        console.warn("Leaflet map init warning:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update drivers on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    getLeaflet().then((L: any) => {
      driverMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current = [];

      if (realDrivers.length > 0 && mapInstanceRef.current) {
        realDrivers.forEach((driver) => {
          const lat = Number(driver.latitude);
          const lng = Number(driver.longitude);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          const totoIcon = L.divIcon({
            className: "toto-real-driver-icon",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
                <div style="background: white; border: 1.5px solid #10b981; color: #065f46; font-weight: 800; font-size: 9px; padding: 2px 7px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                  🛺 ${driver.name || "টোটো চালক"}
                </div>
                <div style="width: 32px; height: 32px; background: #ecfdf5; border: 2.5px solid #10b981; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                  🛺
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });

          try {
            const dm = L.marker([lat, lng], { icon: totoIcon }).addTo(mapInstanceRef.current);
            driverMarkersRef.current.push(dm);
          } catch {}
        });
      }
    });
  }, [realDrivers]);

  // Real Browser GPS Location Fetch
  const fetchCurrentLocation = useCallback(
    (userInitiated = false) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        if (userInitiated) toast.error("আপনার ব্রাউজারে GPS লোকেশন সমর্থিত নয়");
        return;
      }

      setIsLocating(true);

      const handleSuccess = async (latitude: number, longitude: number) => {
        const newPickup: [number, number] = [latitude, longitude];
        setPickupCoords(newPickup);
        setGpsDetected(true);
        setPermissionState("granted");

        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setLatLng(newPickup);
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(newPickup, 16, { duration: 1.0 });
        }

        const detectedName = await resolveLocationAddress(latitude, longitude);
        setPickupInputValue(detectedName);

        if (dropInputValue) {
          updateRoute(detectedName, dropInputValue, newPickup, dropCoords);
        } else {
          updateRoute(detectedName, "", newPickup, dropCoords);
        }

        setIsLocating(false);
        if (userInitiated) toast.success(`📍 আপনার অবস্থান সনাক্ত হয়েছে: ${detectedName}`);
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos.coords.latitude, pos.coords.longitude),
        () => {
          navigator.geolocation.getCurrentPosition(
            (accuratePos) => handleSuccess(accuratePos.coords.latitude, accuratePos.coords.longitude),
            (err) => {
              setIsLocating(false);
              if (err.code === 1) setPermissionState("denied");
              if (userInitiated) toast.error("GPS পারমিশন সক্রিয় করা সম্ভব হয়নি");
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        },
        { enableHighAccuracy: false, timeout: 4000 }
      );
    },
    [dropCoords, dropInputValue, updateRoute]
  );

  useEffect(() => {
    if (!hasFetchedLocationRef.current) {
      hasFetchedLocationRef.current = true;
      fetchCurrentLocation(false);
    }
  }, [fetchCurrentLocation]);

  // Outside click detection to close suggestions dropdown
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setActiveSearchField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Live Real Place Search Query (Calling /api/geocode?q=...)
  const handleQueryPlaces = (query: string, field: "pickup" | "drop") => {
    if (field === "pickup") setPickupInputValue(query);
    else setDropInputValue(query);

    setActiveSearchField(field);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    setIsSearchingPlaces(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const clean = (query || "").trim();
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data?.suggestions && Array.isArray(data.suggestions)) {
          setPlaceSuggestions(data.suggestions);
        } else {
          setPlaceSuggestions([]);
        }
      } catch {
        setPlaceSuggestions([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 150);
  };

  // Select Place Suggestion
  const handleSelectSuggestion = (place: PlaceSuggestion) => {
    const coords: [number, number] = [place.lat, place.lng];

    if (activeSearchField === "pickup") {
      setPickupInputValue(place.name);
      setPickupCoords(coords);
      if (pickupMarkerRef.current) pickupMarkerRef.current.setLatLng(coords);
      if (mapInstanceRef.current) mapInstanceRef.current.flyTo(coords, 15, { duration: 1.0 });
      updateRoute(place.name, dropInputValue, coords, dropCoords);
    } else {
      setDropInputValue(place.name);
      setDropCoords(coords);

      if (!dropMarkerRef.current && mapInstanceRef.current) {
        getLeaflet().then((L: any) => {
          const redDropIcon = L.divIcon({
            className: "custom-drop-pin",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: grab;">
                <div style="background: #ef4444; color: white; font-weight: 800; font-size: 11px; padding: 3px 9px; border-radius: 9999px; box-shadow: 0 4px 8px rgba(239,68,68,0.4); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
                  <span>🏁 গন্তব্য (টেনে সরান)</span>
                </div>
                <div style="width: 28px; height: 28px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(239,68,68,0.6); display: flex; align-items: center; justify-content: center;">
                  <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });
          const dm = L.marker(coords, { icon: redDropIcon, draggable: true }).addTo(mapInstanceRef.current);
          dropMarkerRef.current = dm;
          dm.on("dragend", async () => {
            const p = dm.getLatLng();
            const nc: [number, number] = [p.lat, p.lng];
            setDropCoords(nc);
            const resolved = await resolveLocationAddress(nc[0], nc[1]);
            setDropInputValue(resolved);
            updateRoute(pickupInputValue, resolved, pickupCoords, nc);
          });
        });
      } else if (dropMarkerRef.current) {
        dropMarkerRef.current.setLatLng(coords);
      }

      if (mapInstanceRef.current) mapInstanceRef.current.flyTo(coords, 14, { duration: 1.0 });
      updateRoute(pickupInputValue, place.name, pickupCoords, coords);
    }

    setPlaceSuggestions([]);
    setActiveSearchField(null);
    toast.success(`স্থান নির্বাচিত: ${place.name}`);
  };

  // Swap pickup and drop
  const handleSwap = () => {
    const nextPickup = dropInputValue;
    const nextDrop = pickupInputValue;
    const nextPickupCoords = dropCoords;
    const nextDropCoords = pickupCoords;

    setPickupInputValue(nextPickup);
    setDropInputValue(nextDrop);
    setPickupCoords(nextPickupCoords);
    setDropCoords(nextDropCoords);

    if (pickupMarkerRef.current) pickupMarkerRef.current.setLatLng(nextPickupCoords);
    if (dropMarkerRef.current) dropMarkerRef.current.setLatLng(nextDropCoords);

    updateRoute(nextPickup, nextDrop, nextPickupCoords, nextDropCoords);
    toast.success("পিকআপ ও গন্তব্য অদল-বদল করা হয়েছে ⇅");
  };

  return (
    <div className="space-y-3 relative">
      {/* ------------------------------------------------------------- */}
      {/* 1. LOCATION PERMISSION PROMPT (ONLY SHOWN IF NOT GRANTED)     */}
      {/* ------------------------------------------------------------- */}
      {!gpsDetected && permissionState !== "granted" && (
        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 text-sm shrink-0">
              📍
            </div>
            <div>
              <h5 className="text-xs font-bold text-amber-950">লোকেশন পারমিশন প্রয়োজন</h5>
              <p className="text-[10px] text-amber-700 font-medium">
                সঠিক পিকআপ পয়েন্ট পেতে লোকেশন সক্রিয় করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchCurrentLocation(true)}
            disabled={isLocating}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            {isLocating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
            <span>অনুমতি দিন</span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PICKUP & DROP LOCATION SELECTION (ABOVE THE MAP)           */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={searchContainerRef}
        className="p-3.5 rounded-3xl space-y-2 relative z-40"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)",
          boxShadow: "0 8px 30px -4px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
          border: "1px solid rgba(226,232,240,0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="relative flex flex-col gap-2">
          {/* Pickup Input */}
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block ring-4 ring-emerald-100" />
            </div>
            <Input
              type="text"
              placeholder="পিকআপ অবস্থান লিখুন বা জিপিএস নিন..."
              value={pickupInputValue}
              onChange={(e) => handleQueryPlaces(e.target.value, "pickup")}
              onFocus={() => handleQueryPlaces(pickupInputValue, "pickup")}
              className="h-11 pl-9 pr-20 bg-slate-50/80 border-slate-200 text-slate-900 rounded-2xl text-xs font-bold shadow-2xs focus:border-emerald-500"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchCurrentLocation(true)}
                disabled={isLocating}
                title="লাইভ GPS অবস্থান"
                className="w-7 h-7 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors"
              >
                {isLocating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5" />
                )}
              </button>
              {pickupInputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setPickupInputValue("");
                    setPlaceSuggestions([]);
                  }}
                  className="w-6 h-6 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Drop Input */}
          <div className="relative flex items-center">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 block ring-4 ring-red-100" />
            </div>
            <Input
              type="text"
              placeholder="কোথায় যাবেন? গন্তব্য লিখুন (যেমন: লট ৮, নামখানা...)"
              value={dropInputValue}
              onChange={(e) => handleQueryPlaces(e.target.value, "drop")}
              onFocus={() => handleQueryPlaces(dropInputValue, "drop")}
              className="h-11 pl-9 pr-14 bg-slate-50/80 border-slate-200 text-slate-900 rounded-2xl text-xs font-bold shadow-2xs focus:border-red-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={handleSwap}
                title="পিকআপ ও গন্তব্য অদল-বদল"
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
              {dropInputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setDropInputValue("");
                    setPlaceSuggestions([]);
                    updateRoute(pickupInputValue, "", pickupCoords, dropCoords);
                  }}
                  className="w-6 h-6 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Real Live Place Suggestions List (In-flow expansion so it CANNOT hide behind map) */}
        {activeSearchField && (placeSuggestions.length > 0 || isSearchingPlaces) && (
          <div
            className="mt-3 pt-2.5 border-t border-slate-200/90 max-h-64 overflow-y-auto space-y-1.5 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="px-1 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {activeSearchField === "drop" ? "গন্তব্যের পরামর্শ (Google Maps / লাইভ অবস্থান)" : "পিকআপ পয়েন্টের পরামর্শ"}
              </span>
              <div className="flex items-center gap-2">
                {isSearchingPlaces && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>খোঁজা হচ্ছে...</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSearchField(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  ✕ বন্ধ করুন
                </button>
              </div>
            </div>

            {placeSuggestions.map((place, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(place)}
                className="w-full p-2.5 pt-2 rounded-xl hover:bg-emerald-50/90 text-left transition-all flex items-center gap-3 cursor-pointer group active:scale-[0.99] bg-white border border-slate-100/90 shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-900 truncate">{place.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      Google Maps
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{place.full_address}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO INTERACTIVE MAP                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-10 w-full h-80 sm:h-96 rounded-3xl overflow-hidden border border-slate-200/90 shadow-md">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Quick Action Overlay on Map: Real Drivers Count + GPS Button */}
        <div className="absolute top-3 left-3 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 shadow-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-bold text-slate-800">
            {realDrivers.length > 0 ? `${realDrivers.length}টি টোটো সক্রিয়` : "সুন্দরবন রাইডার্স"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => fetchCurrentLocation(true)}
          disabled={isLocating}
          title="আমার জিপিএস অবস্থান"
          className="absolute bottom-3 right-3 z-20 w-11 h-11 bg-white/95 hover:bg-white text-emerald-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-90"
        >
          {isLocating ? (
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          ) : (
            <LocateFixed className="w-5 h-5 text-emerald-600" />
          )}
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. SLIDING TOTO SELECTION & CONFIRM RIDE BOTTOM SHEET          */}
      {/* ------------------------------------------------------------- */}
      {dropInputValue && dropInputValue.trim() ? (
        <div
          className="p-4 rounded-3xl space-y-3 animate-in slide-in-from-bottom duration-300"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(240,253,244,0.85) 100%)",
            boxShadow: "0 10px 30px -5px rgba(16,185,129,0.12), 0 1px 0 rgba(255,255,255,1) inset",
            border: "1.5px solid rgba(16,185,129,0.35)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Single Toto Option Card */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-3xl shadow-md shadow-emerald-600/30 shrink-0">
                🛺
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-base text-slate-900">সুন্দরবন স্মার্ট টোটো</h4>
                  <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    ৪ আসন
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-semibold mt-0.5">
                  {nearestDriverInfo ? `~${nearestDriverInfo.etaMin} মিনিটে পিকআপ` : "২-৩ মিনিটে পিকআপ"} • দ্রুত ও নিরাপদ
                </p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-bold mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>সরকারি ভেরিফায়েড চালক • সরাসরি নন-স্টপ</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-emerald-700">
                ₹{fares.standard}.00
              </div>
              <span className="text-[10px] font-semibold text-slate-500 block">
                {distanceKm > 0 ? `${distanceKm} কিমি • ~${roadDurationMin} মি` : "ফিক্সড সঠিক ভাড়া"}
              </span>
            </div>
          </div>

          {/* Confirm Booking Button */}
          {onConfirmBooking && (
            <Button
              size="lg"
              onClick={onConfirmBooking}
              className="w-full h-14 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/30 cursor-pointer"
            >
              <span>🛺 টোটো রাইড কনফার্ম করুন (₹{fares.standard}.০০)</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-2.5 text-xs text-slate-500 font-semibold bg-white/70 rounded-2xl border border-slate-200/70 shadow-2xs backdrop-blur-md">
          📍 ম্যাপে ক্লিক করুন অথবা ওপরে গন্তব্য লিখে টোটো কনফার্ম করুন
        </div>
      )}
    </div>
  );
}
