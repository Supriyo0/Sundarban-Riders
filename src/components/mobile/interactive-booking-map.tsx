"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MapPin,
  LocateFixed,
  Search,
  RefreshCw,
  X,
  ShieldCheck,
  ArrowUpDown,
  Users,
  Moon,
  Layers,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Plus,
  Minus,
  Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import "leaflet/dist/leaflet.css";
import {
  DEFAULT_TOTO_PRICING,
  TotoPricingConfig,
  calculateTotoFare,
} from "@/lib/pricing/fare-calculator";
import {
  isLocationInServiceArea,
  DEFAULT_CENTRAL_HUB,
  SERVICE_UNAVAILABLE_MESSAGE,
  SERVICE_COVERED_ZONES,
} from "@/lib/pricing/service-area";

// Safely resolve Leaflet ES module in Next.js
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

interface PlaceSuggestion {
  name: string;
  full_address: string;
  lat: number;
  lng: number;
  isInServiceArea?: boolean;
}

// Regional Default Hub (Kakdwip Central Hub in South 24 Parganas)
const DEFAULT_REGION_HUB: [number, number] = DEFAULT_CENTRAL_HUB.coords;
const DEFAULT_REGION_NAME = DEFAULT_CENTRAL_HUB.name;

interface InteractiveBookingMapProps {
  initialPickup?: string;
  initialDrop?: string;
  initialPickupCoords?: [number, number];
  initialDropCoords?: [number, number];
  onRouteSelected?: (route: {
    pickup: string;
    drop: string;
    distanceKm: number;
    estimatedFare: number;
    rideTier?: RideTier;
    pickupCoords?: [number, number];
    dropCoords?: [number, number];
    paymentMode?: "cash" | "upi";
    passengerCount?: number;
  }) => void;
  onConfirmBooking?: () => void;
  isBlocked?: boolean;
}

