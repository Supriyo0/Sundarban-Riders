import { NextResponse } from "next/server";
import { SUNDARBAN_LANDMARKS, calculateDistanceKm } from "@/lib/whatsapp/toto-engine";
import { SUNDARBAN_COMPREHENSIVE_PLACES } from "@/lib/data/sundarban-places";
import {
  isLocationInServiceArea,
  DEFAULT_CENTRAL_HUB,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/pricing/service-area";

const geocodeCache = new Map<string, { timestamp: number; data: any }>();

// South 24 Parganas bounding box (used for Overpass & Nominatim viewbox)
const REGION = {
  south: 21.45,
  west: 87.85,
  north: 22.65,
  east: 89.00,
};
// Overpass API endpoint (public, no key needed)
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Place type tags that Overpass should return
// This covers EVERY kind of place users might search for
const OVERPASS_QUERY_TAGS = [
  "amenity",     // hospital, school, college, restaurant, cafe, pharmacy, bank, bus_station, ferry_terminal, police, fire_station
  "shop",        // every kind of shop
  "tourism",     // hotel, guest_house, beach, attraction, museum
  "railway",     // station, halt, tram_stop
  "highway",     // bus_stop
  "natural",     // beach, water, island
  "leisure",     // park, beach, sports_centre
  "public_transport", // station, stop_position, platform
  "man_made",    // bridge, pier, jetty
  "waterway",    // ferry, dock
  "landuse",     // market, commercial, industrial
  "office",      // government, administrative
  "historic",    // fort, temple, mosque, church
  "place",       // village, hamlet, suburb, town, neighbourhood
].join("|");

// Map OSM amenity/type values → Bengali human-readable labels
const OSM_TYPE_LABEL: Record<string, string> = {
  hospital: "হাসপাতাল",
  clinic: "ক্লিনিক",
  doctors: "ডাক্তার",
  pharmacy: "ওষুধের দোকান",
  school: "স্কুল",
  college: "কলেজ",
  university: "বিশ্ববিদ্যালয়",
  kindergarten: "শিশু বিদ্যালয়",
  library: "পাঠাগার",
  restaurant: "রেস্তোরাঁ",
  fast_food: "ফাস্ট ফুড",
  cafe: "ক্যাফে",
  bar: "বার",
  pub: "পাব",
  food_court: "ফুড কোর্ট",
  hotel: "হোটেল",
  guest_house: "গেস্ট হাউস",
  hostel: "হোস্টেল",
  motel: "মোটেল",
  bus_station: "বাস টার্মিনাল",
  bus_stop: "বাস স্ট্যান্ড",
  ferry_terminal: "ফেরিঘাট",
  taxi: "ট্যাক্সি স্ট্যান্ড",
  station: "রেলস্টেশন",
  halt: "রেলহল্ট",
  tram_stop: "ট্রাম স্টপ",
  bank: "ব্যাংক",
  atm: "এটিএম",
  post_office: "পোস্ট অফিস",
  police: "থানা",
  fire_station: "দমকল",
  community_centre: "কমিউনিটি সেন্টার",
  place_of_worship: "মন্দির/মসজিদ/গির্জা",
  marketplace: "বাজার",
  market: "বাজার",
  supermarket: "সুপারমার্কেট",
  mall: "শপিং মল",
  beach: "সমুদ্র সৈকত",
  park: "পার্ক",
  stadium: "স্টেডিয়াম",
  swimming_pool: "সুইমিং পুল",
  sports_centre: "স্পোর্টস সেন্টার",
  bridge: "সেতু",
  pier: "পিয়ার/ঘাট",
  government: "সরকারি অফিস",
  administrative: "প্রশাসনিক অফিস",
  fort: "দুর্গ",
  temple: "মন্দির",
  mosque: "মসজিদ",
  church: "গির্জা",
  village: "গ্রাম",
  hamlet: "পাড়া/গ্রাম",
  suburb: "এলাকা",
  town: "শহর",
  neighbourhood: "পাড়া",
  fuel: "পেট্রোল পাম্প",
  charging_station: "চার্জিং স্টেশন",
  parking: "পার্কিং",
  toilet: "শৌচালয়",
};

function getOsmTypeLabel(props: Record<string, string>): string {
  const amenity = props.amenity || props.shop || props.tourism || props.railway
    || props.highway || props.natural || props.leisure || props.office
    || props.historic || props.place || "";
  return OSM_TYPE_LABEL[amenity] || amenity || "";
}

/**
 * Build an Overpass QL query that finds ALL named places in the South 24 Parganas
 * region matching the user's search text (Bengali or English, case-insensitive regex).
 * Returns nodes AND ways (like buildings, schools, markets that are mapped as areas).
 */
function buildOverpassQuery(searchText: string, biasLat: number, biasLng: number): string {
  // Escape special regex characters in the search text
  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const { south, west, north, east } = REGION;
  const bbox = `${south},${west},${north},${east}`;

  // Query for nodes and ways with a matching name (any tag category)
  // We use ~"text",i for case-insensitive regex matching on the "name" tag
  return `[out:json][timeout:20];
(
  node["name"~"${escaped}",i](${bbox});
  way["name"~"${escaped}",i](${bbox});
  relation["name"~"${escaped}",i](${bbox});
);
out center 30;`;
}

/**
 * Parse Overpass API response elements into our suggestion format
 */
function parseOverpassElements(elements: any[], biasLat: number, biasLng: number) {
  const results: Array<{
    name: string;
    full_address: string;
    lat: number;
    lng: number;
    source: string;
    isInServiceArea: boolean;
    distanceDeg?: number;
  }> = [];

  for (const el of elements) {
    // Get coordinates (nodes have lat/lon directly; ways/relations have a center)
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;

    const tags = el.tags || {};
    const name = tags.name || tags["name:bn"] || tags["name:en"] || "";
    if (!name || name.trim().length < 2) continue;

    const typeLabel = getOsmTypeLabel(tags);
    const subLocality = tags["addr:suburb"] || tags["addr:city"] || tags["addr:village"]
      || tags["addr:town"] || tags["is_in:city"] || tags["is_in:town"] || "";
    const district = tags["addr:state_district"] || tags["is_in:state_district"] || "দক্ষিণ ২৪ পরগনা";

    const fullAddressParts = [
      typeLabel ? `(${typeLabel})` : "",
      subLocality,
      district,
      "পশ্চিমবঙ্গ",
    ].filter(Boolean);
    const full_address = `${name}, ${fullAddressParts.join(", ")}`;

    results.push({
      name,
      full_address,
      lat,
      lng,
      source: "overpass_osm",
      isInServiceArea: true,
      distanceDeg: Math.hypot(lat - biasLat, lng - biasLng),
    });
  }

  return results;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const query = searchParams.get("q") || searchParams.get("query");
    const isIpRequest = searchParams.get("ip") === "true";

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 0: IP-BASED GEOLOCATION FALLBACK
    // ─────────────────────────────────────────────────────────────────────────
    if (isIpRequest) {
      try {
        const ipRes = await fetch("https://ipwho.is/", {
          headers: { "User-Agent": "SundarbanRiders/2.0" },
          cache: "no-store",
        });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          const ipLat = Number(ipData?.latitude);
          const ipLng = Number(ipData?.longitude);
          if (ipData.success && ipLat && ipLng && isLocationInServiceArea(ipLat, ipLng)) {
            const cityName = ipData.city || ipData.region || "আপনার বর্তমান অবস্থান";
            return NextResponse.json({
              name: cityName,
              full_address: [ipData.city, ipData.region, ipData.postal, ipData.country]
                .filter(Boolean).join(", "),
              lat: ipLat,
              lng: ipLng,
              source: "ip_geolocation",
              isInServiceArea: true,
            });
          }
        }
      } catch {}

      // Secondary IP fallback
      try {
        const ipapiRes = await fetch("https://ipapi.co/json/", {
          headers: { "User-Agent": "SundarbanRiders/2.0" },
          cache: "no-store",
        });
        if (ipapiRes.ok) {
          const apiData = await ipapiRes.json();
          const ipLat = Number(apiData?.latitude);
          const ipLng = Number(apiData?.longitude);
          if (ipLat && ipLng && isLocationInServiceArea(ipLat, ipLng)) {
            const cityName = apiData.city || apiData.region || "আপনার অবস্থান";
            return NextResponse.json({
              name: cityName,
              full_address: `${cityName}, ${apiData.region || ""}, ${apiData.country_name || "India"}`,
              lat: ipLat,
              lng: ipLng,
              source: "ipapi",
              isInServiceArea: true,
            });
          }
        }
      } catch {}

      return NextResponse.json(
        { error: "IP location unavailable or outside service territory" },
        { status: 404 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: FORWARD SEARCH (PLACE SUGGESTIONS)
    // ─────────────────────────────────────────────────────────────────────────
    if (query !== null) {
      const cleanQ = (query || "").trim();
      const biasLat = parseFloat(lat || "21.876");
      const biasLng = parseFloat(lng || "88.192");
      const cacheKey = `fwd_${cleanQ.toLowerCase()}_${biasLat.toFixed(2)}_${biasLng.toFixed(2)}`;

      // 1. Check in-memory cache (instant 0ms for repeated queries)
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return NextResponse.json(cached.data);
      }

      if (!cleanQ || cleanQ.length < 2) {
        return NextResponse.json({ suggestions: [] });
      }

      const suggestions: Array<{
        name: string;
        full_address: string;
        lat: number;
        lng: number;
        source?: string;
        isInServiceArea: boolean;
        distanceDeg?: number;
      }> = [];

      // ── LAYER 1: Instant local landmark & comprehensive database match (0ms, no network) ──
      const qLower = cleanQ.toLowerCase();
      const qTokens = qLower.split(/\s+/).filter(Boolean);

      // A. Search Comprehensive Places Database (2000+ points across all hubs)
      for (const p of SUNDARBAN_COMPREHENSIVE_PLACES) {
        const nameLower = p.name.toLowerCase();
        const matchesDirect = nameLower.includes(qLower);
        const matchesAllTokens = qTokens.length > 1 && qTokens.every((token) => 
          nameLower.includes(token) || p.aliases.some((a) => a.toLowerCase().includes(token))
        );
        const matchesAlias = p.aliases?.some(
          (a) => a.toLowerCase().includes(qLower) || qLower.includes(a.toLowerCase())
        );

        if (matchesDirect || matchesAllTokens || matchesAlias) {
          const subInfo = p.subLocality ? `${p.subLocality}, ` : "";
          const catInfo = p.categoryLabelBn ? ` (${p.categoryLabelBn})` : "";
          suggestions.push({
            name: p.name,
            full_address: `${p.name}${catInfo}, ${subInfo}দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ`,
            lat: p.lat,
            lng: p.lng,
            source: "local_landmark",
            isInServiceArea: true,
            distanceDeg: Math.hypot(p.lat - biasLat, p.lng - biasLng),
          });
        }
      }

      // B. Search SUNDARBAN_LANDMARKS
      for (const lm of SUNDARBAN_LANDMARKS) {
        const nameLower = lm.name.toLowerCase();
        const matchesDirect = nameLower.includes(qLower);
        const matchesAlias = lm.aliases?.some(
          (a) => a.toLowerCase().includes(qLower) || qLower.includes(a.toLowerCase())
        );
        if (matchesDirect || matchesAlias) {
          const isDup = suggestions.some(
            (s) => Math.abs(s.lat - lm.lat) < 0.0005 && Math.abs(s.lng - lm.lng) < 0.0005
          );
          if (!isDup) {
            suggestions.push({
              name: lm.name,
              full_address: `${lm.name}, দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ`,
              lat: lm.lat,
              lng: lm.lng,
              source: "local_landmark",
              isInServiceArea: true,
              distanceDeg: Math.hypot(lm.lat - biasLat, lm.lng - biasLng),
            });
          }
        }
      }

      // ── LAYER 2-4: Parallel remote providers ─────────────────────────────
      const tasks: Promise<void>[] = [];

      // ── Provider A: OpenStreetMap Overpass API (PRIMARY — finds EVERY mapped place) ──
      // This returns bus stops, ghats, schools, hospitals, shops, restaurants,
      // hotels, bridges, auto stands, temples, beaches — literally everything in OSM
      tasks.push(
        (async () => {
          try {
            const overpassQuery = buildOverpassQuery(cleanQ, biasLat, biasLng);
            const ovRes = await fetch(OVERPASS_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "SundarbanRiders/2.0 (contact@sundarbanriders.com)",
              },
              body: `data=${encodeURIComponent(overpassQuery)}`,
              signal: AbortSignal.timeout(8000),
            });
            if (ovRes.ok) {
              const ovData = await ovRes.json();
              const parsed = parseOverpassElements(ovData.elements || [], biasLat, biasLng);
              for (const place of parsed) {
                const isDup = suggestions.some(
                  (s) =>
                    s.name.toLowerCase() === place.name.toLowerCase() ||
                    (Math.abs(s.lat - place.lat) < 0.001 && Math.abs(s.lng - place.lng) < 0.001)
                );
                if (!isDup) suggestions.push(place);
              }
            }
          } catch (err) {
            // Overpass timeout or error — other providers cover it
          }
        })()
      );

      // ── Provider B: Photon Geocoder (Komoot) — fast, location-biased ──────
      tasks.push(
        (async () => {
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQ)}&lat=${biasLat}&lon=${biasLng}&lang=en&limit=15&bbox=${REGION.west},${REGION.south},${REGION.east},${REGION.north}`;
            const pRes = await fetch(photonUrl, { signal: AbortSignal.timeout(3000) });
            if (pRes.ok) {
              const pData = await pRes.json();
              (pData.features || []).forEach((f: any) => {
                const props = f.properties || {};
                const placeName = props.name || props.street || props.city || cleanQ;
                const fullAddr = [
                  props.name,
                  props.street,
                  props.district || props.county,
                  props.city,
                  props.state,
                  props.postcode,
                  props.country || "India",
                ].filter(Boolean).join(", ");

                const pLat = f.geometry?.coordinates?.[1];
                const pLng = f.geometry?.coordinates?.[0];
                if (!pLat || !pLng) return;

                // Only include results within our region bounding box
                if (pLat < REGION.south || pLat > REGION.north || pLng < REGION.west || pLng > REGION.east) return;

                const isDup = suggestions.some(
                  (s) =>
                    s.name.toLowerCase() === placeName.toLowerCase() ||
                    (Math.abs(s.lat - pLat) < 0.001 && Math.abs(s.lng - pLng) < 0.001)
                );
                if (!isDup) {
                  suggestions.push({
                    name: placeName,
                    full_address: fullAddr,
                    lat: pLat,
                    lng: pLng,
                    source: "photon",
                    isInServiceArea: true,
                  });
                }
              });
            }
          } catch {}
        })()
      );

      // ── Provider C: OSM Nominatim with South 24 Parganas viewbox ──────────
      tasks.push(
        (async () => {
          try {
            // Try with region context appended for better local results
            const queries = [
              `${cleanQ}, South 24 Parganas, West Bengal`,
              `${cleanQ}, দক্ষিণ ২৪ পরগনা`,
              cleanQ,
            ];
            for (const q of queries) {
              const viewbox = `${REGION.west},${REGION.north},${REGION.east},${REGION.south}`;
              const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=12&viewbox=${viewbox}&bounded=0&countrycodes=in`;
              const nRes = await fetch(nUrl, {
                headers: {
                  "User-Agent": "SundarbanRiders/2.0 (contact@sundarbanriders.com)",
                  "Accept-Language": "bn,en",
                },
                signal: AbortSignal.timeout(4000),
              });
              if (nRes.ok) {
                const nData = await nRes.json();
                if (Array.isArray(nData) && nData.length > 0) {
                  nData.forEach((item: any) => {
                    const addr = item.address || {};
                    const mainName =
                      item.name ||
                      addr.amenity ||
                      addr.tourism ||
                      addr.railway ||
                      addr.shop ||
                      addr.road ||
                      addr.village ||
                      addr.town ||
                      addr.city ||
                      item.display_name.split(",")[0];

                    const addrParts = [
                      mainName,
                      addr.suburb || addr.neighbourhood || addr.village,
                      addr.city || addr.town || addr.county || addr.state_district,
                      addr.state,
                      addr.postcode,
                    ].filter(Boolean);

                    const fullAddress = addrParts.length > 2 ? addrParts.join(", ") : item.display_name;
                    const itemLat = parseFloat(item.lat);
                    const itemLng = parseFloat(item.lon);

                    if (itemLat < REGION.south - 0.5 || itemLat > REGION.north + 0.5 ||
                        itemLng < REGION.west - 0.5 || itemLng > REGION.east + 0.5) return;

                    const isDup = suggestions.some(
                      (s) =>
                        s.name.toLowerCase() === mainName.toLowerCase() ||
                        (Math.abs(s.lat - itemLat) < 0.001 && Math.abs(s.lng - itemLng) < 0.001)
                    );
                    if (!isDup) {
                      suggestions.push({
                        name: mainName,
                        full_address: fullAddress,
                        lat: itemLat,
                        lng: itemLng,
                        source: "osm_nominatim",
                        isInServiceArea: true,
                      });
                    }
                  });
                  break; // Stop at first query that yields results
                }
              }
            }
          } catch {}
        })()
      );

      // ── Provider D: Google Maps (if API key is configured) ─────────────────
      const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        tasks.push(
          (async () => {
            try {
              const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
                cleanQ + " South 24 Parganas West Bengal India"
              )}&key=${googleKey}&location=${biasLat},${biasLng}&radius=100000`;
              const gRes = await fetch(url, { signal: AbortSignal.timeout(3000) });
              const gData = await gRes.json();
              if (gData.status === "OK" && gData.results?.length) {
                gData.results.slice(0, 8).forEach((r: any) => {
                  const placeName = r.name || r.formatted_address.split(",")[0];
                  const gLat = r.geometry?.location?.lat;
                  const gLng = r.geometry?.location?.lng;
                  if (!gLat || !gLng) return;
                  if (!suggestions.some((s) => s.name.toLowerCase() === placeName.toLowerCase())) {
                    suggestions.push({
                      name: placeName,
                      full_address: r.formatted_address || placeName,
                      lat: gLat,
                      lng: gLng,
                      source: "google_places",
                      isInServiceArea: true,
                    });
                  }
                });
              }
            } catch {}
          })()
        );
      }

      // Await all providers in parallel
      await Promise.allSettled(tasks);

      // Deduplicate by name similarity and very close coordinates
      const deduped: typeof suggestions = [];
      for (const s of suggestions) {
        const isNewPlace = !deduped.some(
          (d) =>
            d.name.toLowerCase() === s.name.toLowerCase() ||
            (Math.abs(d.lat - s.lat) < 0.0008 && Math.abs(d.lng - s.lng) < 0.0008)
        );
        if (isNewPlace) deduped.push(s);
      }

      // Sort by proximity to user's current GPS bias point
      deduped.sort((a, b) => {
        const distA = Math.hypot(a.lat - biasLat, a.lng - biasLng);
        const distB = Math.hypot(b.lat - biasLat, b.lng - biasLng);
        // Local landmarks always float to top
        if (a.source === "local_landmark" && b.source !== "local_landmark") return -1;
        if (b.source === "local_landmark" && a.source !== "local_landmark") return 1;
        return distA - distB;
      });

      const finalSuggestions = deduped.slice(0, 20);

      const responsePayload = {
        name: finalSuggestions[0]?.name || cleanQ,
        full_address: finalSuggestions[0]?.full_address || cleanQ,
        lat: finalSuggestions[0]?.lat || 0,
        lng: finalSuggestions[0]?.lng || 0,
        source: finalSuggestions[0]?.source || "search",
        suggestions: finalSuggestions,
      };

      // Cache for 5 minutes
      geocodeCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
      if (geocodeCache.size > 300) {
        const oldestKey = geocodeCache.keys().next().value;
        if (oldestKey) geocodeCache.delete(oldestKey);
      }

      return NextResponse.json(responsePayload);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: REVERSE GEOCODING (lat/lng → address name)
    // ─────────────────────────────────────────────────────────────────────────
    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing lat/lng or query" }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const isInTerritory = isLocationInServiceArea(latitude, longitude);

    // Check if it matches any comprehensive local landmark (nearest within 0.75 km)
    let closestName = "";
    let closestAddr = "";
    let closestDist = 0.75; // km threshold

    for (const p of SUNDARBAN_COMPREHENSIVE_PLACES) {
      const d = calculateDistanceKm(latitude, longitude, p.lat, p.lng);
      if (d < closestDist) {
        closestDist = d;
        const cat = p.categoryLabelBn ? ` (${p.categoryLabelBn})` : "";
        const sub = p.subLocality ? `${p.subLocality}, ` : "";
        closestName = p.name;
        closestAddr = `${p.name}${cat}, ${sub}দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ`;
      }
    }

    for (const lm of SUNDARBAN_LANDMARKS) {
      const d = calculateDistanceKm(latitude, longitude, lm.lat, lm.lng);
      if (d < closestDist) {
        closestDist = d;
        closestName = lm.name;
        closestAddr = `${lm.name}, দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ`;
      }
    }

    if (closestName) {
      return NextResponse.json({
        name: closestName,
        full_address: closestAddr,
        lat: latitude,
        lng: longitude,
        isInServiceArea: isInTerritory,
        source: "local_landmark",
      });
    }

    // OSM Nominatim reverse geocode
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "SundarbanRiders/2.0 (contact@sundarbanriders.com)",
            "Accept-Language": "en",
          },
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const parts = [
          addr.amenity || addr.road || addr.suburb || addr.neighbourhood || addr.village || addr.hamlet,
          addr.town || addr.city || addr.city_district || addr.county || addr.state_district,
        ].filter(Boolean);

        const displayName =
          parts.length > 0
            ? parts.join(", ")
            : data.display_name?.split(",").slice(0, 2).join(",") || "";

        if (displayName && displayName.trim().length > 0) {
          return NextResponse.json({
            name: displayName.trim(),
            full_address: data.display_name,
            lat: latitude,
            lng: longitude,
            isInServiceArea: isInTerritory,
          });
        }
      }
    } catch {}

    // BigDataCloud fallback
    try {
      const bRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { cache: "no-store" }
      );
      if (bRes.ok) {
        const bData = await bRes.json();
        const cityLocality = bData.locality || bData.city || bData.principalSubdivision;
        if (cityLocality) {
          return NextResponse.json({
            name: cityLocality,
            full_address: [bData.locality, bData.city, bData.principalSubdivision, bData.countryName]
              .filter(Boolean).join(", "),
            lat: latitude,
            lng: longitude,
            source: "bigdatacloud",
            isInServiceArea: isInTerritory,
          });
        }
      }
    } catch {}

    return NextResponse.json({
      name: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      full_address: `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      lat: latitude,
      lng: longitude,
      isInServiceArea: isInTerritory,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      name: "Live GPS Location",
      error: (err as Error).message,
    });
  }
}
