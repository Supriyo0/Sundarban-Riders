import { NextResponse } from "next/server";
import { SUNDARBAN_COMPREHENSIVE_PLACES, SundarbanPlace } from "@/lib/data/sundarban-places";
import { isLocationInServiceArea, checkRiverBarrierCrossings } from "@/lib/pricing/service-area";

const geocodeCache = new Map<string, { timestamp: number; data: any }>();

// West Bengal Geographic Bounding Box
const WEST_BENGAL_BBOX = {
  minLat: 21.20,
  maxLat: 27.40,
  minLng: 85.80,
  maxLng: 89.95,
};

function isInsideWestBengal(lat: number, lng: number): boolean {
  return (
    lat >= WEST_BENGAL_BBOX.minLat &&
    lat <= WEST_BENGAL_BBOX.maxLat &&
    lng >= WEST_BENGAL_BBOX.minLng &&
    lng <= WEST_BENGAL_BBOX.maxLng
  );
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Map OSM tags to clean English category labels & emojis
const OSM_TAG_MAP: Record<string, { label: string; badge: string }> = {
  station: { label: "Railway Station", badge: "🚆" },
  halt: { label: "Railway Halt", badge: "🚆" },
  bus_station: { label: "Bus Terminal", badge: "🚌" },
  bus_stop: { label: "Bus Stand", badge: "🚌" },
  ferry_terminal: { label: "Ferry Ghat", badge: "⛴️" },
  pier: { label: "Jetty Ghat", badge: "⛴️" },
  hospital: { label: "Hospital", badge: "🏥" },
  clinic: { label: "Clinic", badge: "🏥" },
  pharmacy: { label: "Pharmacy", badge: "💊" },
  school: { label: "School", badge: "🏫" },
  college: { label: "College", badge: "🏫" },
  university: { label: "University", badge: "🏫" },
  marketplace: { label: "Market / Bazar", badge: "🛒" },
  market: { label: "Market / Bazar", badge: "🛒" },
  supermarket: { label: "Supermarket", badge: "🛒" },
  shop: { label: "Shop", badge: "🛍️" },
  hotel: { label: "Hotel / Resort", badge: "🏨" },
  guest_house: { label: "Lodge / Guest House", badge: "🏨" },
  restaurant: { label: "Restaurant", badge: "🍽️" },
  cafe: { label: "Cafe", badge: "☕" },
  beach: { label: "Sea Beach", badge: "🏖️" },
  place_of_worship: { label: "Temple / Ashram", badge: "🏛️" },
  bank: { label: "Bank / ATM", badge: "🏦" },
  police: { label: "Police Station", badge: "👮" },
  bridge: { label: "Bridge", badge: "🌉" },
};

function getCategoryInfo(category: string): { label: string; badge: string } {
  switch (category) {
    case "station":
      return { label: "Railway Station", badge: "🚆" };
    case "bus_stand":
      return { label: "Bus Stand", badge: "🚌" };
    case "toto_stand":
      return { label: "Toto Stand", badge: "🛺" };
    case "ferry_ghat":
      return { label: "Ferry Ghat", badge: "⛴️" };
    case "bridge":
      return { label: "Bridge", badge: "🌉" };
    case "hospital":
      return { label: "Hospital", badge: "🏥" };
    case "school_college":
      return { label: "School / College", badge: "🏫" };
    case "market":
      return { label: "Bazar / Market", badge: "🛒" };
    case "beach":
      return { label: "Sea Beach", badge: "🏖️" };
    case "hotel":
      return { label: "Hotel / Resort", badge: "🏨" };
    case "restaurant":
      return { label: "Restaurant", badge: "🍽️" };
    case "temple":
      return { label: "Temple / Ashram", badge: "🏛️" };
    case "admin":
      return { label: "Admin Office", badge: "🏛️" };
    default:
      return { label: "Place", badge: "📍" };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const query = searchParams.get("q") || searchParams.get("query");
    const isIpRequest = searchParams.get("ip") === "true";

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 0: IP GEOLOCATION (App Startup Fallback)
    // ─────────────────────────────────────────────────────────────────────────
    if (isIpRequest) {
      try {
        const ipRes = await fetch("https://ipwho.is/", {
          headers: { "User-Agent": "SundarbanRiders/2.0" },
          cache: "no-store",
          signal: AbortSignal.timeout(2000),
        });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          const ipLat = Number(ipData?.latitude);
          const ipLng = Number(ipData?.longitude);
          if (ipData.success && ipLat && ipLng && isInsideWestBengal(ipLat, ipLng)) {
            const cityName = ipData.city || "Current Location";
            return NextResponse.json({
              name: cityName,
              full_address: `${cityName}, West Bengal, India`,
              lat: ipLat,
              lng: ipLng,
              source: "ip_geolocation",
              isInServiceArea: true,
            });
          }
        }
      } catch {}

      return NextResponse.json(
        { error: "IP location unavailable or outside West Bengal" },
        { status: 404 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: FORWARD SEARCH (GOOGLE MAPS & OPENSTREETMAP LEVEL POI SEARCH)
    // ─────────────────────────────────────────────────────────────────────────
    if (query !== null) {
      const cleanQ = (query || "").trim();
      const biasLat = parseFloat(lat || "21.876");
      const biasLng = parseFloat(lng || "88.192");
      const cacheKey = `fwd_en_${cleanQ.toLowerCase()}_${biasLat.toFixed(2)}_${biasLng.toFixed(2)}`;

      // Fast in-memory cache hit
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return NextResponse.json(cached.data);
      }

      if (!cleanQ || cleanQ.length < 2) {
        return NextResponse.json({ suggestions: [] });
      }

      const qNorm = normalize(cleanQ);
      const qTokens = cleanQ
        .toLowerCase()
        .split(/\s+/)
        .map(normalize)
        .filter((t) => t.length > 1);

      const suggestions: Array<{
        name: string;
        full_address: string;
        lat: number;
        lng: number;
        category?: string;
        categoryBadge?: string;
        source: string;
        isInServiceArea: boolean;
        distanceDeg: number;
        score: number;
      }> = [];

      // ── STEP A: Instant High-Precision Local Search over Curated Places (0ms) ──
      for (const p of SUNDARBAN_COMPREHENSIVE_PLACES) {
        const nameNorm = normalize(p.name);
        const catInfo = getCategoryInfo(p.category);
        let score = 0;

        // Exact / prefix / token match
        if (nameNorm.startsWith(qNorm)) {
          score = 120;
        } else if (nameNorm.includes(qNorm)) {
          score = 100;
        } else if (
          qTokens.length > 0 &&
          qTokens.every(
            (t) =>
              nameNorm.includes(t) ||
              p.aliases?.some((a) => normalize(a).includes(t))
          )
        ) {
          score = 85;
        } else {
          // Check aliases
          for (const a of p.aliases || []) {
            const aNorm = normalize(a);
            if (aNorm.includes(qNorm)) {
              score = 65;
              break;
            }
          }
        }

        if (score > 0) {
          const distDeg = Math.hypot(p.lat - biasLat, p.lng - biasLng);
          const finalScore = score - distDeg * 4;
          const subInfo = p.subLocality ? `${p.subLocality}, ` : "";

          suggestions.push({
            name: p.name,
            full_address: `${p.name} (${catInfo.label}), ${subInfo}West Bengal`,
            lat: p.lat,
            lng: p.lng,
            category: catInfo.label,
            categoryBadge: catInfo.badge,
            source: "local_verified",
            isInServiceArea: true,
            distanceDeg: distDeg,
            score: finalScore,
          });
        }
      }

      // ── STEP B: Parallel Live Search across ALL of West Bengal (OpenStreetMap & Google Suggest) ──
      // Guarantees that ANY location, shop, village, road, or address in West Bengal is found
      const osmTasks: Promise<void>[] = [];

      // 1. Google Suggest (Discovers real user search phrases from Google)
      let googleCompletions: string[] = [];
      osmTasks.push(
        (async () => {
          try {
            const gRes = await fetch(
              `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(
                cleanQ
              )}`,
              {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(1500),
              }
            );
            if (gRes.ok) {
              const gData = await gRes.json();
              googleCompletions = (gData[1] || []).slice(0, 4);
            }
          } catch {}
        })()
      );

      // 2. Photon (Komoot ElasticSearch over full OpenStreetMap database)
      osmTasks.push(
        (async () => {
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
              cleanQ
            )}&lat=${biasLat}&lon=${biasLng}&lang=en&limit=15&bbox=85.8,21.2,89.95,27.4`;
            const pRes = await fetch(photonUrl, {
              headers: { "User-Agent": "SundarbanRiders/2.0" },
              signal: AbortSignal.timeout(2000),
            });
            if (pRes.ok) {
              const pData = await pRes.json();
              (pData.features || []).forEach((f: any) => {
                const props = f.properties || {};
                const name = props.name || props.street;
                const coords = f.geometry?.coordinates;
                if (!name || !coords || coords.length < 2) return;
                const pLng = coords[0];
                const pLat = coords[1];
                if (!isInsideWestBengal(pLat, pLng)) return;

                const osmType = props.osm_value || props.type || "";
                const tagInfo = OSM_TAG_MAP[osmType] || { label: "Place", badge: "📍" };

                const addrParts = [
                  props.street,
                  props.district || props.city || props.county,
                  "West Bengal",
                ].filter(Boolean);

                const full_address = `${name}, ${addrParts.join(", ")}`;

                const isDup = suggestions.some(
                  (s) =>
                    normalize(s.name) === normalize(name) ||
                    (Math.abs(s.lat - pLat) < 0.001 && Math.abs(s.lng - pLng) < 0.001)
                );

                if (!isDup) {
                  const distDeg = Math.hypot(pLat - biasLat, pLng - biasLng);
                  suggestions.push({
                    name,
                    full_address,
                    lat: pLat,
                    lng: pLng,
                    category: tagInfo.label,
                    categoryBadge: tagInfo.badge,
                    source: "openstreetmap_photon",
                    isInServiceArea: true,
                    distanceDeg: distDeg,
                    score: 60 - distDeg * 3,
                  });
                }
              });
            }
          } catch {}
        })()
      );

      // 3. OSM Nominatim Search with Multi-Query Token Relaxation
      osmTasks.push(
        (async () => {
          // Prepare relaxed candidate queries in case of slight typo or compound word
          const queryCandidates = [cleanQ];
          const simplified = cleanQ
            .replace(/seabeach/gi, "beach")
            .replace(/sea beach/gi, "beach")
            .replace(/\bmore\b/gi, "")
            .trim();
          if (simplified && simplified !== cleanQ) queryCandidates.push(simplified);
          const firstWord = cleanQ.split(" ")[0];
          if (firstWord && firstWord.length > 3 && !queryCandidates.includes(firstWord)) {
            queryCandidates.push(firstWord);
          }

          for (const cand of queryCandidates) {
            try {
              const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                cand
              )}&countrycodes=in&viewbox=85.8,21.2,89.95,27.4&bounded=0&limit=8&addressdetails=1&accept-language=en`;
              const nRes = await fetch(nomUrl, {
                headers: { "User-Agent": "SundarbanRiders/2.0 (dispatch@sundarbanriders.com)" },
                signal: AbortSignal.timeout(1900),
              });
              if (nRes.ok) {
                const nData = await nRes.json();
                let addedAny = false;
                (nData || []).forEach((item: any) => {
                  const nLat = parseFloat(item.lat);
                  const nLng = parseFloat(item.lon);
                  if (isNaN(nLat) || isNaN(nLng) || !isInsideWestBengal(nLat, nLng)) return;

                  const parts = (item.display_name || "").split(",");
                  const placeName = parts[0]?.trim() || cand;
                  const full_address = parts.slice(0, 4).join(",").trim();

                  const isDup = suggestions.some(
                    (s) =>
                      normalize(s.name) === normalize(placeName) ||
                      (Math.abs(s.lat - nLat) < 0.001 && Math.abs(s.lng - nLng) < 0.001)
                  );

                  if (!isDup) {
                    const distDeg = Math.hypot(nLat - biasLat, nLng - biasLng);
                    suggestions.push({
                      name: placeName,
                      full_address,
                      lat: nLat,
                      lng: nLng,
                      category: "Landmark",
                      categoryBadge: "📍",
                      source: "openstreetmap_nominatim",
                      isInServiceArea: true,
                      distanceDeg: distDeg,
                      score: 55 - distDeg * 3,
                    });
                    addedAny = true;
                  }
                });

                if (addedAny && suggestions.length >= 6) {
                  break; // Found sufficient high-quality matches
                }
              }
            } catch {}
          }
        })()
      );

      // Wait up to 2.0s in parallel so responses remain snappy while checking all sources
      await Promise.allSettled(osmTasks);

      // Sort by score (exact / close matches on top, then proximity)
      suggestions.sort((a, b) => b.score - a.score);

      const finalSuggestions = suggestions.slice(0, 30);

      const responsePayload = {
        name: finalSuggestions[0]?.name || cleanQ,
        full_address: finalSuggestions[0]?.full_address || `${cleanQ}, West Bengal`,
        lat: finalSuggestions[0]?.lat || 0,
        lng: finalSuggestions[0]?.lng || 0,
        source: finalSuggestions[0]?.source || "search",
        suggestions: finalSuggestions,
        googleCompletions,
      };

      // Cache for 5 minutes
      geocodeCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
      if (geocodeCache.size > 500) {
        const oldestKey = geocodeCache.keys().next().value;
        if (oldestKey) geocodeCache.delete(oldestKey);
      }

      return NextResponse.json(responsePayload);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: REVERSE GEOCODING (lat/lng → English Address Name)
    // ─────────────────────────────────────────────────────────────────────────
    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing lat/lng or query" }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const isInTerritory = isLocationInServiceArea(latitude, longitude);

    // 1. Check nearest curated place in SUNDARBAN_COMPREHENSIVE_PLACES (within 0.85 km)
    let closestPlace: SundarbanPlace | null = null;
    let minD = 0.85;

    for (const p of SUNDARBAN_COMPREHENSIVE_PLACES) {
      const d = Math.hypot(latitude - p.lat, longitude - p.lng) * 111; // approx km
      if (d < minD) {
        minD = d;
        closestPlace = p;
      }
    }

    if (closestPlace) {
      const catInfo = getCategoryInfo(closestPlace.category);
      const subInfo = closestPlace.subLocality ? `${closestPlace.subLocality}, ` : "";
      return NextResponse.json({
        name: closestPlace.name,
        full_address: `${closestPlace.name} (${catInfo.label}), ${subInfo}West Bengal`,
        lat: latitude,
        lng: longitude,
        isInServiceArea: isInTerritory,
        source: "google_verified_local",
      });
    }

    // 2. OpenStreetMap Nominatim reverse geocode in clean English
    try {
      const nomRevUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`;
      const res = await fetch(nomRevUrl, {
        headers: { "User-Agent": "SundarbanRiders/2.0 (contact@sundarbanriders.com)" },
        signal: AbortSignal.timeout(1200),
      });

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const road = addr.road || addr.street || addr.neighbourhood || addr.suburb || addr.village;
        const district = addr.county || addr.state_district || addr.city || "South 24 Parganas";
        const primary = addr.amenity || addr.tourism || addr.building || road || "Location";

        const parts = [road, district, "West Bengal"].filter(Boolean);
        const fullAddr = `${primary}, ${parts.join(", ")}`;

        return NextResponse.json({
          name: primary,
          full_address: fullAddr,
          lat: latitude,
          lng: longitude,
          isInServiceArea: isInTerritory,
          source: "nominatim_reverse",
        });
      }
    } catch {}

    // Fallback: Coordinates in English
    return NextResponse.json({
      name: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      full_address: `Coordinates: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E, West Bengal`,
      lat: latitude,
      lng: longitude,
      isInServiceArea: isInTerritory,
      source: "coordinates_fallback",
    });
  } catch (error: any) {
    console.error("Geocode route exception:", error);
    return NextResponse.json(
      { error: "Internal geocoding error", details: error?.message },
      { status: 500 }
    );
  }
}
