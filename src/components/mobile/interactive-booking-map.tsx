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
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { App } from "@capacitor/app";
import "leaflet/dist/leaflet.css";

// In-memory cache for ultra-fast instant route retrieval (0ms cache hits)
const routeClientCache = new Map<string, { distanceKm: number; durationMin: number; coordinates: [number, number][] }>();
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
  // Separate live-user-location pulsing dot marker (doesn't interfere with pickup pin)
  const liveUserDotRef = useRef<any>(null);
  const onRouteSelectedRef = useRef(onRouteSelected);
  onRouteSelectedRef.current = onRouteSelected;

  // Validation: Live GPS location is valid whenever coordinates are non-zero
  const isInitialValid = Boolean(
    initialPickup &&
    initialPickup.trim() !== "" &&
    initialPickupCoords &&
    initialPickupCoords[0] !== 0
  );
  const [hasValidPickup, setHasValidPickup] = useState(isInitialValid);
  const [isLocatingInitialLock, setIsLocatingInitialLock] = useState(!isInitialValid);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Real-time Compass Heading (Phone's Head Direction)
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const deviceHeadingRef = useRef<number>(0);

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

  // Reactive sync when parent updates initial coordinates or address
  useEffect(() => {
    if (initialPickupCoords && initialPickupCoords[0] !== 0 && initialPickupCoords[1] !== 0) {
      setPickupCoords((prev) => {
        if (prev[0] === initialPickupCoords[0] && prev[1] === initialPickupCoords[1]) return prev;
        return initialPickupCoords;
      });
      setHasValidPickup(true);
      setLocationError(null);
    }
    if (initialPickup && initialPickup.trim() !== "") {
      setPickupInputValue((prev) => (prev ? prev : initialPickup));
    }
  }, [initialPickupCoords, initialPickup]);

  // Active Map View Style
  const [mapLayer, setMapLayer] = useState<"streets" | "satellite">("streets");

  // Search State
  const [activeSearchField, setActiveSearchField] = useState<"pickup" | "drop" | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Array<{ name: string; full_address: string; lat: number; lng: number }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("sr_recent_searches_v2");
        if (stored) return JSON.parse(stored).slice(0, 3);
      } catch {}
    }
    return [];
  });
  const [hasStartedTyping, setHasStartedTyping] = useState<boolean>(false);
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

  // Subtle tactile haptic feedback for liquid interactive feel
  const triggerHaptic = useCallback((ms = 15) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  }, []);

  // Metrics & Drivers
  const [distanceKm, setDistanceKm] = useState(0);
  const [roadDurationMin, setRoadDurationMin] = useState(5);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  // True when user is typing a custom pickup — GPS watcher must NOT override it
  const hasManualPickupRef = useRef(false);
  const pickupInputFocusedRef = useRef(false);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const activeSearchFieldRef = useRef(activeSearchField);
  activeSearchFieldRef.current = activeSearchField;
  const sheetExpandedRef = useRef(sheetExpanded);
  sheetExpandedRef.current = sheetExpanded;
  const isCalculatingRouteRef = useRef(isCalculatingRoute);
  isCalculatingRouteRef.current = isCalculatingRoute;

  // Android Native Hardware Back Button & Web Escape Key Support (Never blocks UI)
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener("backButton", ({ canGoBack }) => {
        if (activeSearchFieldRef.current) {
          setActiveSearchField(null);
          setHasStartedTyping(false);
          setPlaceSuggestions([]);
          return;
        }
        if (isCalculatingRouteRef.current) {
          routeAbortControllerRef.current?.abort();
          setIsCalculatingRoute(false);
          return;
        }
        if (sheetExpandedRef.current) {
          setSheetExpanded(false);
          return;
        }
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      }).then((handle) => {
        removeListener = () => handle.remove();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeSearchFieldRef.current) {
          setActiveSearchField(null);
          setHasStartedTyping(false);
          setPlaceSuggestions([]);
        }
        if (isCalculatingRouteRef.current) {
          routeAbortControllerRef.current?.abort();
          setIsCalculatingRoute(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      removeListener?.();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Real-time Compass Heading Watcher (Rotates live user arrow with physical phone orientation)
  useEffect(() => {
    let active = true;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!active) return;
      let angle: number | null = null;

      // 1. iOS Safari compass heading (0 = North)
      if (typeof (e as any).webkitCompassHeading === "number") {
        angle = (e as any).webkitCompassHeading;
      }
      // 2. Android deviceorientationabsolute or alpha
      else if (e.alpha !== null) {
        angle = (360 - e.alpha) % 360;
      }

      if (angle !== null && !isNaN(angle)) {
        const rounded = Math.round(angle);
        if (Math.abs(rounded - deviceHeadingRef.current) >= 2) {
          deviceHeadingRef.current = rounded;
          setDeviceHeading(rounded);
          const headingCone = document.getElementById("sr-live-user-heading-cone");
          if (headingCone) {
            headingCone.style.transform = `translate(-50%, -50%) rotate(${rounded}deg)`;
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      const win = window as any;
      if ("ondeviceorientationabsolute" in win) {
        win.addEventListener("deviceorientationabsolute", handleOrientation, true);
      } else if ("ondeviceorientation" in win) {
        win.addEventListener("deviceorientation", handleOrientation, true);
      }
    }

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        const win = window as any;
        if ("ondeviceorientationabsolute" in win) {
          win.removeEventListener("deviceorientationabsolute", handleOrientation, true);
        } else if ("ondeviceorientation" in win) {
          win.removeEventListener("deviceorientation", handleOrientation, true);
        }
      }
    };
  }, []);

  // Periodically fetch active drivers from /api/drivers (Every 4.5 seconds)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const loadDrivers = async () => {
      try {
        const res = await fetch("/api/drivers");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.drivers)) {
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
            setRealDrivers((prev) => {
              if (prev.length !== valid.length) return valid;
              const hasChanged = valid.some((d: any, i: number) => {
                const p = prev[i];
                return (
                  !p ||
                  p.id !== d.id ||
                  Math.abs(Number(p.latitude) - Number(d.latitude)) > 0.0001 ||
                  Math.abs(Number(p.longitude) - Number(d.longitude)) > 0.0001
                );
              });
              return hasChanged ? valid : prev;
            });
          }
        }
      } catch {}
    };
    loadDrivers();
    timer = setInterval(loadDrivers, 4500);
    return () => clearInterval(timer);
  }, []);

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

  // NEARBY ACTIVE DRIVERS: Real drivers within 8.0 km radius of pickup or region hub
  const nearbyDrivers = useMemo(() => {
    const centerLat = pickupCoords[0] !== 0 ? pickupCoords[0] : (dropCoords[0] !== 0 ? dropCoords[0] : 21.8760);
    const centerLng = pickupCoords[1] !== 0 ? pickupCoords[1] : (dropCoords[1] !== 0 ? dropCoords[1] : 88.1920);

    return realDrivers
      .map((d) => {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
        const distKm = calculateDistanceKm(centerLat, centerLng, lat, lng);
        return {
          ...d,
          distanceKm: distKm,
        };
      })
      .filter((d): d is any => d !== null && d.distanceKm <= 8.0)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [realDrivers, pickupCoords, dropCoords]);

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
        const cacheKey = `${pCoords[0].toFixed(4)},${pCoords[1].toFixed(4)}-${dCoords[0].toFixed(4)},${dCoords[1].toFixed(4)}`;
        let safeDist = 0;
        let routeDuration = 5;
        let routeCoords: [number, number][] = [];
        let controller: AbortController | null = null;

        if (routeClientCache.has(cacheKey)) {
          // Instant cache hit — 0 ms!
          const cached = routeClientCache.get(cacheKey)!;
          safeDist = cached.distanceKm;
          routeDuration = cached.durationMin;
          routeCoords = cached.coordinates;
        } else {
          setIsCalculatingRoute(true);
          routeAbortControllerRef.current?.abort();
          controller = new AbortController();
          routeAbortControllerRef.current = controller;

          try {
            const res = await fetch(
              `/api/route?fromLat=${pCoords[0]}&fromLng=${pCoords[1]}&toLat=${dCoords[0]}&toLng=${dCoords[1]}`,
              { signal: controller.signal }
            );
            const data = await res.json();

            if (data?.coordinates?.length) {
              routeCoords = data.coordinates;
              safeDist = data.distanceKm || calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
              routeDuration = data.durationMin || Math.max(3, Math.round(safeDist * 2.5));

              routeClientCache.set(cacheKey, {
                distanceKm: safeDist,
                durationMin: routeDuration,
                coordinates: routeCoords,
              });
            }
          } catch (e: any) {
            if (e?.name === "AbortError" || controller?.signal.aborted) {
              // Superseded by newer search — exit immediately without drawing straight fallback line!
              return;
            }
            console.warn("Route API fetch error:", e);
          } finally {
            if (!controller?.signal.aborted) {
              setIsCalculatingRoute(false);
            }
          }
        }

        if (controller?.signal.aborted) {
          return;
        }

        // If coordinates found, plot them
        if (routeCoords.length > 0) {
          if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs(routeCoords);
          if (routeLineRef.current) routeLineRef.current.setLatLngs(routeCoords);
        } else {
          // Fallback if network was offline
          const directDist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
          safeDist = Math.max(1.0, Math.round(directDist * 1.42 * 10) / 10);
          routeDuration = Math.max(3, Math.round(safeDist * 2.8));
          const curved: [number, number][] = [];
          const dLat = dCoords[0] - pCoords[0];
          const dLng = dCoords[1] - pCoords[1];
          for (let i = 0; i <= 14; i++) {
            const frac = i / 14;
            const curve = Math.sin(frac * Math.PI) * 0.08;
            curved.push([pCoords[0] + dLat * frac - dLng * curve, pCoords[1] + dLng * frac + dLat * curve]);
          }
          if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs(curved);
          if (routeLineRef.current) routeLineRef.current.setLatLngs(curved);
        }

        if (safeDist === 0) {
          safeDist = Math.max(1.0, Math.round(calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]) * 1.42 * 10) / 10);
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
            existingMarker.setLatLng([lat, lng]);
            return;
          }

          const totoIcon = L.divIcon({
            className: "toto-real-driver-icon",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); cursor: pointer;">
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
            dm.bindPopup(`
              <div style="font-family: sans-serif; padding: 4px; min-width: 140px;">
                <strong style="color: #065f46; font-size: 12px; display: block;">🛺 ${driver.name || "টোটো চালক"}</strong>
                <p style="margin: 2px 0 0; font-size: 10.5px; color: #475569;">${driver.toto_number || "টোটো নং নাই"} • ~${driver.distanceKm.toFixed(1)} কিমি দূর</p>
                <span style="display: inline-block; margin-top: 4px; font-size: 9.5px; font-weight: bold; color: #047857; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">🟢 রাইডের জন্য প্রস্তুত</span>
              </div>
            `);
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
          console.log("[Geolocation] permission granted via request");
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
        setIsLocatingInitialLock(false);
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
        setIsLocatingInitialLock(false);

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

        // Immediately update parent state with accurate live pickup coordinates
        onRouteSelectedRef.current?.({
          pickup: detectedName,
          drop: dropInputRef.current,
          pickupCoords: newPickup,
          dropCoords: dropCoordsRef.current,
          distanceKm: distanceKm || 0,
          estimatedFare: fareResult.totalFare || 30,
          rideTier: "standard",
          paymentMode: "cash",
          passengerCount,
        });

        await syncMapRouteAndPins(newPickup, dropCoordsRef.current, detectedName, dropInputRef.current, {
          fitBounds: Boolean(dropInputRef.current && dropCoordsRef.current[0] !== 0),
          flyDuration: 1.2,
        });

        // Exact zoom-in like Uber when pickup is detected or target button clicked
        if (mapInstanceRef.current) {
          try {
            if (userInitiated || (!dropCoordsRef.current || dropCoordsRef.current[0] === 0)) {
              mapInstanceRef.current.flyTo(newPickup, 17, { duration: 1.0 });
            }
          } catch {}
        }

        const isOutOfService = !isLocationInServiceArea(latitude, longitude);
        if (isOutOfService) {
          toast.warning(`📍 অবস্থান সনাক্ত হয়েছে: ${detectedName} (সুন্দরবন মূল এলাকার বাইরে)`);
        }
      };

      // 1. Try Native Capacitor Pure Satellite GPS first
      if (isNative) {
        try {
          const perm = await Geolocation.checkPermissions();
          const hasLocationPerm =
            perm.location === "granted" ||
            (perm as any).coarseLocation === "granted" ||
            (perm as any).state === "granted";

          if (!hasLocationPerm) {
            const req = await Geolocation.requestPermissions();
            const reqGranted =
              req.location === "granted" ||
              (req as any).coarseLocation === "granted" ||
              (req as any).state === "granted";
            if (!reqGranted) {
              if (userInitiated) handleFail(undefined, true);
              else setIsLocatingInitialLock(false);
              return;
            }
          }

          // Pure Hardware Satellite GPS with fresh live fix (maximumAge: 0)
          try {
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });

            if (position?.coords?.latitude && position?.coords?.longitude) {
              const acc = position.coords.accuracy || 10;
              // Reject coarse cellular guesses (> 1500 meters) that jump to distant towers
              if (acc <= 1500) {
                await handleSuccess(position.coords.latitude, position.coords.longitude);
                return;
              } else {
                console.warn("[GPS] Low accuracy cell tower guess rejected:", acc, "m");
              }
            }
          } catch (e) {
            console.warn("Capacitor high accuracy GPS error:", e);
          }
        } catch (capErr) {
          console.warn("Capacitor Geolocation error, trying standard browser GPS:", capErr);
        }
      }

      // 2. Standard Web Browser / WebView Pure High-Accuracy Satellite GPS
      if (typeof window === "undefined" || !navigator.geolocation) {
        setIsLocatingInitialLock(false);
        if (userInitiated) {
          handleFail("⚠️ আপনার ডিভাইসে লোকেশন পরিষেবা মেলেনি। অনুগ্রহ করে পিকআপ স্থান অনুসন্ধান করুন।");
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const acc = pos.coords.accuracy || 10;
          if (acc <= 1500) {
            handleSuccess(pos.coords.latitude, pos.coords.longitude);
          } else {
            console.warn("[Web GPS] Cellular guess rejected due to poor accuracy:", acc, "m");
            // If accuracy is too poor, don't jump to Kolkata cell tower
            setIsLocatingInitialLock(false);
          }
        },
        (err) => {
          setIsLocatingInitialLock(false);
          if (userInitiated) {
            if (err.code === 1) {
              const deniedText = isNative
                ? "⚠️ অ্যাপে লোকেশন পারমিশন দিন (Settings > Apps > Sundarban Riders > Permissions > Location 'Allow')"
                : "⚠️ ব্রাউজারে লোকেশন পারমিশন Blocked আছে। অনুগ্রহ করে সাইট সেটিংস থেকে Location 'Allow' করুন।";
              handleFail(deniedText, true);
            } else {
              handleFail("⚠️ জিপিএস অবস্থান নির্ণয় করা যায়নি। অনুগ্রহ করে মোবাইলের GPS অন করুন।");
            }
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  // Continuous Live GPS Watcher on Mount
  // Rules:
  //   - Only updates pickup text/coords when user is NOT actively typing in the pickup field
  //   - Always updates the live-user-dot marker smoothly (separate from pickup pin)
  //   - Never causes map flyTo if user has already set a manual pickup
  useEffect(() => {
    let watchId: number | null = null;
    let capWatchId: string | null = null;
    let isCancelled = false;

    const updateLiveUserDot = async (latitude: number, longitude: number) => {
      // Update or create the pulsing live-user-dot on the map
      if (!mapInstanceRef.current) return;
      const L = await getLeaflet();
      if (isCancelled || !mapInstanceRef.current) return;

      const currentHeading = deviceHeadingRef.current || 0;

      if (liveUserDotRef.current) {
        // Smooth positional update — no flickering, no re-render
        liveUserDotRef.current.setLatLng([latitude, longitude]);
      } else {
        const liveIcon = L.divIcon({
          className: "sr-live-user-dot-container",
          html: `<div style="position: relative; width: 44px; height: 44px; transform: translate(-50%, -50%); pointer-events: none;">
            <!-- Rotating Direction Beam & Arrow (Phone's Head) -->
            <div id="sr-live-user-heading-cone" style="
              position: absolute;
              top: 50%;
              left: 50%;
              width: 50px;
              height: 50px;
              transform: translate(-50%, -50%) rotate(${currentHeading}deg);
              transition: transform 0.12s linear;
              pointer-events: none;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <!-- Field of View Light Beam -->
              <div style="
                position: absolute;
                top: -12px;
                width: 0;
                height: 0;
                border-left: 20px solid transparent;
                border-right: 20px solid transparent;
                border-top: 30px solid rgba(16, 185, 129, 0.4);
                filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.6));
              "></div>
              <!-- Phone's Head Arrow Pointer -->
              <div style="
                position: absolute;
                top: -16px;
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-bottom: 12px solid #065f46;
                filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
              "></div>
            </div>

            <!-- Pulsing Radar Wave -->
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 32px;
              height: 32px;
              border: 2px solid rgba(16,185,129,0.5);
              border-radius: 50%;
              animation: sr-live-pulse 1.8s ease-out infinite;
              pointer-events: none;
            "></div>

            <!-- Central User Position Dot (Google / Apple Maps Style) -->
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 20px;
              height: 20px;
              background: #10b981;
              border: 3.5px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 4px 14px rgba(16, 185, 129, 0.7);
              z-index: 5;
            ">
              <div style="width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #34d399, #059669);"></div>
            </div>
          </div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        try {
          liveUserDotRef.current = L.marker([latitude, longitude], {
            icon: liveIcon,
            zIndexOffset: 500,
            interactive: false,
          }).addTo(mapInstanceRef.current);
        } catch {}
      }
    };

    const startWatching = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          capWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, maximumAge: 3000 },
            async (position, err) => {
              if (isCancelled || err || !position?.coords) return;
              const { latitude, longitude } = position.coords;
              if (!latitude || !longitude) return;

              // Always update the live dot
              await updateLiveUserDot(latitude, longitude);

              // Only update pickup text+coords if user is NOT actively typing and no manual override
              const isTyping = pickupInputFocusedRef.current || hasManualPickupRef.current;
              if (!isTyping || pickupCoordsRef.current[0] === 0) {
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
                  // Only pan if user has NOT manually set pickup
                  if (mapInstanceRef.current && !hasManualPickupRef.current) {
                    mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
                  }
                }
              }
            }
          );
          return;
        } catch {}
      }

      if (typeof window !== "undefined" && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            if (isCancelled || !pos?.coords) return;
            const { latitude, longitude } = pos.coords;
            if (!latitude || !longitude) return;

            // Always update the live dot
            await updateLiveUserDot(latitude, longitude);

            // Only update pickup text+coords if user is NOT actively typing and no manual override
            const isTyping = pickupInputFocusedRef.current || hasManualPickupRef.current;
            if (!isTyping || pickupCoordsRef.current[0] === 0) {
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
                if (mapInstanceRef.current && !hasManualPickupRef.current) {
                  mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
                }
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
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
      // Remove live dot on cleanup
      if (liveUserDotRef.current) {
        try { liveUserDotRef.current.remove(); } catch {}
        liveUserDotRef.current = null;
      }
    };
  }, [resolveLocationAddress]);

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

        // Google Maps Clean Street Tile Layer (Multi-subdomain high concurrency)
        const streetUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        const tiles = L.tileLayer(streetUrl, {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 20,
          keepBuffer: 8,
          updateWhenIdle: false,
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
          ? "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          : "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
      tileLayerRef.current.setUrl(newUrl);
    }
  };

  // Place Search & Autocomplete
  const handleQueryPlaces = (query: string, field: "pickup" | "drop", userIsTyping = true) => {
    if (field === "pickup") {
      setPickupInputValue(query);
      // Lock the GPS watcher from overriding pickup while the user is typing
      if (userIsTyping && query.trim().length > 0) {
        hasManualPickupRef.current = true;
      } else if (!query.trim()) {
        // User cleared the field — allow GPS to take over again
        hasManualPickupRef.current = false;
      }
    } else {
      setDropInputValue(query);
    }

    setActiveSearchField(field);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!userIsTyping || !query || query.trim().length === 0) {
      setHasStartedTyping(false);
      setPlaceSuggestions([]);
      return;
    }

    setHasStartedTyping(true);

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const biasLat = pickupCoords[0] || 21.876;
        const biasLng = pickupCoords[1] || 88.192;
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}&lat=${biasLat}&lng=${biasLng}`
        );
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
    }, 90);
  };

  // Select Place Suggestion (Saves to Recent 3 Searches, Removes Address Lock)
  const handleSelectSuggestion = async (place: PlaceSuggestion | { name: string; full_address: string; lat: number; lng: number }) => {
    const coords: [number, number] = [place.lat, place.lng];

    // Save to Top 3 Recent Searches
    try {
      const updatedRecent = [
        { name: place.name, full_address: place.full_address || place.name, lat: place.lat, lng: place.lng },
        ...recentSearches.filter((s) => s.name.toLowerCase() !== place.name.toLowerCase()),
      ].slice(0, 3);
      setRecentSearches(updatedRecent);
      if (typeof window !== "undefined") {
        localStorage.setItem("sr_recent_searches_v2", JSON.stringify(updatedRecent));
      }
    } catch {}

    // Never lock any address
    setIsDropOutOfService(false);

    if (activeSearchField === "pickup") {
      // User selected a suggestion: clear manual lock so GPS can resume later
      hasManualPickupRef.current = false;
      pickupInputFocusedRef.current = false;
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
    } else {
      // User is selecting Drop!
      setDropInputValue(place.name);
      setDropCoords(coords);
      setActiveSearchField(null);
      setPlaceSuggestions([]);
      setSheetExpanded(true);

      if (!hasValidPickup || pickupCoords[0] === 0 || !pickupInputValue.trim()) {
        await syncMapRouteAndPins([0, 0], coords, "", place.name, {
          fitBounds: false,
          flyDuration: 1.2,
        });
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.flyTo(coords, 16, { duration: 1.2 });
          } catch {}
        }
        setActiveSearchField("pickup");
      } else {
        await syncMapRouteAndPins(pickupCoords, coords, pickupInputValue, place.name, {
          fitBounds: true,
          flyDuration: 1.2,
        });
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
  };

  // Safe Confirm Booking Trigger
  const handleConfirmClick = () => {
    if (isBlocked) return;

    // Auto-recover coordinates from localStorage if pickupCoords was still 0
    let currentPCoords = pickupCoords;
    if (currentPCoords[0] === 0 && typeof window !== "undefined") {
      const latStr = localStorage.getItem("sr_last_known_lat");
      const lngStr = localStorage.getItem("sr_last_known_lng");
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          currentPCoords = [lat, lng];
          setPickupCoords(currentPCoords);
          setHasValidPickup(true);
        }
      }
    }

    if (!pickupInputValue.trim() || currentPCoords[0] === 0) {
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

    onConfirmBooking?.();
  };

  return (
    <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden select-none bg-slate-100">
      {/* ------------------------------------------------------------- */}
      {/* 1. EDGE-TO-EDGE FULL-SCREEN LEAFLET MAP CANVAS               */}
      {/* ------------------------------------------------------------- */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP FLOATING LIQUID GLASS UBER SEARCH CARD & QUICK SHORTCUTS */}
      {/* ------------------------------------------------------------- */}
      <div className={`absolute top-16 sm:top-18 left-3 right-3 ${activeSearchField ? "z-50" : "z-30"} pointer-events-none`}>
        <div
          ref={searchContainerRef}
          className={`pointer-events-auto rounded-3xl p-3 sm:p-3.5 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border border-white/80 dark:border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.10),inset_0_1px_1px_rgba(255,255,255,0.9)] space-y-2.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            topCardExpanded
              ? activeSearchField
                ? "max-h-[82vh] overflow-y-auto"
                : "max-h-[70vh] overflow-y-auto"
              : "max-h-24 overflow-hidden"
          }`}
        >
          {!topCardExpanded ? (
            /* Minimized Top Search Bar (Compact Peek Mode with Liquid Sheen) */
            <div
              onClick={() => {
                triggerHaptic(12);
                setTopCardExpanded(true);
              }}
              onTouchStart={(e) => startTopDrag(e.touches[0].clientY)}
              onTouchMove={(e) => moveTopDrag(e.touches[0].clientY)}
              onTouchEnd={(e) => endTopDrag(e.changedTouches[0]?.clientY)}
              onMouseDown={(e) => startTopDrag(e.clientY)}
              onMouseUp={(e) => endTopDrag(e.clientY)}
              className="flex flex-col gap-1.5 cursor-pointer select-none group"
              title="পিকআপ ও গন্তব্য পরিবর্তন করতে ট্যাপ বা নিচে নামান"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-500/20 shadow-xs" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {pickupInputValue ? pickupInputValue.slice(0, 14) : "পিকআপ"}
                  </span>
                  <span className="text-slate-400 text-xs font-bold">➔</span>
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0 ring-4 ring-rose-500/20 shadow-xs" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {dropInputValue ? dropInputValue.slice(0, 16) : "গন্তব্য খুঁজুন"}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-800 text-[10.5px] font-black shrink-0 border border-emerald-500/25 shadow-2xs">
                  পরিবর্তন ⌄
                </span>
              </div>
              <div className="w-full pt-1 flex flex-col items-center justify-center gap-0.5">
                <div className="w-12 h-1.5 bg-slate-300/80 group-hover:bg-emerald-500 rounded-full transition-colors" />
                <span className="text-[10px] font-bold text-emerald-700 animate-pulse">
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
                      handleQueryPlaces(e.target.value, "pickup", true);
                    }}
                    onFocus={() => {
                      setTopCardExpanded(true);
                      setActiveSearchField("pickup");
                      setHasStartedTyping(false);
                      setPlaceSuggestions([]);
                      // Mark pickup input as focused so GPS watcher doesn't override
                      pickupInputFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      // Only release focus lock if nothing was typed (i.e., user didn't modify)
                      setTimeout(() => {
                        pickupInputFocusedRef.current = false;
                      }, 300);
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
                      onClick={() => {
                        // GPS button tapped: release manual lock so GPS takes over
                        hasManualPickupRef.current = false;
                        pickupInputFocusedRef.current = false;
                        fetchCurrentLocation(true);
                      }}
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
                          // Clear pickup: release manual lock so GPS can fill it again
                          hasManualPickupRef.current = false;
                          pickupInputFocusedRef.current = false;
                          setPickupInputValue("");
                          setHasValidPickup(false);
                          setHasStartedTyping(false);
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
                      handleQueryPlaces(e.target.value, "drop", true);
                    }}
                    onFocus={() => {
                      setTopCardExpanded(true);
                      setActiveSearchField("drop");
                      setHasStartedTyping(false);
                      setPlaceSuggestions([]);
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
                      onClick={() => {
                        triggerHaptic(22);
                        handleSwap();
                      }}
                      title="পিকআপ ও গন্তব্য অদল-বদল"
                      className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 flex items-center justify-center transition-all active:scale-85 active:rotate-180 cursor-pointer shadow-xs border border-slate-200/60"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                    {dropInputValue && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropInputValue("");
                          setIsDropOutOfService(false);
                          setHasStartedTyping(false);
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

              {/* Live Auto-Suggest Places & Recent 3 Searches Dropdown */}
              {activeSearchField && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="pt-2 border-t border-slate-200/80 max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="px-1 pb-1 flex items-center justify-between text-[10.5px] font-bold text-slate-600">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {!hasStartedTyping
                        ? "পূর্ববর্তী ৩টি অনুসন্ধান (Recent Searches)"
                        : "সঠিক ঠিকানা সাজেশন (Uber/Rapido)"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSearchField(null);
                        setHasStartedTyping(false);
                        setPlaceSuggestions([]);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-1.5 py-0.5 rounded bg-slate-100 cursor-pointer"
                    >
                      ✕ বন্ধ
                    </button>
                  </div>

                  {/* 1. Top 3 Recent Searches — SHOWN UNTIL USER STARTS TYPING */}
                  {!hasStartedTyping && (
                    <div className="space-y-1 pt-1">
                      {recentSearches.length > 0 ? (
                        recentSearches.map((place, idx) => (
                          <button
                            key={`recent-${idx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestion(place);
                            }}
                            className="w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer border border-emerald-100/90 bg-emerald-50/50 hover:bg-emerald-100/70 shadow-2xs active:scale-[0.99]"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div className="overflow-hidden flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-black text-slate-900 truncate block">{place.name}</span>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full shrink-0">
                                  Recent 🕒
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 truncate block mt-0.5">{place.full_address}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-500">
                          গন্তব্য অনুসন্ধানের জন্য টাইপ করুন অথবা ম্যাপে পিন করুন
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Live Suggestions (Shown strictly once user starts typing) */}
                  {hasStartedTyping && (
                    <div className="space-y-1 pt-1">
                      {isSearchingPlaces && placeSuggestions.length === 0 && (
                        <div className="p-3 text-center text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>ঠিকানা খোঁজা হচ্ছে...</span>
                        </div>
                      )}
                      {!isSearchingPlaces && placeSuggestions.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-500 font-medium">
                          কোনো ফলাফল পাওয়া যায়নি। অন্য বানান দিয়ে খুঁজুন বা ম্যাপে পিন করুন।
                        </div>
                      )}
                      {placeSuggestions.map((place, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSuggestion(place);
                          }}
                          className="w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer border border-slate-100 bg-white hover:bg-emerald-50 shadow-2xs active:scale-[0.99]"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <div className="overflow-hidden flex-1">
                            <span className="text-xs font-black text-slate-900 truncate block">{place.name}</span>
                            <span className="text-[10px] text-slate-500 truncate block mt-0.5">{place.full_address}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
      {/* Active Driver Radar Indicator (Docked cleanly below peek bar, fades on card expand) */}
      <div
        className={`absolute left-3.5 z-20 pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center gap-2 transition-all duration-300 ${
          topCardExpanded ? "opacity-0 pointer-events-none -translate-y-2" : "top-[132px] opacity-100 translate-y-0"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[11px] font-bold text-slate-800">
          {nearbyDrivers.length > 0
            ? `🛺 ${nearbyDrivers.length}টি সক্রিয় টোটো (৫ কিমি)`
            : "🛺 ৫ কিমিতে কোনো টোটো নেই"}
        </span>
      </div>

      {/* Map Interactive Zoom Controls (Right Side - Placed safely above bottom sheet) */}
      <div
        className={`absolute bottom-70 right-3.5 z-20 flex flex-col gap-1.5 transition-all duration-300 ${
          sheetExpanded ? "opacity-20 pointer-events-none" : "opacity-100 pointer-events-auto"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
          }}
          title="জুম ইন"
          className="w-10 h-10 bg-white/80 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-white/80 backdrop-blur-xl flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
          }}
          title="জুম আউট"
          className="w-10 h-10 bg-white/80 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-white/80 backdrop-blur-xl flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        >
          <Minus className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {/* Route Calculation Centered Screen-Blur Modal (Exact Middle, All Background Blurred, Non-touchable) */}
      {isCalculatingRoute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto select-none animate-in fade-in duration-200"
          style={{
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 py-6 rounded-3xl backdrop-blur-3xl bg-white/85 dark:bg-slate-900/85 border border-white/80 dark:border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.95)] flex flex-col items-center gap-3.5 max-w-xs w-full text-center animate-in zoom-in-95 duration-200">
            {/* Refractive Liquid Spinner */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="w-16 h-16 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-600 animate-spin" />
              <span className="text-2xl animate-bounce">🛺</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                সঠিক রোড রুট ও ভাড়া গণনা হচ্ছে...
              </h4>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                ওএসআরএম ও স্যাটেলাইট রোড নেটওয়ার্ক থেকে দূরত্ব নির্ণয়
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>সরাসরি হাইওয়ে ও গ্রামীণ পথ বিশ্লেষণ</span>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 INITIAL LOCATION LOCKING FULL SCREEN MODAL (Appears on open until GPS locks perfectly) */}
      {isLocatingInitialLock && !hasValidPickup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto select-none animate-in fade-in duration-300"
          style={{
            background: "radial-gradient(circle at 50% 35%, rgba(6,78,59,0.45) 0%, rgba(2,44,34,0.65) 50%, rgba(2,11,9,0.85) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 py-7 rounded-3xl backdrop-blur-3xl bg-white/90 dark:bg-slate-900/90 border border-white/80 dark:border-white/20 shadow-[0_32px_80px_rgba(0,0,0,0.45),inset_0_2px_4px_rgba(255,255,255,0.95)] flex flex-col items-center gap-4 max-w-xs w-full text-center animate-in zoom-in-95 duration-250">
            {/* Concentric Pulsing Radar Rings & Satellite Emblem */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
              <div className="absolute inset-[-8px] rounded-full border border-emerald-400/20 animate-pulse" />
              <div className="w-18 h-18 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center text-3xl shadow-[0_0_24px_rgba(16,185,129,0.4)]">
                🛰️
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                আপনার সঠিক অবস্থান লক হচ্ছে...
              </h3>
              <p className="text-[11.5px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">
                সুন্দরবন রোড নেটওয়ার্ক থেকে স্যাটেলাইট জিপিএস সংযোগ সক্রিয় করা হচ্ছে
              </p>
            </div>

            {/* Live Progress Indicator */}
            <div className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>হাই-প্রিসিশন স্যাটেলাইট অবস্থান যাচাই</span>
            </div>

            {/* Manual Entry Fallback Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setIsLocatingInitialLock(false);
              }}
              className="text-xs font-black text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline pt-1 cursor-pointer transition-colors"
            >
              বা নিজে পিকআপ লিখুন ➔
            </button>
          </div>
        </div>
      )}

      {/* Map Layer Switcher: Street vs Satellite (Bottom Right - Safe Above Sheet) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic(15);
          toggleMapLayer();
        }}
        title={mapLayer === "streets" ? "স্যাটেলাইট ভিউ" : "স্ট্রিট ভিউ"}
        className={`absolute bottom-57 right-3.5 z-20 w-11 h-11 bg-white/80 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-white/80 backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          sheetExpanded ? "opacity-20 pointer-events-none" : "opacity-100 pointer-events-auto"
        }`}
      >
        <Layers className="w-5 h-5 text-slate-700" />
      </button>

      {/* GPS Recenter Target Button (Bottom Right - Clears 120px Sheet with Comfort) */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic(20);
          isLocatingRef.current = false;
          hasManualPickupRef.current = false;
          pickupInputFocusedRef.current = false;
          fetchCurrentLocation(true);
        }}
        disabled={isLocating}
        title="আমার জিপিএস অবস্থান"
        className={`absolute bottom-44 right-3.5 z-20 w-11 h-11 rounded-2xl shadow-lg border backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          sheetExpanded ? "opacity-20 pointer-events-none" : "opacity-100 pointer-events-auto"
        } ${
          hasValidPickup
            ? "bg-white/85 hover:bg-emerald-50 text-emerald-600 border-white/80"
            : "bg-amber-500/90 text-white border-amber-300 animate-bounce"
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
      <div className="absolute bottom-16 sm:bottom-18 left-0 right-0 z-30 pointer-events-none">
        <div
          className={`pointer-events-auto mx-2 sm:mx-3 mb-2 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl shadow-[0_-16px_48px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.95)] border border-white/80 dark:border-white/15 p-3.5 sm:p-4 space-y-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
            sheetExpanded
              ? "max-h-[86dvh] pb-28 sm:pb-32 overflow-y-auto"
              : dropInputValue && dropInputValue.trim()
              ? "max-h-[140px] overflow-hidden"
              : "max-h-[110px] overflow-hidden"
          }`}
        >
          {/* Interactive Drag / Tap Handle */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              triggerHaptic(12);
              toggleSheet();
            }}
            onTouchStart={(e) => startDrag(e.touches[0].clientY)}
            onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
            onTouchEnd={(e) => endDrag(e.changedTouches[0]?.clientY)}
            onMouseDown={(e) => startDrag(e.clientY)}
            onMouseUp={(e) => endDrag(e.clientY)}
            className="w-full py-1 cursor-pointer flex flex-col items-center justify-center gap-1 select-none group touch-none"
            title="স্লাইডার উপরে বা নিচে টানুন বা ট্যাপ করুন (Drag or tap to toggle)"
          >
            <div className="w-12 h-1.5 bg-slate-300/80 group-hover:bg-emerald-500 rounded-full transition-colors" />
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
                onClick={() => {
                  triggerHaptic(12);
                  setSheetExpanded(true);
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl backdrop-blur-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 shadow-[0_4px_16px_rgba(16,185,129,0.10),inset_0_1px_1px_rgba(255,255,255,0.8)] cursor-pointer active:scale-[0.99] transition-transform"
                title="সম্পূর্ণ বুকিং দেখতে ট্যাপ করুন"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                    🛺
                  </div>
                    <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900">স্মার্ট টোটো</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">
                        {isCalculatingRoute ? "₹০০" : `₹${fareResult.totalFare}.০০`}
                      </span>
                      {isDropOutOfService && (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          পরিষেবা বাইরে
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold truncate block">
                      {pickupInputValue ? pickupInputValue.slice(0, 14) : "পিকআপ"} ➔ {dropInputValue.slice(0, 14)} • {isCalculatingRoute ? "দূরত্ব গণনা হচ্ছে..." : `${distanceKm} কিমি`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic(12);
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
                    {isCalculatingRoute ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        রুট গণনা হচ্ছে...
                      </span>
                    ) : distanceKm > 0 ? (
                      `${distanceKm} কিমি • ~${roadDurationMin} মি`
                    ) : (
                      "রোড রুট"
                    )}
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

                {/* Uber Toto Vehicle Card - Liquid Refraction Polish */}
                <div className="p-3.5 rounded-2xl backdrop-blur-2xl bg-gradient-to-r from-emerald-500/[0.08] via-white/85 to-teal-500/[0.05] border-2 border-emerald-500/80 shadow-[0_8px_24px_rgba(16,185,129,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] ring-1 ring-emerald-500/20 flex items-center justify-between">
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
                      {isCalculatingRoute ? "₹০০" : `₹${fareResult.totalFare}.০০`}
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-500 block">
                      {isCalculatingRoute ? "⏳ ভাড়া গণনা হচ্ছে..." : distanceKm > 0 ? `দূরত্ব: ${distanceKm} কিমি` : "বেস ভাড়া: ₹৩০"}
                    </span>
                  </div>
                </div>

                {/* Night Charge Breakdown Explanation Badge (Clarifies ₹84) */}
                {fareResult.isNight && (
                  <div className="p-2.5 rounded-2xl bg-purple-50/90 border border-purple-200 text-xs text-purple-950 flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-purple-700 shrink-0" />
                      <span>
                        দিনকালীন ভাড়া: ₹{fareResult.totalFare - fareResult.nightCharge} + 🌙 নাইট চার্জ: ₹{fareResult.nightCharge} (রাত ৯:৩০ - ভোর ৫:০০)
                      </span>
                    </div>
                    <span className="text-purple-800 font-mono font-black shrink-0">= ₹{fareResult.totalFare}</span>
                  </div>
                )}

                {/* Passenger Selector - Tactile Liquid Pills */}
                <div className="p-2.5 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xs space-y-2">
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
                          onClick={() => {
                            triggerHaptic(15);
                            setPassengerCount(item.cnt);
                          }}
                          className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/40 scale-[1.03]"
                              : "bg-white/70 backdrop-blur-md text-slate-700 hover:bg-white/90 border border-white/80 shadow-2xs"
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

                <Button
                  size="lg"
                  disabled={isBlocked || isCalculatingRoute}
                  onClick={() => {
                    triggerHaptic(30);
                    handleConfirmClick();
                  }}
                  className={`w-full h-13 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                    isBlocked
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none"
                      : isCalculatingRoute
                      ? "bg-slate-300 text-slate-600 cursor-wait shadow-none animate-pulse"
                      : !hasValidPickup
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/30 animate-pulse"
                      : "bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:brightness-105 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]"
                  }`}
                >
                  <span>
                    {isBlocked
                      ? "🚫 অ্যাকাউন্ট সাময়িকভাবে স্থগিত"
                      : isCalculatingRoute
                      ? "⏳ রোড রুট ও ভাড়া গণনা হচ্ছে..."
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
                        : "🔔 ৫ কিমির মধ্যে চালকের অনুসন্ধান সক্রিয় (বুকিং রিকোয়েস্ট পাঠান)"}
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
