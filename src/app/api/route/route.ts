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

    // 1. Query OSRM Driving Engine with Steps and GeoJSON
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&steps=true&geometries=geojson`;

    let coordinates: [number, number][] = [];
    let distanceKm = 0;
    let durationMin = 0;
    let roadSegments: string[] = [];
    let detailedSteps: Array<{
      road: string;
      distanceMeters: number;
      maneuver: string;
    }> = [];

    try {
      const res = await fetch(osrmUrl, {
        headers: { "User-Agent": "SundarbanRiders/1.0" },
        next: { revalidate: 60 }, // Cache identical routes for 1 minute
      });

      if (res.ok) {
        const data = await res.json();
        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          distanceKm = Math.round((route.distance / 1000) * 10) / 10;
          durationMin = Math.max(1, Math.round(route.duration / 60));

          // GeoJSON coordinates are [lng, lat], Leaflet polyline expects [lat, lng]
          if (route.geometry && Array.isArray(route.geometry.coordinates)) {
            coordinates = route.geometry.coordinates.map((coord: [number, number]) => [
              coord[1],
              coord[0],
            ]);
          }

          if (route.legs && route.legs[0] && route.legs[0].steps) {
            route.legs[0].steps.forEach((step: any) => {
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
      }
    } catch (osrmErr) {
      console.warn("OSRM routing API unreachable, falling back to direct interpolation:", osrmErr);
    }

    // Fallback if OSRM was empty or failed
    if (coordinates.length === 0) {
      const directDist = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
      distanceKm = Math.max(0.5, directDist);
      durationMin = Math.max(2, Math.round(directDist * 2.5));

      // Generate 10 interpolated curve points
      for (let i = 0; i <= 10; i++) {
        const fraction = i / 10;
        const lat = fromLat + (toLat - fromLat) * fraction;
        const lng = fromLng + (toLng - fromLng) * fraction;
        coordinates.push([lat, lng]);
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

    return NextResponse.json({
      success: true,
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
    });
  } catch (error: any) {
    console.error("Route calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Route calculation failed" },
      { status: 500 }
    );
  }
}
