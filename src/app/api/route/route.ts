import { NextResponse } from "next/server";
import { calculateDistanceKm } from "@/lib/whatsapp/toto-engine";

// Regional Landmarks in South 24 Parganas Corridor
const REGIONAL_ROAD_ANCHORS = [
  { name: "কাকদ্বীপ স্টেশন রোড", lat: 21.8760, lng: 88.1920 },
  { name: "কাকদ্বীপ বাজার ও সুপার মার্কেট রোড", lat: 21.8750, lng: 88.1910 },
  { name: "কাকদ্বীপ হাসপাতাল মোড় চৌরাস্তা", lat: 21.8745, lng: 88.1880 },
  { name: "গণেশপুর মোড় সংযোগ সড়ক", lat: 21.8540, lng: 88.1980 },
  { name: "লট ৮ ফেরিঘাট (হারউড পয়েন্ট) রোড", lat: 21.8680, lng: 88.1630 },
  { name: "মাইজপুকুর সংযোগ রোড", lat: 21.8610, lng: 88.1750 },
  { name: "নামখানা বাসস্ট্যান্ড ও স্টেশন রোড", lat: 21.7674, lng: 88.2325 },
  { name: "হাতানিয়া দোয়ানিয়া ব্রিজ রোড", lat: 21.7640, lng: 88.2350 },
  { name: "নারায়ণপুর মোড় রোড", lat: 21.7450, lng: 88.2380 },
  { name: "বকখালি সৈকত বাসস্ট্যান্ড রোড", lat: 21.5645, lng: 88.2570 },
  { name: "ফ্রেজারগঞ্জ ফিশিং হারবার রোড", lat: 21.5790, lng: 88.2480 },
  { name: "ডায়মন্ড হারবার স্টেশন ও বাজার রোড", lat: 21.9870, lng: 88.1940 },
  { name: "ডায়মন্ড হারবার কেল্লা ও জেটি ঘাট রোড", lat: 22.1890, lng: 88.2010 },
  { name: "লক্ষ্মীকান্তপুর স্টেশন ও বাজার রোড", lat: 22.0120, lng: 88.3180 },
  { name: "কুলপি চৌরাস্তা মোড়", lat: 22.0820, lng: 88.2420 },
  { name: "নিশ্চিন্তপুর মোড়", lat: 21.9420, lng: 88.1970 },
];

function getNearestRoadAnchor(lat: number, lng: number): string | null {
  let closest = REGIONAL_ROAD_ANCHORS[0];
  let minD = 999999;
  for (const anchor of REGIONAL_ROAD_ANCHORS) {
    const d = calculateDistanceKm(lat, lng, anchor.lat, anchor.lng);
    if (d < minD) {
      minD = d;
      closest = anchor;
    }
  }
  return minD <= 1.5 ? closest.name : null;
}

function translateRoadName(name: string): string {
  if (!name) return "";
  const lower = name.toLowerCase();
  if (lower.includes("diamond harbour")) return "ডায়মন্ড হারবার রোড (NH-117)";
  if (lower.includes("national highway") || lower.includes("nh 117") || lower.includes("nh-117") || lower.includes("nh117")) {
    return "১১৭ নং জাতীয় সড়ক (NH-117)";
  }
  if (lower.includes("kakdwip")) return "কাকদ্বীপ মেইন রোড";
  if (lower.includes("namkhana")) return "নামখানা হাইওয়ে";
  if (lower.includes("bakkahli") || lower.includes("bakkhali")) return "বকখালি সৈকত রোড";
  if (lower.includes("kulpi")) return "কুলপি রোড";
  if (lower.includes("harwood") || lower.includes("lot 8") || lower.includes("lot-8")) return "লট ৮ ফেরিঘাট রোড";
  return name;
}