export function InteractiveBookingMap({
  initialPickup = "",
  initialDrop = "",
  initialPickupCoords,
  initialDropCoords,
  onRouteSelected,
  onConfirmBooking,
  isBlocked = false,
}: InteractiveBookingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropMarkerRef = useRef<any>(null);
  const routeLineBorderRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const driverMarkersRef = useRef<{ id: string; marker: any }[]>([]);
  const onRouteSelectedRef = useRef(onRouteSelected);
  onRouteSelectedRef.current = onRouteSelected;

  // Validation
  const isInitialValid = Boolean(
    initialPickup &&
    initialPickup.trim() !== "" &&
    initialPickup !== "আপনার বর্তমান অবস্থান (Live GPS)" &&
    initialPickupCoords &&
    initialPickupCoords[0] !== 0
  );
  const [hasValidPickup, setHasValidPickup] = useState(isInitialValid);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Service territory tracking
  const [isDropOutOfService, setIsDropOutOfService] = useState(false);

  // Coordinates (Only set when valid; never auto-fill default hub coordinates)
  const [pickupCoords, setPickupCoords] = useState<[number, number]>(() => {
    if (initialPickupCoords && initialPickupCoords[0] !== 0) return initialPickupCoords;
    if (typeof window !== "undefined") {
      const latStr = localStorage.getItem("sr_last_known_lat");
      const lngStr = localStorage.getItem("sr_last_known_lng");
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
      }
    }
    return [0, 0];
  });
  const [dropCoords, setDropCoords] = useState<[number, number]>(
    initialDropCoords && initialDropCoords[0] !== 0 ? initialDropCoords : [0, 0]
  );

  // Input states
  const [pickupInputValue, setPickupInputValue] = useState(initialPickup || "");
  const [dropInputValue, setDropInputValue] = useState(initialDrop || "");

  // Active Map View Style
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");

  // Search State
  const [activeSearchField, setActiveSearchField] = useState<"pickup" | "drop" | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Top Floating Search Card Slider State
  const [topCardExpanded, setTopCardExpanded] = useState(true);
  const topDragStartYRef = useRef<number | null>(null);
  const topHasMovedRef = useRef<boolean>(false);

  const startTopDrag = (clientY: number) => {
    topDragStartYRef.current = clientY;
    topHasMovedRef.current = false;
  };
  const moveTopDrag = (clientY: number) => {
    if (topDragStartYRef.current === null) return;
    const delta = clientY - topDragStartYRef.current;
    if (Math.abs(delta) > 8) {
      topHasMovedRef.current = true;
    }
  };
  const endTopDrag = (clientY: number) => {
    if (topDragStartYRef.current !== null) {
      const delta = clientY - topDragStartYRef.current;
      if (topHasMovedRef.current) {
        if (topCardExpanded && delta < -18) {
          setTopCardExpanded(false);
        } else if (!topCardExpanded && delta > 18) {
          setTopCardExpanded(true);
        }
      }
    }
    topDragStartYRef.current = null;
    setTimeout(() => {
      topHasMovedRef.current = false;
    }, 120);
  };

  // Draggable Bottom Slider Sheet State (Unified Smooth Card with Tap + Swipe)
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const dragStartYRef = useRef<number | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  const startDrag = (clientY: number) => {
    dragStartYRef.current = clientY;
    hasMovedRef.current = false;
  };

  const moveDrag = (clientY: number) => {
    if (dragStartYRef.current === null) return;
    const delta = clientY - dragStartYRef.current;
    if (Math.abs(delta) > 8) {
      hasMovedRef.current = true;
    }
  };

  const endDrag = (clientY?: number) => {
    if (dragStartYRef.current !== null && clientY !== undefined) {
      const delta = clientY - dragStartYRef.current;
      if (hasMovedRef.current) {
        if (sheetExpanded && delta > 20) {
          setSheetExpanded(false);
        } else if (!sheetExpanded && delta < -20) {
          setSheetExpanded(true);
        }
      }
    }
    dragStartYRef.current = null;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 120);
  };

  const toggleSheet = () => {
    if (hasMovedRef.current) return;
    setSheetExpanded((prev) => !prev);
  };

  // Synchronization Refs (Prevents infinite render loops)
  const pickupCoordsRef = useRef(pickupCoords);
  pickupCoordsRef.current = pickupCoords;
  const dropCoordsRef = useRef(dropCoords);
  dropCoordsRef.current = dropCoords;
  const pickupInputRef = useRef(pickupInputValue);
  pickupInputRef.current = pickupInputValue;
  const dropInputRef = useRef(dropInputValue);
  dropInputRef.current = dropInputValue;
  const isLocatingRef = useRef(false);
  const hasAutoLocatedRef = useRef(false);

  // Geolocation
  const [isLocating, setIsLocating] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");

  // Metrics & Drivers
  const [distanceKm, setDistanceKm] = useState(0);
  const [roadDurationMin, setRoadDurationMin] = useState(5);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Passenger count & Pricing
  const [passengerCount, setPassengerCount] = useState<number>(3);
  const [pricingConfig, setPricingConfig] = useState<TotoPricingConfig>(DEFAULT_TOTO_PRICING);

  // Fetch live pricing
  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) {
          setPricingConfig(data.config);
          if (data.config.defaultPassengerCount) {
            setPassengerCount(data.config.defaultPassengerCount);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Dynamic Fare calculation
  const fareResult = useMemo(() => {
    const d = distanceKm > 0 ? distanceKm : 1.0;
    return calculateTotoFare(d, passengerCount, pricingConfig);
  }, [distanceKm, passengerCount, pricingConfig]);

  // STRICT 5 KM DRIVER FILTER: Only drivers within 5 km of user's pickup
  const nearbyDrivers = useMemo(() => {
    if (!hasValidPickup || pickupCoords[0] === 0) return [];
    return realDrivers
      .map((d) => {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
        const distKm = calculateDistanceKm(pickupCoords[0], pickupCoords[1], lat, lng);
        return {
          ...d,
          distanceKm: distKm,
        };
      })
      .filter((d): d is any => d !== null && d.distanceKm <= 5.0)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [realDrivers, pickupCoords, hasValidPickup]);

  // Nearest Driver Proximity (Strictly based on nearbyDrivers within 5 km)
  const nearestDriverInfo = useMemo(() => {
    if (nearbyDrivers.length === 0) return null;
    const closest = nearbyDrivers[0];
    const etaMin = Math.max(2, Math.round(closest.distanceKm * 2.5 + 1));
    return {
      distanceKm: closest.distanceKm,
      etaMin,
      driverName: closest.name || "টোটো চালক",
    };
  }, [nearbyDrivers]);

  // Reverse Geocoding helper
  const resolveLocationAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data && data.name) return data.name;
    } catch {}
    return `লোকেশন (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }, []);

  // Icon Generators (Uber Style)
  const createUberPickupIcon = useCallback((L: any) => {
    return L.divIcon({
      className: "uber-pickup-pin-wrapper",
      html: `
        <div class="uber-pin-bounce custom-draggable-pin" style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="background: #0f172a; color: white; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); white-space: nowrap; margin-bottom: 4px; border: 1.5px solid #10b981; display: flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span>
            <span>পিকআপ (ড্র্যাগ করুন)</span>
          </div>
          <div style="position: relative; width: 30px; height: 30px; background: #10b981; border: 3px solid white; border-radius: 50%; box-shadow: 0 6px 18px rgba(16,185,129,0.7); display: flex; align-items: center; justify-content: center;">
            <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            <div class="uber-pulse-ring" style="position: absolute; inset: -6px; border: 2px solid #10b981; border-radius: 50%; pointer-events: none;"></div>
          </div>
        </div>
      `,
      iconSize: [0, 0],
    });
  }, []);

  const createUberDropIcon = useCallback((L: any) => {
    return L.divIcon({
      className: "uber-drop-pin-wrapper",
      html: `
        <div class="uber-pin-bounce custom-draggable-pin" style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="background: #b91c1c; color: white; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(185,28,28,0.4); white-space: nowrap; margin-bottom: 4px; border: 1.5px solid white; display: flex; align-items: center; gap: 4px;">
            <span>🏁</span>
            <span>গন্তব্য (ড্র্যাগ করুন)</span>
          </div>
          <div style="position: relative; width: 30px; height: 30px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 6px 18px rgba(220,38,38,0.7); display: flex; align-items: center; justify-content: center;">
            <div style="width: 10px; height: 10px; background: white; border-radius: 2px;"></div>
          </div>
        </div>
      `,
      iconSize: [0, 0],
    });
  }, []);

  // -------------------------------------------------------------
  // CENTRALIZED MAP SYNCHRONIZER: Pins, Route Polyline & Bounds Animation
  // -------------------------------------------------------------
  const syncMapRouteAndPins = useCallback(
    async (
      pCoords: [number, number],
      dCoords: [number, number],
      pText: string,
      dText: string,
      options?: {
        fitBounds?: boolean;
        flyDuration?: number;
      }
    ) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const L = await getLeaflet();

      const hasValidP = pCoords[0] !== 0 && Boolean(pText && pText.trim());
      const hasValidD = dCoords[0] !== 0 && Boolean(dText && dText.trim());

      // 1. UPDATE OR CREATE PICKUP MARKER
      if (hasValidP) {
        if (!pickupMarkerRef.current) {
          const pMarker = L.marker(pCoords, {
            icon: createUberPickupIcon(L),
            draggable: true,
          }).addTo(map);

          pMarker.on("dragend", async (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            setPickupCoords(newPosCoords);
            setHasValidPickup(true);
            setLocationError(null);
            const resolved = await resolveLocationAddress(newPosCoords[0], newPosCoords[1]);
            setPickupInputValue(resolved);

            syncMapRouteAndPins(newPosCoords, dropCoordsRef.current, resolved, dropInputRef.current, {
              fitBounds: false,
            });
            toast.info(`📍 নতুন পিকআপ: ${resolved}`);
          });

          pickupMarkerRef.current = pMarker;
        } else {
          pickupMarkerRef.current.setLatLng(pCoords);
        }
      } else if (pickupMarkerRef.current && pCoords[0] === 0) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }

      // 2. UPDATE OR CREATE DROP MARKER
      if (hasValidD) {
        if (!dropMarkerRef.current) {
          const dMarker = L.marker(dCoords, {
            icon: createUberDropIcon(L),
            draggable: true,
          }).addTo(map);

          dMarker.on("dragend", async (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            setDropCoords(newPosCoords);
            const resolved = await resolveLocationAddress(newPosCoords[0], newPosCoords[1]);
            setDropInputValue(resolved);

            syncMapRouteAndPins(pickupCoordsRef.current, newPosCoords, pickupInputRef.current, resolved, {
              fitBounds: false,
            });
            toast.info(`🏁 নতুন গন্তব্য: ${resolved}`);
          });

          dropMarkerRef.current = dMarker;
        } else {
          dropMarkerRef.current.setLatLng(dCoords);
        }
      } else if (dropMarkerRef.current && !dText.trim()) {
        dropMarkerRef.current.remove();
        dropMarkerRef.current = null;
      }

      // 3. ROUTE CALCULATION & POLYLINES
      if (hasValidP && hasValidD) {
        setIsCalculatingRoute(true);
        let safeDist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
        if (safeDist === 0) safeDist = 1.0;
        let routeDuration = Math.max(3, Math.round(safeDist * 2.2));

        try {
          const res = await fetch(
            `/api/route?fromLat=${pCoords[0]}&fromLng=${pCoords[1]}&toLat=${dCoords[0]}&toLng=${dCoords[1]}`
          );
          const data = await res.json();

          if (data?.coordinates?.length) {
            if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs(data.coordinates);
            if (routeLineRef.current) routeLineRef.current.setLatLngs(data.coordinates);
            if (data.distanceKm) safeDist = data.distanceKm;
            if (data.durationMin) routeDuration = data.durationMin;
          } else {
            const straight = [pCoords, dCoords];
            if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs(straight);
            if (routeLineRef.current) routeLineRef.current.setLatLngs(straight);
          }
        } catch {
          const straight = [pCoords, dCoords];
          if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs(straight);
          if (routeLineRef.current) routeLineRef.current.setLatLngs(straight);
        } finally {
          setIsCalculatingRoute(false);
        }

        setDistanceKm(safeDist);
        setRoadDurationMin(routeDuration);

        const computedFare = calculateTotoFare(safeDist, passengerCount, pricingConfig);

        // Notify parent
        onRouteSelectedRef.current?.({
          pickup: pText,
          drop: dText,
          distanceKm: safeDist,
          estimatedFare: computedFare.totalFare,
          rideTier: "standard",
          pickupCoords: pCoords,
          dropCoords: dCoords,
          paymentMode: "cash",
          passengerCount,
        });

        // Uber Padded Camera Animation (leaves room for top search & bottom sheet)
        if (options?.fitBounds !== false) {
          try {
            map.flyToBounds([pCoords, dCoords], {
              paddingTopLeft: [50, 160],
              paddingBottomRight: [50, 340],
              duration: options?.flyDuration ?? 1.2,
              easeLinearity: 0.25,
              maxZoom: 16,
            });
          } catch {}
        }
      } else {
        // Clear route
        if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs([]);
        if (routeLineRef.current) routeLineRef.current.setLatLngs([]);
        setDistanceKm(0);

        if (options?.fitBounds !== false) {
          if (hasValidP) {
            map.flyTo(pCoords, 18, { duration: 1.2 });
          } else if (hasValidD) {
            map.flyTo(dCoords, 16, { duration: 1.0 });
          }
        }
      }
    },
    [
      createUberPickupIcon,
      createUberDropIcon,
      resolveLocationAddress,
      passengerCount,
      pricingConfig,
    ]
  );

  // Sync route selection with parent whenever passenger count changes
  useEffect(() => {
    if (dropInputValue && distanceKm > 0 && hasValidPickup) {
      onRouteSelectedRef.current?.({
        pickup: pickupInputValue,
        drop: dropInputValue,
        distanceKm,
        estimatedFare: fareResult.totalFare,
        rideTier: "standard",
        pickupCoords,
        dropCoords,
        paymentMode: "cash",
        passengerCount,
      });
    }
  }, [passengerCount, fareResult.totalFare, distanceKm, dropInputValue, pickupInputValue, pickupCoords, dropCoords, hasValidPickup]);

  // Load Real Drivers
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
    const interval = setInterval(loadRealDrivers, 8000);
    return () => clearInterval(interval);
  }, []);

  // Update Driver Markers on Map (Smooth update, no blinking/wobbling)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    getLeaflet().then((L: any) => {
      if (!mapInstanceRef.current) return;

      const currentIds = new Set(nearbyDrivers.map((d) => d.id || d.phone || d.name));

      // 1. Remove markers no longer nearby
      driverMarkersRef.current = driverMarkersRef.current.filter(({ id, marker }) => {
        if (!currentIds.has(id)) {
          marker.remove();
          return false;
        }
        return true;
      });

      const existingMap = new Map(driverMarkersRef.current.map((item) => [item.id, item.marker]));

      if (nearbyDrivers.length > 0) {
        nearbyDrivers.forEach((driver) => {
          const dId = driver.id || driver.phone || driver.name;
          const lat = Number(driver.latitude);
          const lng = Number(driver.longitude);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          const existingMarker = existingMap.get(dId);
          if (existingMarker) {
            // Smoothly move existing marker without destroying it
            existingMarker.setLatLng([lat, lng]);
            return;
          }

          const totoIcon = L.divIcon({
            className: "toto-real-driver-icon",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
                <div style="background: white; border: 1.5px solid #10b981; color: #065f46; font-weight: 800; font-size: 9.5px; padding: 2px 6px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                  🛺 ${driver.name || "টোটো চালক"} (${driver.distanceKm.toFixed(1)} কিমি)
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
            driverMarkersRef.current.push({ id: dId, marker: dm });
          } catch {}
        });
      }
    });
  }, [nearbyDrivers]);

  // Permission Request & Refresh Handler for Native & Web
  const handleRequestPermissionAndLocate = useCallback(async () => {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      try {
        const res = await Geolocation.requestPermissions();
        if (res.location === "granted") {
          toast.success("✅ লোকেশন অনুমতি দেওয়া হয়েছে!");
        }
      } catch (e) {
        console.warn("Permission request error:", e);
      }
    }
    fetchCurrentLocation(true);
  }, []);

  // Real GPS Geolocation Fetcher with Capacitor Native & Browser Web Support (Pure GPS, Zero IP guessing)
  const fetchCurrentLocation = useCallback(
    async (userInitiated = false) => {
      if (isLocatingRef.current && !userInitiated) return;
      isLocatingRef.current = true;
      setIsLocating(true);

      const isNative = Capacitor.isNativePlatform();

      const handleFail = (msg?: string, isDenied = false) => {
        isLocatingRef.current = false;
        setIsLocating(false);
        setGpsDetected(false);
        setPermissionState(isDenied ? "denied" : "prompt");

        if (userInitiated || isDenied) {
          const defaultDeniedMsg = isNative
            ? "⚠️ অ্যাপে লোকেশন পারমিশন দিন (Settings > Apps > Sundarban Riders > Permissions > Location 'Allow')"
            : "⚠️ ব্রাউজারে লোকেশন পারমিশন Blocked আছে। অনুগ্রহ করে ব্রাউজার সাইট সেটিংস থেকে Location 'Allow' করুন।";

          const errorMsg =
            msg ||
            (isDenied
              ? defaultDeniedMsg
              : "⚠️ জিপিএস অবস্থান নির্ণয় করা যায়নি। অনুগ্রহ করে ফোনের নোটিফিকেশন বার থেকে Location (GPS) চালু করুন।");

          setLocationError(errorMsg);
          if (userInitiated) {
            toast.error(errorMsg);
          }
        }
      };

      const handleSuccess = async (latitude: number, longitude: number, preResolvedName?: string) => {
        isLocatingRef.current = false;
        setIsLocating(false);

        if (isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) {
          handleFail();
          return;
        }

        const newPickup: [number, number] = [latitude, longitude];
        setPickupCoords(newPickup);
        setGpsDetected(true);
        setHasValidPickup(true);
        setPermissionState("granted");
        setLocationError(null);

        const detectedName = preResolvedName || (await resolveLocationAddress(latitude, longitude));
        setPickupInputValue(detectedName);

        try {
          localStorage.setItem("sr_last_known_lat", latitude.toString());
          localStorage.setItem("sr_last_known_lng", longitude.toString());
          if (detectedName) localStorage.setItem("sr_last_known_name", detectedName);
        } catch {}

        await syncMapRouteAndPins(newPickup, dropCoordsRef.current, detectedName, dropInputRef.current, {
          fitBounds: Boolean(dropInputRef.current && dropCoordsRef.current[0] !== 0),
          flyDuration: 1.2,
        });

        // Exact zoom-in like Uber when pickup is detected
        if (mapInstanceRef.current && (!dropCoordsRef.current || dropCoordsRef.current[0] === 0)) {
          try {
            mapInstanceRef.current.flyTo(newPickup, 17, { duration: 1.2 });
          } catch {}
        }

        const isOutOfService = !isLocationInServiceArea(latitude, longitude);
        if (isOutOfService) {
          toast.warning(`📍 অবস্থান সনাক্ত হয়েছে: ${detectedName} (সুন্দরবন মূল এলাকার বাইরে)`);
        } else if (userInitiated) {
          toast.success(`📍 বর্তমান অবস্থান সনাক্ত হয়েছে: ${detectedName}`);
        }
      };

      if (userInitiated) {
        toast.info("📍 স্যাটেলাইট জিপিএস থেকে সঠিক অবস্থান নির্ণয় করা হচ্ছে...");
      }

      // 1. Try Native Capacitor Geolocation first if in Android/iOS App
      if (isNative) {
        try {
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== "granted") {
            const req = await Geolocation.requestPermissions();
            if (req.location !== "granted") {
              handleFail(undefined, true);
              return;
            }
          }

          // Stage 1: Fast fused cached location
          try {
            const fastPos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 3000,
              maximumAge: 120000,
            });
            if (fastPos?.coords?.latitude && fastPos?.coords?.longitude) {
              await handleSuccess(fastPos.coords.latitude, fastPos.coords.longitude);
            }
          } catch {}

          // Stage 2: Satellite high accuracy position
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 5000,
          });

          if (position?.coords?.latitude && position?.coords?.longitude) {
            await handleSuccess(position.coords.latitude, position.coords.longitude);
            return;
          }
        } catch (capErr) {
          console.warn("Capacitor Geolocation error, trying standard browser GPS:", capErr);
        }
      }

      // 2. Standard Web Browser / WebView High-Accuracy Hardware GPS
      if (typeof window === "undefined" || !navigator.geolocation) {
        handleFail("⚠️ আপনার ডিভাইসে লোকেশন পরিষেবা মেলেনি। অনুগ্রহ করে পিকআপ স্থান অনুসন্ধান করুন।");
        return;
      }

      // Stage 1: Quick fused position
      navigator.geolocation.getCurrentPosition(
        (fastPos) => {
          handleSuccess(fastPos.coords.latitude, fastPos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
      );

      // Stage 2: High accuracy satellite request
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          // If high accuracy satellite GPS times out (e.g. indoors), try cellular/network triangulated GPS
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => handleSuccess(fallbackPos.coords.latitude, fallbackPos.coords.longitude),
            (fallbackErr) => {
              if (fallbackErr.code === 1 || err.code === 1) {
                const deniedText = isNative
                  ? "⚠️ অ্যাপে লোকেশন পারমিশন দিন (Settings > Apps > Sundarban Riders > Permissions > Location 'Allow')"
                  : "⚠️ ব্রাউজারে লোকেশন পারমিশন দিন বা ওপরে পিকআপ অনুসন্ধান করুন।";
                handleFail(deniedText, true);
              } else {
                handleFail("⚠️ জিপিএস অবস্থান নির্ণয় করা যায়নি। অনুগ্রহ করে মোবাইলের GPS অন করুন।");
              }
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
      );
    },
    [resolveLocationAddress, syncMapRouteAndPins]
  );

  // Proactively run geolocation once on mount
  useEffect(() => {
    if (!hasAutoLocatedRef.current) {
      hasAutoLocatedRef.current = true;
      fetchCurrentLocation(false);
    }
  }, [fetchCurrentLocation]);

  // Continuous Live GPS Watcher on Mount (Auto-locks as soon as satellite lock arrives)
  useEffect(() => {
    let watchId: number | null = null;
    let capWatchId: string | null = null;
    let isCancelled = false;

    const startWatching = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          capWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 5000 },
            async (position, err) => {
              if (isCancelled || err || !position?.coords) return;
              const { latitude, longitude } = position.coords;
              if (latitude && longitude && (pickupCoordsRef.current[0] === 0 || !hasValidPickup)) {
                const resolved = await resolveLocationAddress(latitude, longitude);
                if (!isCancelled) {
                  setPickupCoords([latitude, longitude]);
                  setPickupInputValue(resolved);
                  setHasValidPickup(true);
                  setGpsDetected(true);
                  setLocationError(null);
                  try {
                    localStorage.setItem("sr_last_known_lat", latitude.toString());
                    localStorage.setItem("sr_last_known_lng", longitude.toString());
                    if (resolved) localStorage.setItem("sr_last_known_name", resolved);
                  } catch {}
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
                  }
                }
              }
            }
          );
          return; // CRITICAL: Stop here on native! Do not also start Web watcher!
        } catch {}
      }

      if (typeof window !== "undefined" && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            if (isCancelled || !pos?.coords) return;
            const { latitude, longitude } = pos.coords;
            if (latitude && longitude && (pickupCoordsRef.current[0] === 0 || !hasValidPickup)) {
              const resolved = await resolveLocationAddress(latitude, longitude);
              if (!isCancelled) {
                setPickupCoords([latitude, longitude]);
                setPickupInputValue(resolved);
                setHasValidPickup(true);
                setGpsDetected(true);
                setLocationError(null);
                try {
                  localStorage.setItem("sr_last_known_lat", latitude.toString());
                  localStorage.setItem("sr_last_known_lng", longitude.toString());
                  if (resolved) localStorage.setItem("sr_last_known_name", resolved);
                } catch {}
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
                }
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 }
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
  }, [hasValidPickup, resolveLocationAddress]);

  // -------------------------------------------------------------
  // INITIALIZE LEAFLET MAP
  // -------------------------------------------------------------
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

        const initialCenter: [number, number] =
          hasValidPickup && pickupCoords[0] !== 0 ? pickupCoords : DEFAULT_REGION_HUB;

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 15,
          zoomControl: false,
        });

        // Google Maps Clean Street Tile Layer (Uber Look)
        const streetUrl = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        const tiles = L.tileLayer(streetUrl, {
          maxZoom: 20,
          attribution: "© Google Maps",
        }).addTo(map);
        tileLayerRef.current = tiles;

        // Route Polylines: Border track + Animated Inner Flow Line
        const lineBorder = L.polyline([], {
          color: "#064e3b",
          weight: 8,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
        routeLineBorderRef.current = lineBorder;

        const line = L.polyline([], {
          color: "#10b981",
          weight: 5,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          className: "uber-route-flow",
        }).addTo(map);
        routeLineRef.current = line;

        // Interactive Map Click Handler: Set Pickup or Drop by tapping on map!
        map.on("click", async (e: any) => {
          const clickedCoords: [number, number] = [e.latlng.lat, e.latlng.lng];
          const resolved = await resolveLocationAddress(clickedCoords[0], clickedCoords[1]);

          if (activeSearchField === "pickup" || !hasValidPickup || pickupCoords[0] === 0) {
            setPickupCoords(clickedCoords);
            setPickupInputValue(resolved);
            setHasValidPickup(true);
            setLocationError(null);
            setActiveSearchField(null);

            await syncMapRouteAndPins(clickedCoords, dropCoords, resolved, dropInputValue, {
              fitBounds: Boolean(dropInputValue),
              flyDuration: 1.0,
            });
            toast.success(`🟢 পিকআপ নির্বাচিত: ${resolved}`);
          } else {
            const inService = isLocationInServiceArea(clickedCoords[0], clickedCoords[1]);
            setIsDropOutOfService(!inService);
            if (!inService) {
              toast.error(
                "⚠️ সুন্দরবন রাইডার্স পরিষেবা এই এলাকায় উপলব্ধ নয় (কেবল ডায়মন্ড হারবার থেকে বকখালি ও সাগর অঞ্চলে প্রযোজ্য)"
              );
            }

            setDropCoords(clickedCoords);
            setDropInputValue(resolved);
            setActiveSearchField(null);
            setSheetExpanded(true);

            await syncMapRouteAndPins(pickupCoords, clickedCoords, pickupInputValue, resolved, {
              fitBounds: true,
              flyDuration: 1.2,
            });
            toast.success(`🏁 গন্তব্য নির্বাচিত: ${resolved}`);
          }
        });

        if (isMounted) {
          mapInstanceRef.current = map;
        }

        // Trigger initial marker and route sync
        setTimeout(() => {
          if (!isMounted) return;
          try {
            map.invalidateSize();
            syncMapRouteAndPins(pickupCoords, dropCoords, pickupInputValue, dropInputValue, {
              fitBounds: Boolean(dropInputValue),
              flyDuration: 0.8,
            });
          } catch {}
        }, 150);
      } catch (err) {
        console.warn("Leaflet map init warning:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      driverMarkersRef.current.forEach((item) => item.marker.remove());
      driverMarkersRef.current = [];
    };
  }, []);

  // Toggle Map Style (Streets vs Satellite)
  const toggleMapLayer = () => {
    const nextLayer = mapLayer === "streets" ? "satellite" : "streets";
    setMapLayer(nextLayer);

    if (tileLayerRef.current) {
      const newUrl =
        nextLayer === "streets"
          ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          : "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      tileLayerRef.current.setUrl(newUrl);
      toast.info(nextLayer === "streets" ? "🗺️ গুগল স্ট্রিট ভিউ সক্রিয়" : "🛰️ গুগল স্যাটেলাইট ভিউ সক্রিয়");
    }
  };

  // Place Search & Autocomplete
  const handleQueryPlaces = (query: string, field: "pickup" | "drop") => {
    if (field === "pickup") setPickupInputValue(query);
    else setDropInputValue(query);

    setActiveSearchField(field);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query || query.trim().length === 0) {
      setPlaceSuggestions([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
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
  const handleSelectSuggestion = async (place: PlaceSuggestion) => {
    const coords: [number, number] = [place.lat, place.lng];
    const inTerritory = place.isInServiceArea ?? isLocationInServiceArea(place.lat, place.lng);

    if (activeSearchField === "pickup") {
      if (!inTerritory) {
        toast.error("⚠️ সুন্দরবন রাইডার্স পরিষেবা বর্তমানে ডায়মন্ড হারবার থেকে বকখালি ও সাগর অঞ্চলে প্রযোজ্য। পিকআপটি সার্ভিস এলাকার বাইরে!");
      }
      setPickupInputValue(place.name);
      setPickupCoords(coords);
      setHasValidPickup(true);
      setLocationError(null);
      setActiveSearchField(null);
      setPlaceSuggestions([]);

      await syncMapRouteAndPins(coords, dropCoords, place.name, dropInputValue, {
        fitBounds: Boolean(dropInputValue),
        flyDuration: 1.2,
      });

      // Zoom in to level 18 on pickup location like Uber
      if (mapInstanceRef.current && (!dropCoords || dropCoords[0] === 0 || !dropInputValue)) {
        try {
          mapInstanceRef.current.flyTo(coords, 18, { duration: 1.2 });
        } catch {}
      }

      toast.success(`🟢 পিকআপ নির্বাচিত: ${place.name}`);
    } else {
      // User is selecting Drop!
      if (!inTerritory) {
        setIsDropOutOfService(true);
        toast.error("⚠️ এই গন্তব্যে পরিষেবা উপলব্ধ নয়! (কেবল ডায়মন্ড হারবার থেকে কাকদ্বীপ, নামখানা, বকখালি ও সাগর অঞ্চলে প্রযোজ্য)");
      } else {
        setIsDropOutOfService(false);
      }

      setDropInputValue(place.name);
      setDropCoords(coords);
      setActiveSearchField(null);
      setPlaceSuggestions([]);
      setSheetExpanded(true);

      if (!hasValidPickup || pickupCoords[0] === 0 || !pickupInputValue.trim()) {
        // User hasn't set pickup yet: do NOT auto-fill a random place!
        // Show drop marker and prompt user to enter pickup
        await syncMapRouteAndPins([0, 0], coords, "", place.name, {
          fitBounds: false,
          flyDuration: 1.2,
        });
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.flyTo(coords, 16, { duration: 1.2 });
          } catch {}
        }
        toast.info("🏁 গন্তব্য নির্ধারিত হয়েছে! এবার ওপরে আপনার পিকআপ স্থান লিখুন বা জিপিএস দিন।");
        setActiveSearchField("pickup");
      } else {
        await syncMapRouteAndPins(pickupCoords, coords, pickupInputValue, place.name, {
          fitBounds: true,
          flyDuration: 1.2,
        });
        toast.success(`🏁 গন্তব্য নির্বাচিত: ${place.name}`);
      }
    }
  };

  // Swap pickup and drop
  const handleSwap = async () => {
    if (!pickupInputValue && !dropInputValue) return;
    const nextPickup = dropInputValue;
    const nextDrop = pickupInputValue;
    const nextPickupCoords = dropCoords;
    const nextDropCoords = pickupCoords;

    setPickupInputValue(nextPickup);
    setDropInputValue(nextDrop);
    setPickupCoords(nextPickupCoords);
    setDropCoords(nextDropCoords);
    setHasValidPickup(Boolean(nextPickup.trim() && nextPickupCoords[0] !== 0));

    const inTerritory = isLocationInServiceArea(nextDropCoords[0], nextDropCoords[1]);
    setIsDropOutOfService(!inTerritory);

    await syncMapRouteAndPins(nextPickupCoords, nextDropCoords, nextPickup, nextDrop, {
      fitBounds: true,
      flyDuration: 1.0,
    });

    toast.success("পিকআপ ও গন্তব্য অদল-বদল করা হয়েছে ⇅");
  };

  // Safe Confirm Booking Trigger
  const handleConfirmClick = () => {
    if (isBlocked) return;

    if (!hasValidPickup || !pickupInputValue.trim() || pickupCoords[0] === 0) {
      const msg = "⚠️ সঠিক পিকআপ স্থান নির্বাচন করুন! জিপিএস অন করুন অথবা ওপরে পিকআপ স্থান লিখুন।";
      setLocationError(msg);
      toast.error(msg);
      setActiveSearchField("pickup");
      return;
    }

    if (!dropInputValue || !dropInputValue.trim()) {
      toast.error("⚠️ অনুগ্রহ করে আপনার গন্তব্য স্থান (Drop Location) নির্বাচন করুন।");
      setActiveSearchField("drop");
      return;
    }

    if (isDropOutOfService || !isLocationInServiceArea(dropCoords[0], dropCoords[1])) {
      toast.error(
        "🚫 দুঃখিত! নির্বাচিত গন্তব্যে রাইড বুকিং সম্ভব নয়। সুন্দরবন রাইডার্স বর্তমানে কেবল দক্ষিণ ২৪ পরগনার দক্ষিণ অংশে (ডায়মন্ড হারবার থেকে কাকদ্বীপ, নামখানা, সাগর ও বকখালি) উপলব্ধ।"
      );
      return;
    }

    onConfirmBooking?.();
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100dvh-114px)] flex-1 overflow-hidden select-none bg-slate-100">
      {/* ------------------------------------------------------------- */}
      {/* 1. EDGE-TO-EDGE FULL-SCREEN LEAFLET MAP CANVAS               */}
      {/* ------------------------------------------------------------- */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP FLOATING UBER SEARCH CARD & QUICK SHORTCUTS            */}
      {/* ------------------------------------------------------------- */}
      <div className={`absolute top-3 left-3 right-3 ${activeSearchField ? "z-50" : "z-30"} pointer-events-none`}>
        <div
          ref={searchContainerRef}
          className={`pointer-events-auto rounded-3xl p-3 shadow-[0_12px_36px_rgba(0,0,0,0.18)] border border-slate-200/90 space-y-2 backdrop-blur-xl transition-all duration-300 ${
            topCardExpanded
              ? activeSearchField
                ? "max-h-[82vh] overflow-y-auto"
                : "max-h-[70vh] overflow-y-auto"
              : "max-h-24 overflow-hidden"
          }`}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
          }}
        >
          {!topCardExpanded ? (
            /* Minimized Top Search Bar (Compact Peek Mode) */
            <div
              onClick={() => setTopCardExpanded(true)}
              onTouchStart={(e) => startTopDrag(e.touches[0].clientY)}
              onTouchMove={(e) => moveTopDrag(e.touches[0].clientY)}
              onTouchEnd={(e) => endTopDrag(e.changedTouches[0]?.clientY)}
              onMouseDown={(e) => startTopDrag(e.clientY)}
              onMouseUp={(e) => endTopDrag(e.clientY)}
              className="flex flex-col gap-1.5 cursor-pointer select-none"
              title="পিকআপ ও গন্তব্য পরিবর্তন করতে ট্যাপ বা নিচে নামান"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-100" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {pickupInputValue ? pickupInputValue.slice(0, 14) : "পিকআপ"}
                  </span>
                  <span className="text-slate-400 text-xs">➔</span>
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 shrink-0 ring-2 ring-red-100" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {dropInputValue ? dropInputValue.slice(0, 16) : "গন্তব্য খুঁজুন"}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[10.5px] font-black shrink-0 border border-emerald-200">
                  পরিবর্তন ⌄
                </span>
              </div>
              <div className="w-full pt-1 flex flex-col items-center justify-center gap-0.5">
                <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-emerald-500 rounded-full transition-colors" />
                <span className="text-[10px] font-bold text-emerald-700 animate-bounce">
                  পিকআপ ও ড্রপ পরিবর্তন করতে নিচে নামান ⌄
                </span>
              </div>
            </div>
          ) : (
            /* Full Expanded Search Inputs */
            <>
              {/* Explicit Location Error Banner if GPS Permission Fails */}
              {locationError && (
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-950 shadow-sm flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-[11px] font-bold leading-tight line-clamp-2">
                      {locationError}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestPermissionAndLocate}
                    disabled={isLocating}
                    className="shrink-0 text-[10.5px] font-black bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-xl shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                  >
                    {isLocating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
                    <span>অনুমতি দিন</span>
                  </button>
                </div>
              )}

              {/* Out of Service Territory Error Banner */}
              {isDropOutOfService && (
                <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 shadow-md space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>⚠️ এই অঞ্চলে সুন্দরবন রাইডার্স পরিষেবা উপলব্ধ নয়</span>
                  </div>
                  <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                    সুন্দরবন রাইডার্স পরিষেবা বর্তমানে কেবলমাত্র দক্ষিণ ২৪ পরগনার দক্ষিণ অংশে (ডায়মন্ড হারবার থেকে লক্ষ্মীকান্তপুর, কুলপি, কাকদ্বীপ, নামখানা, সাগরদ্বীপ ও বকখালি অঞ্চলে) উপলব্ধ।
                  </p>
                  <div className="text-[10px] text-rose-600 font-bold flex flex-wrap gap-1 pt-0.5">
                    <span>উপলব্ধ অঞ্চল:</span>
                    <span className="bg-rose-100 px-1.5 py-0.5 rounded">ডায়মন্ড হারবার</span>
                    <span className="bg-rose-100 px-1.5 py-0.5 rounded">কাকদ্বীপ</span>
                    <span className="bg-rose-100 px-1.5 py-0.5 rounded">নামখানা</span>
                    <span className="bg-rose-100 px-1.5 py-0.5 rounded">সাগরদ্বীপ</span>
                    <span className="bg-rose-100 px-1.5 py-0.5 rounded">বকখালি</span>
                  </div>
                </div>
              )}

              {/* Pickup & Drop Inputs with Uber Connecting Line */}
              <div
                className="relative flex flex-col gap-2"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Visual Connecting Line */}
                <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-slate-300 pointer-events-none z-10" />

                {/* Row 1: Pickup Input */}
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-20">
                    <span
                      className={`w-2.5 h-2.5 rounded-full block ring-4 ${
                        hasValidPickup
                          ? "bg-emerald-500 ring-emerald-100"
                          : "bg-amber-500 ring-amber-100 animate-pulse"
                      }`}
                    />
                  </div>
                  <Input
                    type="text"
                    placeholder={
                      locationError
                        ? "পিকআপ স্থান লিখুন (GPS মেলেনি)..."
                        : "পিকআপ অবস্থান লিখুন বা জিপিএস দিন..."
                    }
                    value={pickupInputValue}
                    onChange={(e) => {
                      setTopCardExpanded(true);
                      handleQueryPlaces(e.target.value, "pickup");
                    }}
                    onFocus={() => {
                      setTopCardExpanded(true);
                      handleQueryPlaces(pickupInputValue, "pickup");
                    }}
                    className={`h-10 pl-9 pr-18 bg-slate-50/90 text-slate-900 rounded-2xl text-xs font-bold shadow-2xs focus:border-emerald-500 transition-all ${
                      !hasValidPickup && !pickupInputValue.trim()
                        ? "border-amber-400 bg-amber-50/40 placeholder:text-amber-700"
                        : "border-slate-200/80"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={() => fetchCurrentLocation(true)}
                      disabled={isLocating}
                      title="আমার সঠিক GPS অবস্থান"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                        hasValidPickup
                          ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 hover:bg-amber-200 text-amber-800"
                      }`}
                    >
                      {isLocating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <LocateFixed className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {pickupInputValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickupInputValue("");
                          setHasValidPickup(false);
                          setPlaceSuggestions([]);
                          syncMapRouteAndPins([0, 0], dropCoords, "", dropInputValue, { fitBounds: false });
                        }}
                        className="w-6 h-6 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Drop Input (Where to?) */}
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-20">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500 block ring-4 ring-red-100" />
                  </div>
                  <Input
                    type="text"
                    placeholder="কোথায় যাবেন? (Where to? Search destination...)"
                    value={dropInputValue}
                    onChange={(e) => {
                      setTopCardExpanded(true);
                      handleQueryPlaces(e.target.value, "drop");
                    }}
                    onFocus={() => {
                      setTopCardExpanded(true);
                      handleQueryPlaces(dropInputValue, "drop");
                    }}
                    className={`h-10 pl-9 pr-14 bg-slate-50/90 text-slate-900 rounded-2xl text-xs font-bold shadow-2xs focus:border-red-400 transition-all ${
                      isDropOutOfService
                        ? "border-rose-400 bg-rose-50/50 text-rose-900"
                        : "border-slate-200/80"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={handleSwap}
                      title="পিকআপ ও গন্তব্য অদল-বদল"
                      className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                    {dropInputValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropInputValue("");
                          setIsDropOutOfService(false);
                          setPlaceSuggestions([]);
                          syncMapRouteAndPins(pickupCoords, [0, 0], pickupInputValue, "", { fitBounds: false });
                        }}
                        className="w-6 h-6 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Auto-Suggest Places Dropdown */}
              {activeSearchField && (placeSuggestions.length > 0 || isSearchingPlaces) && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="pt-2 border-t border-slate-200/80 max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="px-1 pb-1 flex items-center justify-between text-[10.5px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {activeSearchField === "drop" ? "Google Map Destination Suggestions" : "Google Map Pickup Suggestions"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSearchField(null);
                        setPlaceSuggestions([]);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-1.5 py-0.5 rounded bg-slate-100 cursor-pointer"
                    >
                      ✕ বন্ধ
                    </button>
                  </div>

                  {placeSuggestions.map((place, idx) => {
                    const inZone = place.isInServiceArea ?? isLocationInServiceArea(place.lat, place.lng);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSuggestion(place);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer border shadow-2xs active:scale-[0.99] ${
                          inZone
                            ? "hover:bg-emerald-50 bg-white border-slate-100"
                            : "hover:bg-rose-50 bg-rose-50/50 border-rose-200 opacity-90"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            inZone ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-slate-900 truncate block">{place.name}</span>
                            {!inZone && (
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full shrink-0">
                                Out of Service Area
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 truncate block mt-0.5">{place.full_address}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Top Card Slider Handle (Tap / Swipe Up to Minimize) - Only shown when not actively typing/searching */}
              {!activeSearchField && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setTopCardExpanded(false)}
                  onTouchStart={(e) => startTopDrag(e.touches[0].clientY)}
                  onTouchMove={(e) => moveTopDrag(e.touches[0].clientY)}
                  onTouchEnd={(e) => endTopDrag(e.changedTouches[0]?.clientY)}
                  onMouseDown={(e) => startTopDrag(e.clientY)}
                  onMouseUp={(e) => endTopDrag(e.clientY)}
                  className="w-full pt-2 pb-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer select-none group border-t border-slate-100/90"
                  title="মানচিত্র বড় করে দেখতে উপরে তুলুন"
                >
                  <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-slate-500 rounded-full transition-colors" />
                  <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>মানচিত্র দেখতে উপরে তুলুন (Swipe up / Tap to minimize)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FLOATING MAP ON-SCREEN CONTROLS                             */}
      {/* ------------------------------------------------------------- */}
      {/* Active Driver Radar Indicator (Top Left - Strictly 5 KM) */}
      <div className="absolute top-44 left-3.5 z-20 pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center gap-2 animate-in fade-in duration-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[11px] font-bold text-slate-800">
          {nearbyDrivers.length > 0
            ? `🛺 ${nearbyDrivers.length}টি সক্রিয় টোটো (৫ কিমি)`
            : "🛺 ৫ কিমিতে কোনো টোটো নেই"}
        </span>
      </div>

      {/* Map Interactive Zoom Controls (Right Side) */}
      <div className="absolute bottom-54 right-3.5 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
          }}
          title="জুম ইন"
          className="w-10 h-10 bg-white/95 hover:bg-white text-slate-700 rounded-2xl shadow-md border border-slate-200 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
          }}
          title="জুম আউট"
          className="w-10 h-10 bg-white/95 hover:bg-white text-slate-700 rounded-2xl shadow-md border border-slate-200 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        >
          <Minus className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {/* Map Layer Switcher: Street vs Satellite (Bottom Right) */}
      <button
        type="button"
        onClick={toggleMapLayer}
        title={mapLayer === "streets" ? "স্যাটেলাইট ভিউ" : "স্ট্রিট ভিউ"}
        className="absolute bottom-40 right-3.5 z-20 pointer-events-auto w-11 h-11 bg-white/95 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-slate-200 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
      >
        <Layers className="w-5 h-5 text-slate-700" />
      </button>

      {/* GPS Recenter Target Button (Bottom Right) */}
      <button
        type="button"
        onClick={() => fetchCurrentLocation(true)}
        disabled={isLocating}
        title="আমার জিপিএস অবস্থান"
        className={`absolute bottom-26 right-3.5 z-20 pointer-events-auto w-11 h-11 rounded-2xl shadow-lg border flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
          hasValidPickup
            ? "bg-white hover:bg-emerald-50 text-emerald-600 border-slate-200"
            : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300 animate-bounce"
        }`}
      >
        {isLocating ? (
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        ) : (
          <LocateFixed className="w-5 h-5" />
        )}
      </button>

      {/* ------------------------------------------------------------- */}
      {/* 4. SLIDING UBER BOTTOM SHEET (VEHICLE TIER & CONFIRM RIDE)     */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div
          className={`pointer-events-auto mx-2 sm:mx-3 mb-2 rounded-3xl bg-white/98 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.16)] border border-slate-200/90 p-3.5 sm:p-4 space-y-3 transition-all duration-300 ease-in-out select-none ${
            sheetExpanded
              ? "max-h-[86dvh] pb-10 overflow-y-auto"
              : dropInputValue && dropInputValue.trim()
              ? "max-h-[140px] overflow-hidden"
              : "max-h-[110px] overflow-hidden"
          }`}
        >
          {/* Interactive Drag / Tap Handle */}
          <div
            role="button"
            tabIndex={0}
            onClick={toggleSheet}
            onTouchStart={(e) => startDrag(e.touches[0].clientY)}
            onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
            onTouchEnd={(e) => endDrag(e.changedTouches[0]?.clientY)}
            onMouseDown={(e) => startDrag(e.clientY)}
            onMouseUp={(e) => endDrag(e.clientY)}
            className="w-full py-1 cursor-pointer flex flex-col items-center justify-center gap-1 select-none group touch-none"
            title="স্লাইডার উপরে বা নিচে টানুন বা ট্যাপ করুন (Drag or tap to toggle)"
          >
            <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-emerald-500 rounded-full transition-colors" />
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
              {sheetExpanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>মানচিত্র দেখতে নিচে নামান (Tap to minimize)</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  <span className="text-emerald-700 font-black">বুকিং ও ভাড়া দেখতে ট্যাপ বা উপরে তুলুন ⌃</span>
                </>
              )}
            </div>
          </div>

          {dropInputValue && dropInputValue.trim() ? (
            /* ============================================================ */
            /* STATE A: DESTINATION SELECTED                                 */
            /* ============================================================ */
            !sheetExpanded ? (
              /* Minimized Peek Mode */
              <div
                onClick={() => setSheetExpanded(true)}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 cursor-pointer shadow-xs active:scale-[0.99] transition-transform"
                title="সম্পূর্ণ বুকিং দেখতে ট্যাপ করুন"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                    🛺
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900">স্মার্ট টোটো</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">₹{fareResult.totalFare}.০০</span>
                      {isDropOutOfService && (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          পরিষেবা বাইরে
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold truncate block">
                      {pickupInputValue ? pickupInputValue.slice(0, 14) : "পিকআপ"} ➔ {dropInputValue.slice(0, 14)} • {distanceKm} কিমি
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetExpanded(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs shrink-0 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <span>বুকিং ⌃</span>
                </button>
              </div>
            ) : (
              /* Full Expanded Sheet */
              <>
                {/* Route Summary Pill */}
                <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold truncate max-w-[70%]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hasValidPickup ? "bg-emerald-500" : "bg-amber-500 animate-ping"
                      }`}
                    />
                    <span className="truncate">
                      {hasValidPickup && pickupInputValue
                        ? pickupInputValue.slice(0, 14)
                        : "⚠️ পিকআপ স্থান নির্বাচন করুন"}
                    </span>
                    <span>➔</span>
                    <span className="truncate text-slate-900">{dropInputValue.slice(0, 16)}</span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                    {isCalculatingRoute
                      ? "রুট গণনা..."
                      : distanceKm > 0
                      ? `${distanceKm} কিমি • ~${roadDurationMin} মি`
                      : "রোড রুট"}
                  </span>
                </div>

                {/* Service Territory Warning */}
                {isDropOutOfService && (
                  <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-2 text-rose-700 font-black">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>নির্বাচিত গন্তব্যে রাইড বুকিং সম্ভব নয়</span>
                    </div>
                    <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                      আমাদের পরিষেবা বর্তমানে কেবল দক্ষিণ ২৪ পরগনার দক্ষিণ অংশে (ডায়মন্ড হারবার, কাকদ্বীপ, নামখানা, বকখালি ও সাগরদ্বীপ) উপলব্ধ।
                    </p>
                  </div>
                )}

                {/* Uber Toto Vehicle Card */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-white border-2 border-emerald-500 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-600/30 shrink-0">
                      🛺
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-sm text-slate-900">সুন্দরবন স্মার্ট টোটো</h4>
                        {fareResult.isNight && (
                          <span className="text-[9px] font-black bg-purple-700 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Moon className="w-2.5 h-2.5" />
                            <span>+₹{fareResult.nightCharge}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold mt-0.5">
                        {nearbyDrivers.length > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            ⚡ ~{nearestDriverInfo?.etaMin || 3} মিনিটে পিকআপ ({nearestDriverInfo?.distanceKm.toFixed(1)} কিমি দূর)
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold">
                            ⚠️ ৫ কিমির মধ্যে কোনো সক্রিয় টোটো নেই
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-bold mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>ভেরিফায়েড চালক • নন-স্টপ</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                      ₹{fareResult.totalFare}.০০
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-500 block">
                      {distanceKm > 0 ? `দূরত্ব: ${distanceKm} কিমি` : "বেস ভাড়া: ₹৩০"}
                    </span>
                  </div>
                </div>

                {/* Passenger Selector */}
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>যাত্রী সংখ্যা (Passenger Count):</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      ৩ জনের পর প্রতি জন +₹২/কিমি
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { cnt: 3, label: "৩ জন", tag: "বেস ভাড়া" },
                      { cnt: 4, label: "৪ জন", tag: "+২/কিমি" },
                      { cnt: 5, label: "৫ জন", tag: "+৪/কিমি" },
                      { cnt: 6, label: "৬ জন", tag: "+৬/কিমি" },
                    ].map((item) => {
                      const isSelected = passengerCount === item.cnt;
                      return (
                        <button
                          key={item.cnt}
                          type="button"
                          onClick={() => setPassengerCount(item.cnt)}
                          className={`py-1.5 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30 scale-[1.02]"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                          }`}
                        >
                          <span className="text-xs font-black leading-tight">{item.label}</span>
                          <span
                            className={`text-[9px] font-bold leading-tight mt-0.5 ${
                              isSelected ? "text-emerald-100" : "text-emerald-700"
                            }`}
                          >
                            {item.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Mode */}
                <div className="flex items-center justify-between text-[10.5px] px-1 text-slate-600">
                  <span className="flex items-center gap-1 font-bold text-slate-700">
                    <span>💵 পেমেন্ট:</span> ট্রিপ শেষে নগদ / UPI ক্যাশ
                  </span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    ✓ সঠিক মিটার ভাড়া
                  </span>
                </div>

                {/* Confirm CTA */}
                <Button
                  size="lg"
                  disabled={isBlocked || isDropOutOfService}
                  onClick={handleConfirmClick}
                  className={`w-full h-13 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                    isBlocked || isDropOutOfService
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none"
                      : !hasValidPickup
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30 animate-pulse"
                      : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/30"
                  }`}
                >
                  <span>
                    {isBlocked
                      ? "🚫 অ্যাকাউন্ট সাময়িকভাবে স্থগিত"
                      : isDropOutOfService
                      ? "🚫 পরিষেবা উপলব্ধ নয় (শুধুমাত্র দক্ষিণ সুন্দরবন ও ডায়মন্ড হারবার)"
                      : !hasValidPickup
                      ? "⚠️ প্রথমে পিকআপ লোকেশন নির্ধারণ করুন"
                      : `🛺 টোটো রাইড বুক করুন • ₹${fareResult.totalFare}.০০`}
                  </span>
                </Button>
              </>
            )
          ) : (
            /* ============================================================ */
            /* STATE B: NO DESTINATION SELECTED                             */
            /* ============================================================ */
            !sheetExpanded ? (
              <div
                onClick={() => setSheetExpanded(true)}
                className="flex items-center justify-between p-2 rounded-2xl bg-emerald-50/70 border border-emerald-200 cursor-pointer shadow-xs select-none"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="text-emerald-600 font-black text-sm">🛺</span>
                  <span>কোথায় যেতে চান? গন্তব্য নির্বাচন করুন</span>
                </div>
                <span className="text-emerald-700 font-bold text-xs bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                  খুলুন ⌃
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                      👋 নমস্কার! কোথায় যেতে চান?
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {hasValidPickup
                        ? `পিকআপ: ${pickupInputValue.slice(0, 20)}`
                        : "ওপরে গন্তব্য লিখুন অথবা নিচের শর্টকাটে ট্যাপ করুন"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                    🛺
                  </div>
                </div>

                {/* Tap to search shortcut bar */}
                <button
                  type="button"
                  onClick={() => {
                    setTopCardExpanded(true);
                    setActiveSearchField("drop");
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-left text-xs font-bold text-slate-600 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>গন্তব্য নির্বাচন করুন... (Search destination)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <div className="flex items-center justify-between text-[11px] text-emerald-800 font-bold pt-1 px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {nearbyDrivers.length > 0
                        ? `🛺 ${nearbyDrivers.length}টি সক্রিয় টোটো (৫ কিমির মধ্যে)`
                        : "⚠️ ৫ কিমির মধ্যে কোনো সক্রিয় টোটো নেই"}
                    </span>
                  </span>
                  <span className="text-slate-500 font-semibold">⚡ দ্রুত পিকআপ</span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
