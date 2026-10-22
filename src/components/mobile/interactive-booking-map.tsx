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
import { SUNDARBAN_COMPREHENSIVE_PLACES } from "@/lib/data/sundarban-places";

// Instant client-side place search (0ms response time - never shows "No places found" for real hubs)
function searchClientPlaces(query: string, biasLat: number, biasLng: number) {
  const cleanQ = (query || "").trim().toLowerCase();
  if (cleanQ.length === 0) return [];
  const qNorm = cleanQ.replace(/[^a-z0-9]/g, "");
  const qTokens = cleanQ.split(/\s+/).filter((t) => t.length > 1);
  const results: any[] = [];

  for (const p of SUNDARBAN_COMPREHENSIVE_PLACES) {
    const pNorm = (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    let score = 0;

    // Category matching for generic terms & common typos (school, hotel, restaurant/resturant, etc.)
    const isCatMatch =
      ((qNorm.includes("hotel") || qNorm.includes("resort") || qNorm.includes("lodge") || qNorm.includes("stay")) && p.category === "hotel") ||
      ((qNorm.includes("school") || qNorm.includes("college") || qNorm.includes("vidya") || qNorm.includes("siksha")) && p.category === "school_college") ||
      ((qNorm.includes("restaurant") || qNorm.includes("resturant") || qNorm.includes("food") || qNorm.includes("dhaba") || qNorm.includes("bhojan") || qNorm.includes("cafe")) && p.category === "restaurant") ||
      ((qNorm.includes("hospital") || qNorm.includes("health") || qNorm.includes("swasthya") || qNorm.includes("clinic") || qNorm.includes("medical") || qNorm.includes("doctor")) && p.category === "hospital") ||
      ((qNorm.includes("beach") || qNorm.includes("sea")) && p.category === "beach") ||
      ((qNorm.includes("station") || qNorm.includes("rail") || qNorm.includes("train")) && p.category === "station") ||
      ((qNorm.includes("stand") || qNorm.includes("bus") || qNorm.includes("toto")) && (p.category === "bus_stand" || p.category === "toto_stand")) ||
      ((qNorm.includes("ghat") || qNorm.includes("ferry") || qNorm.includes("jetty")) && p.category === "ferry_ghat") ||
      ((qNorm.includes("market") || qNorm.includes("bazar") || qNorm.includes("haat")) && p.category === "market");

    if (pNorm.startsWith(qNorm)) {
      score = 120;
    } else if (pNorm.includes(qNorm)) {
      score = 100;
    } else if (
      qTokens.length > 0 &&
      qTokens.every((t) => pNorm.includes(t) || p.aliases?.some((a) => a.toLowerCase().includes(t)))
    ) {
      score = 85;
    } else if (p.aliases?.some((a) => a.toLowerCase().replace(/[^a-z0-9]/g, "").includes(qNorm))) {
      score = 75;
    } else if (isCatMatch) {
      score = 70;
    }

    if (score > 0) {
      const distDeg = Math.hypot(p.lat - biasLat, p.lng - biasLng);
      results.push({
        name: p.name,
        full_address: `${p.name} (${p.categoryLabel || "Place"}), ${p.subLocality || "South 24 Parganas"}, West Bengal`,
        lat: p.lat,
        lng: p.lng,
        category: p.categoryLabel || "Place",
        categoryBadge: "📍",
        source: "local_verified",
        isInServiceArea: true,
        score: score - distDeg * 4,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15);
}

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
  source?: string;
  category?: string;
  categoryBadge?: string;
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

// Standard Google Encoded Polyline Decoder (Decodes OSRM compressed geometry into real road coordinates)
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
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
  // Show GPS lock modal on startup until real GPS coordinates are obtained
  const [isLocatingInitialLock, setIsLocatingInitialLock] = useState(!isInitialValid);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Safety unlock timeout — after 10 seconds, let user proceed manually if GPS is disabled
  useEffect(() => {
    if (!isLocatingInitialLock) return;
    const t = setTimeout(() => {
      setIsLocatingInitialLock(false);
    }, 10000);
    return () => clearTimeout(t);
  }, [isLocatingInitialLock]);

  // Real-time Compass Heading (Phone's Head Direction)
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const deviceHeadingRef = useRef<number>(0);

  // Service territory tracking
  const [isDropOutOfService, setIsDropOutOfService] = useState(false);
  const [riverCrossingAlert, setRiverCrossingAlert] = useState<{
    requiresFerry: boolean;
    barrierName: string;
    notice: string;
    noticeBn?: string;
  } | null>(null);

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

  // Real-time Compass Heading Watcher (Smooth Continuous Heading without 360-degree spin glitch)
  const targetHeadingRef = useRef<number>(0);
  const smoothHeadingRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    let rafId: number | null = null;

    const getScreenAngle = () => {
      if (typeof window !== "undefined") {
        if (window.screen?.orientation?.angle !== undefined) {
          return window.screen.orientation.angle;
        }
        if (typeof (window as any).orientation === "number") {
          return (window as any).orientation;
        }
      }
      return 0;
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!active) return;
      let rawAngle: number | null = null;

      // 1. iOS Safari compass heading (0 = North)
      if (typeof (e as any).webkitCompassHeading === "number") {
        rawAngle = (e as any).webkitCompassHeading;
      }
      // 2. Android deviceorientationabsolute or alpha
      else if (e.alpha !== null && !isNaN(e.alpha)) {
        const screenAngle = getScreenAngle();
        rawAngle = ((360 - e.alpha) + screenAngle) % 360;
      }

      if (rawAngle !== null && !isNaN(rawAngle)) {
        targetHeadingRef.current = rawAngle;
        deviceHeadingRef.current = rawAngle;
      }
    };

    // 60/120fps Silky Smooth GPU Interpolation Loop
    const updateHeadingLoop = () => {
      if (!active) return;

      const target = targetHeadingRef.current;
      const current = smoothHeadingRef.current;

      // Mathematically foolproof shortest angular distance unwrapping
      const currentNorm = ((current % 360) + 360) % 360;
      let diff = target - currentNorm;
      if (diff < -180) diff += 360;
      if (diff > 180) diff -= 360;

      // Deadband: filter out sensor trembling / magnetometer noise (< 0.35°)
      if (Math.abs(diff) > 0.35) {
        // Dynamic adaptive LERP: quick response on large phone swings, velvety glide on minor movements
        const lerpFactor = Math.abs(diff) > 50 ? 0.32 : 0.16;
        smoothHeadingRef.current += diff * lerpFactor;

        const headingCone = document.getElementById("sr-live-user-heading-cone");
        if (headingCone) {
          headingCone.style.transform = `translate3d(-50%, -50%, 0) rotate(${smoothHeadingRef.current.toFixed(1)}deg)`;
        }
      }

      rafId = requestAnimationFrame(updateHeadingLoop);
    };

    rafId = requestAnimationFrame(updateHeadingLoop);

    // Permission check for iOS 13+ devices
    const requestIosPermission = async () => {
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
        try {
          const res = await (DeviceOrientationEvent as any).requestPermission();
          if (res === "granted") {
            attachListeners();
          }
        } catch {}
      }
    };

    const attachListeners = () => {
      if (typeof window !== "undefined") {
        const win = window as any;
        if ("ondeviceorientationabsolute" in win) {
          win.addEventListener("deviceorientationabsolute", handleOrientation, true);
        } else if ("ondeviceorientation" in win) {
          win.addEventListener("deviceorientation", handleOrientation, true);
        }
      }
    };

    attachListeners();

    // Attach one-time gesture trigger on first touch for iOS permission
    if (typeof window !== "undefined" && typeof (DeviceOrientationEvent as any)?.requestPermission === "function") {
      window.addEventListener("touchstart", requestIosPermission, { once: true });
      window.addEventListener("click", requestIosPermission, { once: true });
    }

    return () => {
      active = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
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

  // NEARBY ACTIVE DRIVERS: Real drivers within 15.0 km radius of pickup or region hub
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
      .filter((d): d is any => d !== null && d.distanceKm <= 15.0)
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

      const hasValidP = pCoords[0] !== 0 && !isNaN(pCoords[0]);
      const hasValidD = dCoords[0] !== 0 && !isNaN(dCoords[0]);

      // 1. UPDATE OR CREATE PICKUP MARKER
      if (hasValidP) {
        if (!pickupMarkerRef.current) {
          const pMarker = L.marker(pCoords, {
            icon: createUberPickupIcon(L),
            draggable: true,
          }).addTo(map);

          pMarker.on("drag", (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            const d = dropCoordsRef.current;
            if (d[0] !== 0) {
              const directD = calculateDistanceKm(newPosCoords[0], newPosCoords[1], d[0], d[1]);
              const estDist = Math.max(1.0, Math.round(directD * 1.35 * 10) / 10);
              setDistanceKm(estDist);
            }
            // Keep green/black line physically attached to pickup pin during drag
            if (routeLineRef.current && routeLineBorderRef.current) {
              const currentLatLngs = routeLineRef.current.getLatLngs();
              if (currentLatLngs && currentLatLngs.length > 1) {
                const updated = [...currentLatLngs];
                updated[0] = newPos;
                routeLineBorderRef.current.setLatLngs(updated);
                routeLineRef.current.setLatLngs(updated);
              }
            }
          });

          pMarker.on("dragend", (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            setPickupCoords(newPosCoords);
            setHasValidPickup(true);
            setLocationError(null);
            setIsCalculatingRoute(true);

            syncMapRouteAndPins(newPosCoords, dropCoordsRef.current, pickupInputRef.current || "Current Location", dropInputRef.current || "Drop Location", {
              fitBounds: false,
            });

            resolveLocationAddress(newPosCoords[0], newPosCoords[1]).then((resolved) => {
              setPickupInputValue(resolved);
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

          dMarker.on("drag", (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            const p = pickupCoordsRef.current;
            if (p[0] !== 0) {
              const directD = calculateDistanceKm(p[0], p[1], newPosCoords[0], newPosCoords[1]);
              const estDist = Math.max(1.0, Math.round(directD * 1.35 * 10) / 10);
              setDistanceKm(estDist);
            }
            // Keep green/black line physically attached to red drop pin during drag
            if (routeLineRef.current && routeLineBorderRef.current) {
              const currentLatLngs = routeLineRef.current.getLatLngs();
              if (currentLatLngs && currentLatLngs.length > 1) {
                const updated = [...currentLatLngs];
                updated[updated.length - 1] = newPos;
                routeLineBorderRef.current.setLatLngs(updated);
                routeLineRef.current.setLatLngs(updated);
              }
            }
          });

          dMarker.on("dragend", (e: any) => {
            const newPos = e.target.getLatLng();
            const newPosCoords: [number, number] = [newPos.lat, newPos.lng];
            setDropCoords(newPosCoords);
            setIsCalculatingRoute(true);

            syncMapRouteAndPins(pickupCoordsRef.current, newPosCoords, pickupInputRef.current || "Current Location", dropInputRef.current || "Drop Location", {
              fitBounds: false,
            });

            resolveLocationAddress(newPosCoords[0], newPosCoords[1]).then((resolved) => {
              setDropInputValue(resolved);
            });
          });

          dropMarkerRef.current = dMarker;
        } else {
          dropMarkerRef.current.setLatLng(dCoords);
        }
      } else if (dropMarkerRef.current && dCoords[0] === 0) {
        dropMarkerRef.current.remove();
        dropMarkerRef.current = null;
      }

      // 3. STRICT ROAD ROUTE CALCULATION (No Straight Line Across Terrain/Rivers)
      if (hasValidP && hasValidD) {
        const directDist = calculateDistanceKm(pCoords[0], pCoords[1], dCoords[0], dCoords[1]);
        const baselineDist = Math.max(1.0, Math.round(directDist * 1.38 * 10) / 10);
        const baselineDuration = Math.max(3, Math.round(baselineDist * 2.8));
        const initialFare = calculateTotoFare(baselineDist, passengerCount, pricingConfig);

        setDistanceKm(baselineDist);
        setRoadDurationMin(baselineDuration);
        setIsCalculatingRoute(true);

        // Uber Padded Camera Animation
        if (options?.fitBounds !== false) {
          try {
            map.flyToBounds([pCoords, dCoords], {
              paddingTopLeft: [40, 180],
              paddingBottomRight: [40, 260],
              duration: options?.flyDuration ?? 1.0,
              easeLinearity: 0.25,
              maxZoom: 16,
            });
          } catch {}
        }

        // Helper to reliably render and raise route line on map
        const applyRouteGeometry = (coords: [number, number][]) => {
          if (!map || !coords || coords.length === 0) return;

          // Always ensure the route line touches both pickup and drop pins seamlessly
          const fullPath: [number, number][] = [
            pCoords,
            ...coords.filter((c) => {
              return (
                (c[0] !== pCoords[0] || c[1] !== pCoords[1]) &&
                (c[0] !== dCoords[0] || c[1] !== dCoords[1])
              );
            }),
            dCoords,
          ];

          if (!routeLineBorderRef.current || !map.hasLayer(routeLineBorderRef.current)) {
            routeLineBorderRef.current = L.polyline(fullPath, {
              color: "#064e3b",
              weight: 8,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
          } else {
            routeLineBorderRef.current.setLatLngs(fullPath);
          }

          if (!routeLineRef.current || !map.hasLayer(routeLineRef.current)) {
            routeLineRef.current = L.polyline(fullPath, {
              color: "#10b981",
              weight: 5,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
              className: "uber-route-flow",
            }).addTo(map);
          } else {
            routeLineRef.current.setLatLngs(fullPath);
          }

          try {
            routeLineBorderRef.current.bringToFront();
            routeLineRef.current.bringToFront();
          } catch {}

          if (fullPath.length > 1 && options?.fitBounds !== false) {
            try {
              map.fitBounds(L.latLngBounds(fullPath), {
                paddingTopLeft: [40, 160],
                paddingBottomRight: [40, 240],
                maxZoom: 16,
                animate: true,
              });
            } catch {}
          }
        };

        // Fetch exact road route from Mapbox/OSRM via /api/route
        const cacheKey = `${pCoords[0].toFixed(4)},${pCoords[1].toFixed(4)}-${dCoords[0].toFixed(4)},${dCoords[1].toFixed(4)}`;
        if (routeClientCache.has(cacheKey)) {
          const cached = routeClientCache.get(cacheKey)!;
          if (cached.coordinates?.length) {
            applyRouteGeometry(cached.coordinates);
          }
          setDistanceKm(cached.distanceKm);
          setRoadDurationMin(cached.durationMin);
          setIsCalculatingRoute(false);
          const computedFare = calculateTotoFare(cached.distanceKm, passengerCount, pricingConfig);
          onRouteSelectedRef.current?.({
            pickup: pText || "Current Location",
            drop: dText || "Drop Location",
            distanceKm: cached.distanceKm,
            estimatedFare: computedFare.totalFare,
            rideTier: "standard",
            pickupCoords: pCoords,
            dropCoords: dCoords,
            paymentMode: "cash",
            passengerCount,
          });
        } else {
          // Immediately connect pickup and drop pins with route line in 0ms so the user never sees a missing/blank line
          applyRouteGeometry([pCoords, dCoords]);

          try {
            const controller = new AbortController();
            routeAbortControllerRef.current = controller;
            const safetyTimer = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(
              `/api/route?fromLat=${pCoords[0]}&fromLng=${pCoords[1]}&toLat=${dCoords[0]}&toLng=${dCoords[1]}`,
              { signal: controller.signal }
            );
            clearTimeout(safetyTimer);

            if (res.ok) {
              const data = await res.json();
              if (
                data?.coordinates &&
                Array.isArray(data.coordinates) &&
                data.coordinates.length > 0 &&
                data.isExactRoadRoute
              ) {
                applyRouteGeometry(data.coordinates);
                routeClientCache.set(cacheKey, {
                  distanceKm: data.distanceKm,
                  durationMin: data.durationMin,
                  coordinates: data.coordinates,
                });
              }

              if (data?.riverCrossing) {
                setRiverCrossingAlert(data.riverCrossing);
              } else {
                setRiverCrossingAlert(null);
              }

              const finalDist = data?.distanceKm || baselineDist;
              const finalDur = data?.durationMin || baselineDuration;
              setDistanceKm(finalDist);
              setRoadDurationMin(finalDur);

              const computedFare = calculateTotoFare(finalDist, passengerCount, pricingConfig);
              onRouteSelectedRef.current?.({
                pickup: pText || "Current Location",
                drop: dText || "Drop Location",
                distanceKm: finalDist,
                estimatedFare: computedFare.totalFare,
                rideTier: "standard",
                pickupCoords: pCoords,
                dropCoords: dCoords,
                paymentMode: "cash",
                passengerCount,
              });
            }
          } catch (err: any) {
            if (err?.name === "AbortError") {
              // Newer pin drag / route calculation is in flight — do not overwrite
              return;
            }
            // Keep straight connecting route line visible even if road api fails
            applyRouteGeometry([pCoords, dCoords]);
          } finally {
            setIsCalculatingRoute(false);
          }
        }
      } else {
        // Clear route
        if (routeLineBorderRef.current) routeLineBorderRef.current.setLatLngs([]);
        if (routeLineRef.current) routeLineRef.current.setLatLngs([]);
        setDistanceKm(0);
        setRiverCrossingAlert(null);

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

  // Continuous User Location Dot & Heading Beam updater (Google/Apple Maps Vector Quality)
  const updateLiveUserDot = useCallback(async (latitude: number, longitude: number) => {
    if (!mapInstanceRef.current || isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) return;
    const L = await getLeaflet();
    if (!mapInstanceRef.current) return;

    const currentHeading = deviceHeadingRef.current || 0;

    if (liveUserDotRef.current) {
      liveUserDotRef.current.setLatLng([latitude, longitude]);
    } else {
      const liveIcon = L.divIcon({
        className: "sr-live-user-dot-container",
        html: `<div style="position: relative; width: 64px; height: 64px; transform: translate(-50%, -50%); pointer-events: none;">
          <!-- Rotating Direction Beam & Arrow (Phone's Head Direction) -->
          <div id="sr-live-user-heading-cone" style="
            position: absolute;
            top: 50%;
            left: 50%;
            width: 64px;
            height: 64px;
            transform: translate3d(-50%, -50%, 0) rotate(${currentHeading}deg);
            pointer-events: none;
            will-change: transform;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="64" height="64" viewBox="0 0 64 64" style="position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible;">
              <defs>
                <radialGradient id="sr-cone-beam-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.55" />
                  <stop offset="70%" stop-color="#10b981" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
                </radialGradient>
              </defs>
              <!-- 55-degree radiant vision beam radiating from center (32, 32) upwards -->
              <path d="M 32 32 L 17 3 A 33 33 0 0 1 47 3 Z" fill="url(#sr-cone-beam-grad)" />
              <!-- High-precision navigation pointer chevron pointing forward -->
              <path d="M 32 3 L 36.5 13 L 32 10.5 L 27.5 13 Z" fill="#047857" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
          </div>

          <!-- Pulsing Radar Wave -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 34px;
            height: 34px;
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
  }, []);

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

      // Absolute safety watchdog: guarantees isLocating is ALWAYS reset even if GPS hangs
      const watchdog = setTimeout(() => {
        isLocatingRef.current = false;
        setIsLocating(false);
        setIsLocatingInitialLock(false);
      }, 7500);

      const handleFail = (msg?: string, isDenied = false) => {
        clearTimeout(watchdog);
        isLocatingRef.current = false;
        setIsLocating(false);
        setIsLocatingInitialLock(false);
        setGpsDetected(false);
        setPermissionState(isDenied ? "denied" : "prompt");

        if (userInitiated || isDenied) {
          const defaultDeniedMsg = isNative
            ? "⚠️ Please allow location permission in App Settings (Settings > Apps > Sundarban Riders > Permissions > Location 'Allow')."
            : "⚠️ Location permission is blocked in browser settings. Please allow location access for this site.";

          const errorMsg =
            msg ||
            (isDenied
              ? defaultDeniedMsg
              : "⚠️ Unable to detect GPS position. Please ensure your device Location (GPS) is turned on.");

          setLocationError(errorMsg);
          if (userInitiated) {
            toast.error(errorMsg);
          }
        }
      };

      const handleSuccess = async (latitude: number, longitude: number, preResolvedName?: string) => {
        clearTimeout(watchdog);
        isLocatingRef.current = false;
        setIsLocating(false);

        if (isNaN(latitude) || latitude === 0 || isNaN(longitude) || longitude === 0) {
          handleFail("⚠️ Invalid GPS coordinates received.");
          return;
        }

        const newPickup: [number, number] = [latitude, longitude];
        setPickupCoords(newPickup);
        setGpsDetected(true);
        setHasValidPickup(true);
        setPermissionState("granted");
        setLocationError(null);

        // Remove old pickup marker so it doesn't linger
        if (pickupMarkerRef.current) {
          try { pickupMarkerRef.current.remove(); } catch {}
          pickupMarkerRef.current = null;
        }

        // 1. Instantly center map right at user's true GPS position BEFORE lifting loading overlay
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.setView(newPickup, 17, { animate: false });
          } catch {}
        }

        // 2. Immediately lift the initial GPS lock overlay (0ms jump!)
        setIsLocatingInitialLock(false);

        // 3. Update the live GPS user dot with orientation cone
        await updateLiveUserDot(latitude, longitude);

        // 4. Initial English fallback title until reverse geocode resolves
        const initialName = preResolvedName || "Current Location";
        setPickupInputValue(initialName);

        try {
          localStorage.setItem("sr_last_known_lat", latitude.toString());
          localStorage.setItem("sr_last_known_lng", longitude.toString());
          if (initialName) localStorage.setItem("sr_last_known_name", initialName);
        } catch {}

        // 5. Sync route immediately with current coordinates
        await syncMapRouteAndPins(newPickup, dropCoordsRef.current, initialName, dropInputRef.current, {
          fitBounds: Boolean(dropInputRef.current && dropCoordsRef.current[0] !== 0),
          flyDuration: 1.0,
        });

        // 6. Asynchronously resolve precise English landmark address in background without blocking
        resolveLocationAddress(latitude, longitude).then((addr) => {
          if (addr && addr !== initialName) {
            setPickupInputValue(addr);
            try { localStorage.setItem("sr_last_known_name", addr); } catch {}
          }
        });
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
            if (!userInitiated) {
              setIsLocatingInitialLock(false);
              isLocatingRef.current = false;
              setIsLocating(false);
              return;
            }
            const req = await Geolocation.requestPermissions();
            const reqGranted =
              req.location === "granted" ||
              (req as any).coarseLocation === "granted" ||
              (req as any).state === "granted";
            if (!reqGranted) {
              handleFail(undefined, true);
              return;
            }
          }

          try {
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 3000,
            });

            if (position?.coords?.latitude && position?.coords?.longitude) {
              await handleSuccess(position.coords.latitude, position.coords.longitude);
              return;
            }
          } catch (e) {
            console.warn("Capacitor high accuracy GPS error:", e);
          }
        } catch (capErr) {
          console.warn("Capacitor Geolocation error, trying standard browser GPS:", capErr);
        }
      }

      // 2. Standard Web Browser / WebView High-Accuracy Satellite GPS
      if (typeof window === "undefined" || !navigator.geolocation) {
        handleFail("⚠️ Geolocation service is not supported on this browser.");
        return;
      }

      // If passive/auto-check on web, only query if browser permission is already granted
      if (!userInitiated && (navigator as any).permissions?.query) {
        try {
          const permStatus = await (navigator as any).permissions.query({ name: "geolocation" });
          if (permStatus.state !== "granted") {
            setIsLocatingInitialLock(false);
            isLocatingRef.current = false;
            setIsLocating(false);
            return;
          }
        } catch {}
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords?.latitude && pos?.coords?.longitude) {
            handleSuccess(pos.coords.latitude, pos.coords.longitude);
          } else {
            handleFail("⚠️ Could not acquire GPS coordinates.");
          }
        },
        (err) => {
          if (userInitiated) {
            if (err.code === 1) {
              const deniedText = isNative
                ? "⚠️ Please allow location permission in App Settings."
                : "⚠️ Location permission is blocked in browser settings. Please allow location access.";
              handleFail(deniedText, true);
            } else {
              handleFail("⚠️ Unable to acquire GPS position. Please ensure Location is enabled.");
            }
          } else {
            handleFail();
          }
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 3000 }
      );
    },
    [resolveLocationAddress, syncMapRouteAndPins]
  );

  // Target Button Click Handler (Instant snap to live user location + fresh satellite lock)
  const handleTargetGpsClick = useCallback(() => {
    triggerHaptic(20);
    hasManualPickupRef.current = false;
    pickupInputFocusedRef.current = false;

    // Remove old marker so it doesn't linger
    if (pickupMarkerRef.current) {
      try {
        pickupMarkerRef.current.remove();
      } catch {}
      pickupMarkerRef.current = null;
    }

    // 1. Instant recovery: If we already have live user GPS coordinates from the live dot
    const livePos = liveUserDotRef.current?.getLatLng();
    if (livePos && !isNaN(livePos.lat) && livePos.lat !== 0 && !isNaN(livePos.lng) && livePos.lng !== 0) {
      const liveCoords: [number, number] = [livePos.lat, livePos.lng];
      setPickupCoords(liveCoords);
      setHasValidPickup(true);
      setLocationError(null);
      setPickupInputValue("Current Location");

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.setView(liveCoords, 17, { animate: false });
        } catch {}
      }

      syncMapRouteAndPins(liveCoords, dropCoordsRef.current, "Current Location", dropInputRef.current, {
        fitBounds: Boolean(dropInputRef.current && dropCoordsRef.current[0] !== 0),
      });

      // Quick background reverse geocode update
      resolveLocationAddress(liveCoords[0], liveCoords[1]).then((addr) => {
        if (addr) setPickupInputValue(addr);
      });
    } else {
      setPickupInputValue("Locating GPS...");
      setHasValidPickup(false);
      fetchCurrentLocation(true);
    }
  }, [triggerHaptic, fetchCurrentLocation, syncMapRouteAndPins, resolveLocationAddress]);

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

              // Always update the live user dot on the map without touching React state
              await updateLiveUserDot(latitude, longitude);

              // Only initialize pickup if it was never set before (0, 0), avoiding constant camera jitter/flicker
              if (pickupCoordsRef.current[0] === 0 && !hasManualPickupRef.current && !isCancelled) {
                setPickupCoords([latitude, longitude]);
                setHasValidPickup(true);
                setGpsDetected(true);
                setIsLocatingInitialLock(false);
                resolveLocationAddress(latitude, longitude).then((resolved) => {
                  if (!isCancelled && resolved) {
                    setPickupInputValue(resolved);
                    try {
                      localStorage.setItem("sr_last_known_name", resolved);
                    } catch {}
                  }
                });
                try {
                  localStorage.setItem("sr_last_known_lat", latitude.toString());
                  localStorage.setItem("sr_last_known_lng", longitude.toString());
                } catch {}
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
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

            // Always update the live user dot on the map without touching React state
            await updateLiveUserDot(latitude, longitude);

            // Only initialize pickup if it was never set before (0, 0), avoiding constant camera jitter/flicker
            if (pickupCoordsRef.current[0] === 0 && !hasManualPickupRef.current && !isCancelled) {
              setPickupCoords([latitude, longitude]);
              setHasValidPickup(true);
              setGpsDetected(true);
              setIsLocatingInitialLock(false);
              resolveLocationAddress(latitude, longitude).then((resolved) => {
                if (!isCancelled && resolved) {
                  setPickupInputValue(resolved);
                  try {
                    localStorage.setItem("sr_last_known_name", resolved);
                  } catch {}
                }
              });
              try {
                localStorage.setItem("sr_last_known_lat", latitude.toString());
                localStorage.setItem("sr_last_known_lng", longitude.toString());
              } catch {}
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.0 });
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
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

        let initialCenter: [number, number] = DEFAULT_REGION_HUB;
        if (hasValidPickup && pickupCoords[0] !== 0) {
          initialCenter = pickupCoords;
        } else if (typeof window !== "undefined") {
          const savedLat = parseFloat(localStorage.getItem("sr_last_known_lat") || "");
          const savedLng = parseFloat(localStorage.getItem("sr_last_known_lng") || "");
          if (!isNaN(savedLat) && !isNaN(savedLng) && savedLat !== 0 && savedLng !== 0) {
            initialCenter = [savedLat, savedLng];
          }
        }

        // Strictly West Bengal Geographic Boundary — No dragging to world map or outside state
        const WEST_BENGAL_BOUNDS: [[number, number], [number, number]] = [
          [21.2000, 85.8000],
          [27.4000, 89.9500],
        ];

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 15,
          minZoom: 8,
          maxZoom: 19,
          maxBounds: WEST_BENGAL_BOUNDS,
          maxBoundsViscosity: 1.0,
          zoomControl: false,
          attributionControl: false,
        });

        // Google Maps Clean Street Tile Layer (Multi-subdomain high concurrency)
        const streetUrl = "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        const tiles = L.tileLayer(streetUrl, {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 20,
          keepBuffer: 8,
          updateWhenIdle: false,
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

          const curSearch = activeSearchFieldRef.current;
          let currentPickup = pickupCoordsRef.current;

          // Auto-recover pickup if state was 0
          if (currentPickup[0] === 0 && typeof window !== "undefined") {
            const latStr = localStorage.getItem("sr_last_known_lat");
            const lngStr = localStorage.getItem("sr_last_known_lng");
            if (latStr && lngStr) {
              const lat = parseFloat(latStr);
              const lng = parseFloat(lngStr);
              if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                currentPickup = [lat, lng];
                setPickupCoords(currentPickup);
                setHasValidPickup(true);
              }
            }
          }

          const hasP = currentPickup[0] !== 0 && !isNaN(currentPickup[0]);

          if (curSearch === "pickup" || !hasP) {
            setPickupCoords(clickedCoords);
            setPickupInputValue(resolved);
            setHasValidPickup(true);
            setLocationError(null);
            setActiveSearchField(null);

            await syncMapRouteAndPins(clickedCoords, dropCoordsRef.current, resolved, dropInputRef.current, {
              fitBounds: Boolean(dropInputRef.current),
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

            await syncMapRouteAndPins(currentPickup, clickedCoords, pickupInputRef.current || "Current Location", resolved, {
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
            if (pickupCoordsRef.current[0] !== 0) {
              updateLiveUserDot(pickupCoordsRef.current[0], pickupCoordsRef.current[1]);
            }
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

    const biasLat = pickupCoords[0] || 21.876;
    const biasLng = pickupCoords[1] || 88.192;

    // 1. INSTANT CLIENT-SIDE SEARCH (0ms latency — instant rich results, never empty!)
    const localMatches = searchClientPlaces(query, biasLat, biasLng);
    if (localMatches.length > 0) {
      setPlaceSuggestions(localMatches);
    }

    // 2. LIVE GOOGLE AUTOCOMPLETE & MAPBOX (Fetches Google search queries & Mapbox places)
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}&lat=${biasLat}&lng=${biasLng}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            setPlaceSuggestions((prev) => {
              const map = new Map<string, any>();
              localMatches.forEach((item) => map.set(item.name.toLowerCase(), item));
              data.suggestions.forEach((item: any) => {
                const k = (item.name || "").toLowerCase();
                if (!map.has(k)) map.set(k, item);
              });
              return Array.from(map.values()).slice(0, 25);
            });
          }
        }
      } catch {
        // Keep instant local matches if network fails
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 100);
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

      const effectivePickupCoords: [number, number] =
        pickupCoords[0] !== 0
          ? pickupCoords
          : liveUserDotRef.current?.getLatLng()
          ? [liveUserDotRef.current.getLatLng().lat, liveUserDotRef.current.getLatLng().lng]
          : [0, 0];
      const effectivePickupName = pickupInputValue.trim() || "Current Location";

      if (effectivePickupCoords[0] === 0) {
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
        if (!pickupInputValue.trim()) {
          setPickupInputValue(effectivePickupName);
          setPickupCoords(effectivePickupCoords);
          setHasValidPickup(true);
        }
        await syncMapRouteAndPins(effectivePickupCoords, coords, effectivePickupName, place.name, {
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
      const msg = "⚠️ Please select a pickup location! Turn on GPS or enter pickup location above.";
      setLocationError(msg);
      toast.error(msg);
      setActiveSearchField("pickup");
      return;
    }

    if (!dropInputValue || !dropInputValue.trim()) {
      toast.error("⚠️ Please select your destination (Drop Location).");
      setActiveSearchField("drop");
      return;
    }

    onConfirmBooking?.();
  };

  // Metered Ride Booking Handler (When user has pickup but wants to decide drop later or pay via live meter)
  const handleBookMeteredRide = () => {
    if (isBlocked) return;

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
      const msg = "⚠️ Please select a pickup location first or allow GPS!";
      setLocationError(msg);
      toast.error(msg);
      setActiveSearchField("pickup");
      return;
    }

    const pickupText = pickupInputValue || "Current Location";
    const dropText = "মিটারযুক্ত রাইড (Metered Trip - Pay at Finish)";

    setDropInputValue(dropText);
    setDropCoords([0, 0]);

    onRouteSelectedRef.current?.({
      pickup: pickupText,
      drop: dropText,
      distanceKm: 0,
      estimatedFare: fareResult.totalFare || 30,
      rideTier: "standard",
      pickupCoords: currentPCoords,
      dropCoords: [0, 0],
      paymentMode: "cash",
      passengerCount,
    });

    onConfirmBooking?.();
  };

  return (
    <div className="relative w-full h-full min-h-0 flex-1 overflow-hidden select-none">
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
          className={`pointer-events-auto relative rounded-3xl p-3 sm:p-3.5 liquid-glass-card liquid-sheen space-y-2.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
            topCardExpanded
              ? activeSearchField
                ? "max-h-[82vh] overflow-y-auto"
                : "max-h-[70vh] overflow-y-auto"
              : "max-h-24 overflow-hidden"
          }`}
        >
          {/* Top liquid specular glass reflection sheen */}
          <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-white/45 via-white/10 to-transparent pointer-events-none rounded-t-3xl" />
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
              title="Tap or drag down to edit pickup and destination"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-500/20 shadow-xs" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {pickupInputValue ? pickupInputValue.slice(0, 16) : "Pickup"}
                  </span>
                  <span className="text-slate-400 text-xs font-bold">➔</span>
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0 ring-4 ring-rose-500/20 shadow-xs" />
                  <span className="text-xs font-black text-slate-900 truncate">
                    {dropInputValue ? dropInputValue.slice(0, 18) : "Where to?"}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-800 text-[10.5px] font-black shrink-0 border border-emerald-500/25 shadow-2xs">
                  Edit ⌄
                </span>
              </div>
              <div className="w-full pt-1 flex flex-col items-center justify-center gap-0.5">
                <div className="w-12 h-1.5 bg-slate-300/80 group-hover:bg-emerald-500 rounded-full transition-colors" />
                <span className="text-[10px] font-bold text-emerald-700 animate-pulse">
                  Tap or drag down to edit pickup & drop ⌄
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
                    <span>Allow GPS</span>
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
                        ? "Enter pickup in West Bengal (GPS unavailable)..."
                        : "Enter pickup location or tap GPS..."
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
                    className={`h-10 pl-9 pr-18 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-900 dark:text-white rounded-2xl text-xs font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] border transition-all ${
                      !hasValidPickup && !pickupInputValue.trim()
                        ? "border-amber-400 bg-amber-50/50 placeholder:text-amber-700"
                        : "border-white/80 dark:border-white/15 focus:border-emerald-500 focus:bg-white/85"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={handleTargetGpsClick}
                      disabled={isLocating}
                      title="My accurate GPS location"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border ${
                        hasValidPickup
                          ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 border-emerald-500/30 shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                          : "bg-amber-100/80 hover:bg-amber-200 text-amber-800 border-amber-300"
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
                    placeholder="Where to? Search destination in West Bengal..."
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
                    className={`h-10 pl-9 pr-14 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-900 dark:text-white rounded-2xl text-xs font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] border transition-all ${
                      isDropOutOfService
                        ? "border-rose-400 bg-rose-50/50 text-rose-900"
                        : "border-white/80 dark:border-white/15 focus:border-red-400 focus:bg-white/85"
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(22);
                        handleSwap();
                      }}
                      title="Swap pickup and destination"
                      className="w-8 h-8 rounded-xl bg-white/70 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 flex items-center justify-center transition-all active:scale-85 active:rotate-180 cursor-pointer shadow-xs border border-white/80 backdrop-blur-md"
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

                {/* River Ferry Crossing Notice Banner in Top Card if Active */}
                {riverCrossingAlert && (
                  <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                    <span className="text-base shrink-0">⛴️</span>
                    <span className="flex-1 text-[11px] leading-tight">
                      {riverCrossingAlert.notice}
                    </span>
                  </div>
                )}
              </div>

              {/* Live Auto-Suggest Places & Recent 3 Searches Dropdown */}
              {activeSearchField && (
                <div
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="mt-2 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-white/90 dark:border-white/20 shadow-2xl max-h-[48vh] overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="px-1 pb-1 flex items-center justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {!hasStartedTyping
                        ? "Recent Searches"
                        : "Verified Places & Google Live Autocomplete"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSearchField(null);
                        setHasStartedTyping(false);
                        setPlaceSuggestions([]);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                    >
                      ✕ Close
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
                      ) : null}

                      {recentSearches.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500 font-medium">
                          📍 Tap anywhere on the map or type in the search bar to find live accurate locations.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Live Suggestions (Instant Local + Google Live Autocomplete + Mapbox) */}
                  {hasStartedTyping && (
                    <div className="space-y-1 pt-1">
                      {isSearchingPlaces && placeSuggestions.length === 0 && (
                        <div className="p-3 text-center text-xs text-emerald-700 font-bold flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Searching places across West Bengal...</span>
                        </div>
                      )}
                      {!isSearchingPlaces && placeSuggestions.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-500 font-medium">
                          No matching places found. Try another spelling or tap anywhere on the map to place a pin.
                        </div>
                      )}
                      {placeSuggestions.map((place, idx) => {
                        const isStation = place.name.includes("Station") || place.name.toLowerCase().includes("station");
                        const isBus = place.name.includes("Bus") || place.name.toLowerCase().includes("bus");
                        const isGhat = place.name.includes("Ghat") || place.name.toLowerCase().includes("ghat") || place.name.toLowerCase().includes("ferry");
                        const isBeach = place.name.includes("Beach") || place.name.toLowerCase().includes("beach");
                        const isHospital = place.name.includes("Hospital") || place.name.toLowerCase().includes("hospital");
                        const isSchool = place.name.includes("School") || place.name.toLowerCase().includes("college");
                        const badgeEmoji = isStation ? "🚆" : isBus ? "🚌" : isGhat ? "⛴️" : isBeach ? "🏖️" : isHospital ? "🏥" : isSchool ? "🏫" : "📍";
                        const badgeBg = isStation ? "bg-amber-100 text-amber-900 border-amber-200" : isBus ? "bg-blue-100 text-blue-900 border-blue-200" : isGhat ? "bg-cyan-100 text-cyan-900 border-cyan-200" : isBeach ? "bg-teal-100 text-teal-900 border-teal-200" : isHospital ? "bg-rose-100 text-rose-900 border-rose-200" : "bg-emerald-100 text-emerald-900 border-emerald-200";

                        const isGoogle = place.source === "google_live_autocomplete";

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestion(place);
                            }}
                            className="w-full p-2.5 rounded-2xl text-left transition-all flex items-center gap-2.5 cursor-pointer border border-slate-200/80 bg-white hover:bg-emerald-50 shadow-2xs active:scale-[0.98]"
                          >
                            <div className={`w-8 h-8 rounded-xl ${badgeBg} border flex items-center justify-center text-sm shrink-0 shadow-2xs`}>
                              {badgeEmoji}
                            </div>
                            <div className="overflow-hidden flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-black text-slate-900 truncate block">{place.name}</span>
                                {isGoogle && (
                                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full shrink-0">
                                    Google 🔍
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-semibold truncate block mt-0.5">{place.full_address}</span>
                            </div>
                          </button>
                        );
                      })}
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
                  title="Swipe up / Tap to minimize"
                >
                  <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-slate-500 rounded-full transition-colors" />
                  <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    <span>Swipe up / Tap to minimize</span>
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
            ? `🛺 ${nearbyDrivers.length} Active Totos (5 km)`
            : "🛺 No active Totos nearby"}
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
          title="Zoom In"
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
          title="Zoom Out"
          className="w-10 h-10 bg-white/80 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-white/80 backdrop-blur-xl flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        >
          <Minus className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {/* Route Calculation Centered Screen-Blur Modal (Exact Middle, All Background Blurred, Non-touchable) */}
      {/* Route Calculation Centered Screen-Blur Modal (100% Liquid Glass Orb, Non-touchable Background, With Escape/Dismiss) */}
      {isCalculatingRoute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto select-none animate-in fade-in duration-200"
          style={{
            background: "radial-gradient(circle at 50% 40%, rgba(6,78,59,0.35) 0%, rgba(15,23,42,0.65) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 py-7 rounded-[32px] backdrop-blur-3xl bg-white/85 dark:bg-slate-900/85 border border-white/90 dark:border-white/25 shadow-[0_32px_80px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.95)] flex flex-col items-center gap-4 max-w-xs w-full text-center animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Top liquid specular glass reflection sheen */}
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none rounded-t-[32px]" />

            {/* VisionOS-grade Dual-Orb Liquid Plasma Spinner */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              {/* Outer Counter-Rotating Refractive Teal Ring */}
              <div
                className="absolute inset-0 rounded-full border-2 border-teal-400/30 border-t-teal-400 border-b-emerald-400"
                style={{ animation: "spin 3.2s linear infinite reverse" }}
              />
              {/* Inner High-Speed Glowing Emerald Plasma Ring */}
              <div
                className="absolute inset-1.5 rounded-full border-[2.5px] border-emerald-500/20 border-t-emerald-500 border-r-teal-300 shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                style={{ animation: "spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
              />
              {/* Pulsing Core Glow */}
              <div className="absolute inset-3 rounded-full bg-emerald-400/20 animate-ping opacity-50" />
              {/* Center Floating 3D Toto Emblem */}
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-white to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-400/40 flex items-center justify-center text-2xl shadow-lg">
                🛺
              </div>
            </div>

            <div className="space-y-1 z-10">
              <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Calculating Road Route & Fare...
              </h4>
              <p className="text-[11.5px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">
                Satellite road network & routing active
              </p>
            </div>

            {/* Live Progress Telemetry Pill */}
            <div className="z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Mapping rural roads & verified highway paths</span>
            </div>

            {/* Dismiss / Cancel Button — Guarantees user is never trapped */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                routeAbortControllerRef.current?.abort();
                setIsCalculatingRoute(false);
              }}
              className="z-10 text-xs font-black text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 pt-0.5 cursor-pointer transition-colors flex items-center gap-1 active:scale-95"
            >
              <span>✕ Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* 🚀 INITIAL LOCATION LOCKING FULL SCREEN MODAL (100% Liquid Glass Orb) */}
      {isLocatingInitialLock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto select-none animate-in fade-in duration-300"
          style={{
            background: "radial-gradient(circle at 50% 35%, rgba(6,78,59,0.45) 0%, rgba(2,44,34,0.65) 50%, rgba(2,11,9,0.85) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 py-7 rounded-[32px] backdrop-blur-3xl bg-white/90 dark:bg-slate-900/90 border border-white/90 dark:border-white/25 shadow-[0_32px_80px_rgba(0,0,0,0.45),inset_0_2px_4px_rgba(255,255,255,0.95)] flex flex-col items-center gap-4 max-w-xs w-full text-center animate-in zoom-in-95 duration-250 overflow-hidden">
            {/* Top liquid glass reflection sheen */}
            <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none rounded-t-[32px]" />

            {/* Concentric Pulsing Radar Rings & Satellite Emblem */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
              <div className="absolute inset-[-6px] rounded-full border border-teal-300/30 animate-pulse" />
              <div
                className="absolute inset-1 rounded-full border border-emerald-500/40 border-t-emerald-400"
                style={{ animation: "spin 2.5s linear infinite" }}
              />
              <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-slate-800 dark:to-slate-900 border-2 border-emerald-400/60 flex items-center justify-center text-3xl shadow-[0_0_28px_rgba(16,185,129,0.5)]">
                🛰️
              </div>
            </div>

            <div className="space-y-1.5 z-10">
              <h3 className="text-base font-black text-slate-900 dark:white tracking-tight">
                Acquiring your precise GPS location...
              </h3>
              <p className="text-[11.5px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">
                Connecting to high-precision satellite GPS...
              </p>
            </div>

            {/* Live Progress Indicator */}
            <div className="z-10 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>High-precision satellite GPS verification</span>
            </div>

            {/* Manual Entry Fallback Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setIsLocatingInitialLock(false);
              }}
              className="z-10 text-xs font-black text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline pt-0.5 cursor-pointer transition-colors active:scale-95"
            >
              Or enter pickup manually ➔
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
        title={mapLayer === "streets" ? "Satellite view" : "Street view"}
        className={`absolute bottom-57 right-3.5 z-20 w-11 h-11 bg-white/80 hover:bg-white text-slate-700 rounded-2xl shadow-lg border border-white/80 backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          sheetExpanded || activeSearchField ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        }`}
      >
        <Layers className="w-5 h-5 text-slate-700" />
      </button>

      {/* GPS Recenter Target Button (Bottom Right - Clears 120px Sheet with Comfort) */}
      <button
        type="button"
        onClick={handleTargetGpsClick}
        disabled={isLocating}
        title="Center on my GPS location"
        className={`absolute bottom-44 right-3.5 z-20 w-11 h-11 rounded-2xl shadow-lg border backdrop-blur-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
          sheetExpanded || activeSearchField ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        } ${
          isLocating
            ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.5)]"
            : hasValidPickup
            ? "bg-white/85 hover:bg-emerald-50 text-emerald-600 border-white/80"
            : "bg-amber-500/90 text-white border-amber-300 animate-bounce"
        }`}
      >
        {isLocating ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <LocateFixed className="w-5 h-5" />
        )}
      </button>

      {/* Backdrop overlay when actively searching — tapping outside closes search without overlapping */}
      {activeSearchField && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Close search suggestions"
          onClick={() => {
            setActiveSearchField(null);
            setHasStartedTyping(false);
          }}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. SLIDING UBER BOTTOM SHEET (VEHICLE TIER & CONFIRM RIDE)     */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`absolute bottom-16 sm:bottom-18 left-0 right-0 z-30 pointer-events-none transition-all duration-300 ${
          activeSearchField
            ? "opacity-0 pointer-events-none translate-y-36 invisible"
            : "opacity-100 pointer-events-auto visible"
        }`}
      >
        <div
          className={`pointer-events-auto relative mx-2 sm:mx-3 mb-2 rounded-3xl liquid-glass-card liquid-sheen p-3.5 sm:p-4 space-y-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none overflow-hidden ${
            sheetExpanded
              ? "max-h-[86dvh] pb-5 overflow-y-auto"
              : dropInputValue && dropInputValue.trim()
              ? "max-h-[140px] overflow-hidden"
              : "max-h-[110px] overflow-hidden"
          }`}
        >
          {/* Top specular reflection sheen */}
          <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-white/60 via-white/10 to-transparent pointer-events-none rounded-t-3xl" />
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
            title="Drag or tap to toggle sheet"
          >
            <div className="w-12 h-1.5 bg-slate-300/80 group-hover:bg-emerald-500 rounded-full transition-colors" />
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
              {sheetExpanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tap or drag down to minimize map view</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  <span className="text-emerald-700 font-black">Tap to view fare & ride options ⌃</span>
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
                className="flex items-center justify-between p-2.5 rounded-2xl liquid-glass-pill bg-white/35 dark:bg-slate-800/35 border border-white/70 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                title="Tap to view full booking details"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shrink-0 shadow-[0_4px_14px_rgba(16,185,129,0.45)] border border-emerald-300/40">
                    🛺
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900">Sundarban Smart Toto</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">
                        {isCalculatingRoute ? "₹--" : `₹${fareResult.totalFare}.00`}
                      </span>
                      {isDropOutOfService && (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                          Out of Service Area
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold truncate block">
                      {pickupInputValue ? pickupInputValue.slice(0, 14) : "Pickup"} ➔ {dropInputValue.slice(0, 14)} • {isCalculatingRoute ? "Calculating route..." : `${distanceKm} km`}
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
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-[0_4px_14px_rgba(16,185,129,0.35)] shrink-0 flex items-center gap-1 active:scale-95 transition-all cursor-pointer border border-emerald-400/40"
                >
                  <span>View Fare ⌃</span>
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
                        ? pickupInputValue.slice(0, 16)
                        : "⚠️ Select pickup location"}
                    </span>
                    <span>➔</span>
                    <span className="truncate text-slate-900">{dropInputValue.slice(0, 18)}</span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0">
                    {isCalculatingRoute ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Calculating route...
                      </span>
                    ) : distanceKm > 0 ? (
                      `${distanceKm} km • ~${roadDurationMin} min`
                    ) : (
                      "Road Route"
                    )}
                  </span>
                </div>

                {/* River Barrier / Island Ferry Crossing Alert Banner */}
                {riverCrossingAlert && (
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-950 dark:text-amber-200 text-xs space-y-1 shadow-sm backdrop-blur-md animate-in fade-in">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-black">
                      <span className="text-base shrink-0">⛴️</span>
                      <span>Ferry Crossing Required ({riverCrossingAlert.barrierName})</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                      {riverCrossingAlert.notice}
                    </p>
                  </div>
                )}

                {/* Service Territory Warning */}
                {isDropOutOfService && (
                  <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-2 text-rose-700 font-black">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Ride Booking Unavailable for Selected Destination</span>
                    </div>
                    <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                      Our service is currently focused across South 24 Parganas & Sundarbans (Diamond Harbour, Kakdwip, Namkhana, Bakkhali, Gangasagar).
                    </p>
                  </div>
                )}

                {/* Uber Toto Vehicle Card - Liquid Refraction Polish */}
                <div className="p-3.5 rounded-2xl liquid-glass-pill bg-white/35 dark:bg-slate-800/35 border-2 border-emerald-500/70 shadow-[0_8px_24px_rgba(16,185,129,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-600/30 shrink-0">
                      🛺
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-sm text-slate-900">Sundarban Smart Toto</h4>
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
                            ⚡ ~{nearestDriverInfo?.etaMin || 3} min pickup ({nearestDriverInfo?.distanceKm.toFixed(1)} km away)
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold">
                            ⚠️ No active toto found within 5 km
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-bold mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Verified Driver • Non-stop Road Route</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                      {isCalculatingRoute ? "₹--" : `₹${fareResult.totalFare}.00`}
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-500 block">
                      {isCalculatingRoute ? "⏳ Calculating route..." : distanceKm > 0 ? `Distance: ${distanceKm} km` : "Base Fare: ₹30"}
                    </span>
                  </div>
                </div>

                {/* Night Charge Breakdown Explanation Badge */}
                {fareResult.isNight && (
                  <div className="p-2.5 rounded-2xl bg-purple-50/90 border border-purple-200 text-xs text-purple-950 flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-purple-700 shrink-0" />
                      <span>
                        Daytime Fare: ₹{fareResult.totalFare - fareResult.nightCharge} + 🌙 Night Charge: ₹{fareResult.nightCharge} (9:30 PM - 5:00 AM)
                      </span>
                    </div>
                    <span className="text-purple-800 font-mono font-black shrink-0">= ₹{fareResult.totalFare}</span>
                  </div>
                )}

                {/* Passenger Selector - Tactile Liquid Pills */}
                <div className="p-2.5 rounded-2xl liquid-glass-pill bg-white/30 dark:bg-slate-800/30 border border-white/60 dark:border-white/10 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Passenger Count:</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      After 3 passengers: +₹2/km per rider
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { cnt: 3, label: "3 Riders", tag: "Base Fare" },
                      { cnt: 4, label: "4 Riders", tag: "+₹2/km" },
                      { cnt: 5, label: "5 Riders", tag: "+₹4/km" },
                      { cnt: 6, label: "6 Riders", tag: "+₹6/km" },
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
                    <span>💵 Payment:</span> Cash / UPI at destination
                  </span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    ✓ Verified road meter fare
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
                      ? "🚫 Account Temporarily Suspended"
                      : isCalculatingRoute
                      ? "⏳ Calculating road route & fare..."
                      : !hasValidPickup
                      ? "⚠️ Please select pickup location first"
                      : `🛺 Book Toto Ride • ₹${fareResult.totalFare}.00`}
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
                  <span>Where to? Select destination</span>
                </div>
                <span className="text-emerald-700 font-bold text-xs bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                  Open ⌃
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                      👋 Where to? Enter your destination
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {hasValidPickup
                        ? `Pickup: ${pickupInputValue.slice(0, 24)}`
                        : "Enter destination above or tap below to search"}
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
                    <span>Enter destination in West Bengal...</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Metered Ride Option (When no drop location is selected) */}
                <div className="pt-1.5 space-y-1">
                  <Button
                    size="lg"
                    disabled={isBlocked || !hasValidPickup}
                    onClick={() => {
                      triggerHaptic(30);
                      handleBookMeteredRide();
                    }}
                    className="w-full h-12 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:brightness-105 text-white cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <span>🛺 Book Metered Toto Ride (Pay at Finish)</span>
                  </Button>
                  <p className="text-[10.5px] text-center text-slate-500 font-semibold">
                    No fixed drop needed • Live GPS road meter calculates fare on ride finish
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-emerald-800 font-bold pt-1 px-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {nearbyDrivers.length > 0
                        ? `🛺 ${nearbyDrivers.length} active Totos (within 5 km)`
                        : "🔔 Driver dispatch active within 5 km"}
                    </span>
                  </span>
                  <span className="text-slate-500 font-semibold">⚡ Fast Pickup</span>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