const serverRouteCache = new Map<string, any>();

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fromLat = parseFloat(searchParams.get("fromLat") || "");
    const fromLng = parseFloat(searchParams.get("fromLng") || "");
    const toLat = parseFloat(searchParams.get("toLat") || "");
    const toLng = parseFloat(searchParams.get("toLng") || "");

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return NextResponse.json({ error: "Missing fromLat/fromLng/toLat/toLng" }, { status: 400 });
    }

    // Fast in-memory cache for repeated routes (0ms response)
    const cacheKey = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}-${toLat.toFixed(4)},${toLng.toFixed(4)}`;
    if (serverRouteCache.has(cacheKey)) {
      return NextResponse.json(serverRouteCache.get(cacheKey));
    }
    
    // 1. Query Primary and Secondary OSRM Driving & Toto-friendly Engines in PARALLEL with road-snapping radiuses
    const osrmEndpoints = [
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&geometries=geojson&radiuses=2500;2500&continue_straight=false`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&geometries=geojson&radiuses=2500;2500&continue_straight=false`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/bicycle/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&geometries=geojson&radiuses=2500;2500&continue_straight=false`,
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&geometries=geojson&radiuses=2500;2500&continue_straight=false`,
    ];

    let coordinates: [number, number][] = [];
    let distanceKm = 0;
    let durationMin = 0;
    let roadSegments: string[] = [];
    let detailedSteps: Array<{
      road: string;
      distanceMeters: number;
      maneuver: string;
    }> = [];
    let isExactRoadRoute = false;

    const queryEndpoint = async (url: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "SundarbanRiders/1.0" },
          signal: controller.signal,
          next: { revalidate: 300 },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            return data.routes[0];
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
      throw new Error("No route found");
    };

    try {
      // Race OSRM mirrors — whichever responds first with full geometry wins!
      const bestRoute = await Promise.any(osrmEndpoints.map((url) => queryEndpoint(url)));
      if (bestRoute) {
        distanceKm = Math.max(0.8, Math.round((bestRoute.distance / 1000) * 10) / 10);
        durationMin = Math.max(2, Math.round(bestRoute.duration / 60));

        // Support BOTH GeoJSON coordinate arrays and OSRM encoded polyline strings!
        if (bestRoute.geometry && Array.isArray(bestRoute.geometry.coordinates)) {
          coordinates = bestRoute.geometry.coordinates.map((coord: [number, number]) => [
            coord[1],
            coord[0],
          ]);
          isExactRoadRoute = true;
        } else if (typeof bestRoute.geometry === "string" && bestRoute.geometry.length > 0) {
          coordinates = decodePolyline(bestRoute.geometry);
          isExactRoadRoute = true;
        }

        if (bestRoute.legs && bestRoute.legs[0] && bestRoute.legs[0].steps) {
          bestRoute.legs[0].steps.forEach((step: any) => {
            const translated = translateRoadName(step.name || "");
            if (translated && !roadSegments.includes(translated)) {
              roadSegments.push(translated);
            }
            if (step.distance > 20) {
              detailedSteps.push({
                road: translated || "সংযোগকারী সড়ক",
                distanceMeters: Math.round(step.distance),
                maneuver: step.maneuver?.type || "continue",
              });
            }
          });
        }
      }
    } catch {
      // Both mirrors timed out or failed
    }

    // Google Directions API fallback if configured and OSRM returned nothing
    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (coordinates.length === 0 && googleKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&mode=driving&key=${googleKey}`;
        const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(3500) });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && gData.routes?.[0]) {
            const gRoute = gData.routes[0];
            const gLeg = gRoute.legs?.[0];
            if (gLeg) {
              distanceKm = Math.max(0.8, Math.round(((gLeg.distance?.value || 1000) / 1000) * 10) / 10);
              durationMin = Math.max(2, Math.round((gLeg.duration?.value || 300) / 60));
              if (gRoute.overview_polyline?.points) {
                coordinates = decodePolyline(gRoute.overview_polyline.points);
                isExactRoadRoute = true;
              }
            }
          }
        }
      } catch {}
    }

    // Realistic Road Distance Fallback if OSRM and Google were completely unreachable
    if (coordinates.length === 0) {
      const directDist = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
      // Realistic road winding multiplier (1.42x) for rural South 24 Parganas roads
      const roadWindingFactor = 1.42;
      distanceKm = Math.max(1.0, Math.round(directDist * roadWindingFactor * 10) / 10);
      durationMin = Math.max(3, Math.round(distanceKm * 2.8));

      // Generate 16 curved road points with gentle geographic curvature
      const numPoints = 16;
      const dLat = toLat - fromLat;
      const dLng = toLng - fromLng;
      // Perpendicular vector for natural road curve
      const pLat = -dLng * 0.08;
      const pLng = dLat * 0.08;

      for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        const curveOffset = Math.sin(fraction * Math.PI);
        const lat = fromLat + dLat * fraction + pLat * curveOffset;
        const lng = fromLng + dLng * fraction + pLng * curveOffset;
        coordinates.push([Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000]);
      }
    }

    // Anchor-based Road Identification (ensures even unnamed rural roads have rich Bengali names)
    const originAnchor = getNearestRoadAnchor(fromLat, fromLng);
    const destAnchor = getNearestRoadAnchor(toLat, toLng);

    const routePathPills: string[] = [];
    if (originAnchor) routePathPills.push(originAnchor);

    roadSegments.forEach((r) => {
      if (!routePathPills.includes(r)) routePathPills.push(r);
    });

    if (destAnchor && !routePathPills.includes(destAnchor)) {
      routePathPills.push(destAnchor);
    }

    if (routePathPills.length === 0) {
      routePathPills.push("ডায়মন্ড হারবার রোড (NH-117)");
    }

    const routeSummaryBengali = routePathPills.join(" ➔ ");
    const primaryRoad = routePathPills[0] || "ডায়মন্ড হারবার রোড (NH-117)";
    const viaRoads = routePathPills.length > 2 ? routePathPills.slice(1, -1).join(", ") : routePathPills[1] || "";

    const payload = {
      success: true,
      isExactRoadRoute,
      distanceKm,
      durationMin,
      coordinates,
      roadNames: routePathPills,
      primaryRoad,
      viaRoads,
      routeSummaryBengali,
      originRoad: originAnchor || "পিকআপ রোড",
      destRoad: destAnchor || "গন্তব্য রোড",
      steps: detailedSteps,
    };

    if (isExactRoadRoute && coordinates.length > 0) {
      serverRouteCache.set(cacheKey, payload);
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Route calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Route calculation failed" },
      { status: 500 }
    );
  }
}
