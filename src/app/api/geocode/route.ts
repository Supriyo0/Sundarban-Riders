import { NextResponse } from "next/server";
import { SUNDARBAN_COMPREHENSIVE_PLACES, SundarbanPlace } from "@/lib/data/sundarban-places";
import { isLocationInServiceArea, checkRiverBarrierCrossings } from "@/lib/pricing/service-area";

const geocodeCache = new Map<string, { timestamp: number; data: any }>();

// South 24 Parganas Toto Corridor Bounding Box (Diamond Harbour down to Bakkhali & Sagar Island)
const SOUTH_24_PARGANAS_BBOX = {
  minLat: 21.45, // Bay of Bengal & Bakkhali Coast
  maxLat: 22.25, // Diamond Harbour / Lakshmikantapur / Kulpi (Strictly excludes Sealdah, Howrah, Kolkata, Budge Budge)
  minLng: 88.00, // Hooghly River & Sagar Island
  maxLng: 88.60, // Patharpratima & Raidighi Eastern Corridor
};

const REGIONAL_TOWN_ANCHORS: Array<{ keywords: string[]; name: string; lat: number; lng: number }> = [
  { keywords: ["bakkhali", "bakkhli", "bakkahli", "amarabati", "deepak", "sonar bangla"], name: "Bakkhali", lat: 21.5642, lng: 88.2541 },
  { keywords: ["fraserganj", "frazerganj", "frezerganj", "windmill", "fishing harbour"], name: "Fraserganj", lat: 21.5895, lng: 88.2486 },
  { keywords: ["henry island", "henrys island", "mangrove"], name: "Henry Island", lat: 21.5768, lng: 88.2935 },
  { keywords: ["namkhana", "hatania", "dwariknagar", "narayanpur", "shibpur"], name: "Namkhana", lat: 21.7645, lng: 88.2325 },
  { keywords: ["kakdwip", "kakdip", "birendra", "sundarban mahavidyalaya", "gyanada"], name: "Kakdwip", lat: 21.8765, lng: 88.1920 },
  { keywords: ["lot 8", "lot-8", "harwood"], name: "Lot 8 Ferry Ghat", lat: 21.8680, lng: 88.1630 },
  { keywords: ["gangasagar", "sagar island", "kachuberia", "kapil muni", "chemaguri", "rudranagar", "sagar"], name: "Gangasagar", lat: 21.6500, lng: 88.0800 },
  { keywords: ["mousuni", "mousuni island", "baliara", "bagdanga"], name: "Mousuni Island", lat: 21.5800, lng: 88.2200 },
  { keywords: ["patharpratima", "pathar pratima", "ramganga", "digambarpur", "gobardhanpur"], name: "Patharpratima", lat: 21.7900, lng: 88.3500 },
  { keywords: ["kulpi", "karanjali", "nischindapur"], name: "Kulpi", lat: 22.0820, lng: 88.2420 },
  { keywords: ["lakshmikantapur", "lakshikantapur", "mathurapur", "mandirbazar"], name: "Lakshmikantapur", lat: 22.0120, lng: 88.3180 },
  { keywords: ["diamond harbour", "diamond harbor", "sarisha", "punyalakshmi", "sagarika"], name: "Diamond Harbour", lat: 22.1890, lng: 88.2010 },
];

function isInsideSouth24Parganas(lat: number, lng: number): boolean {
  return (
    lat >= SOUTH_24_PARGANAS_BBOX.minLat &&
    lat <= SOUTH_24_PARGANAS_BBOX.maxLat &&
    lng >= SOUTH_24_PARGANAS_BBOX.minLng &&
    lng <= SOUTH_24_PARGANAS_BBOX.maxLng
  );
}

function isInsideWestBengal(lat: number, lng: number): boolean {
  return lat >= 21.40 && lat <= 27.25 && lng >= 85.80 && lng <= 89.90;
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

      // Fast in-memory cache hit (only for non-empty suggestions)
      const cached = geocodeCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.timestamp < 5 * 60 * 1000 &&
        cached.data?.suggestions?.length > 0
      ) {
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

        // Check category matching (e.g. searching "hotel", "school", "restaurant", "hospital", "beach")
        const isCatMatch =
          ((qNorm.includes("hotel") || qNorm.includes("resort") || qNorm.includes("lodge")) && p.category === "hotel") ||
          ((qNorm.includes("school") || qNorm.includes("college") || qNorm.includes("vidya")) && p.category === "school_college") ||
          ((qNorm.includes("restaurant") || qNorm.includes("food") || qNorm.includes("cafe")) && p.category === "restaurant") ||
          ((qNorm.includes("hospital") || qNorm.includes("health") || qNorm.includes("swasthya") || qNorm.includes("clinic")) && p.category === "hospital") ||
          ((qNorm.includes("beach") || qNorm.includes("sea")) && p.category === "beach") ||
          ((qNorm.includes("station") || qNorm.includes("rail")) && p.category === "station") ||
          ((qNorm.includes("stand") || qNorm.includes("bus") || qNorm.includes("toto")) && (p.category === "bus_stand" || p.category === "toto_stand")) ||
          ((qNorm.includes("ghat") || qNorm.includes("ferry") || qNorm.includes("jetty")) && p.category === "ferry_ghat") ||
          ((qNorm.includes("market") || qNorm.includes("bazar")) && p.category === "market");

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
        } else if (p.aliases?.some((a) => normalize(a).includes(qNorm))) {
          score = 75;
        } else if (isCatMatch) {
          score = 70;
        }

        if (score > 0 && isInsideSouth24Parganas(p.lat, p.lng)) {
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

      // Adaptive timeout: Keep live query snappy
      const hasSufficientLocal = suggestions.length >= 8;
      const liveTimeoutMs = hasSufficientLocal ? 1800 : 4500;

      // ── STEP B: Parallel Live Search across South 24 Parganas (Google Autocomplete & Mapbox Places) ──
      const osmTasks: Promise<void>[] = [];

      // 0. Mapbox Places Search Strictly Inside South 24 Parganas Corridor (100,000 requests/month free)
      const mapboxToken =
        process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (mapboxToken) {
        osmTasks.push(
          (async () => {
            try {
              const mbUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                cleanQ
              )}.json?access_token=${mapboxToken}&country=IN&bbox=88.00,21.45,88.60,22.25&proximity=${biasLng},${biasLat}&limit=12&types=poi,address,neighborhood,locality,place`;
              const mbRes = await fetch(mbUrl, {
                signal: AbortSignal.timeout(2500),
              });
              if (mbRes.ok) {
                const mbData = await mbRes.json();
                (mbData.features || []).forEach((f: any) => {
                  const coords = f.center || f.geometry?.coordinates;
                  if (!coords || coords.length < 2) return;
                  const fLng = coords[0];
                  const fLat = coords[1];
                  if (!isInsideSouth24Parganas(fLat, fLng)) return;

                  const placeName = f.text || f.place_name?.split(",")[0] || cleanQ;
                  const fullAddress = f.place_name || `${placeName}, South 24 Parganas`;
                  const placeTypes = f.place_type || [];
                  let catLabel = "Place";
                  let catBadge = "📍";
                  if (placeTypes.includes("poi")) {
                    catLabel = "Landmark";
                    catBadge = "⭐";
                  } else if (placeTypes.includes("address")) {
                    catLabel = "Street Address";
                    catBadge = "🏠";
                  } else if (placeTypes.includes("locality") || placeTypes.includes("place")) {
                    catLabel = "Town / Hub";
                    catBadge = "🏙️";
                  }

                  const isDup = suggestions.some(
                    (s) =>
                      normalize(s.name) === normalize(placeName) ||
                      (Math.abs(s.lat - fLat) < 0.0008 && Math.abs(s.lng - fLng) < 0.0008)
                  );

                  if (!isDup) {
                    const distDeg = Math.hypot(fLat - biasLat, fLng - biasLng);
                    suggestions.push({
                      name: placeName,
                      full_address: fullAddress,
                      lat: fLat,
                      lng: fLng,
                      category: catLabel,
                      categoryBadge: catBadge,
                      source: "mapbox_places",
                      isInServiceArea: true,
                      distanceDeg: distDeg,
                      score: 95 - distDeg * 2.5,
                    });
                  }
                });
              }
            } catch {}
          })()
        );
      }

      // 1. PRIMARY: Built-in Live Google Autocomplete (NO Sign-Up, NO API Key, 100% Free Forever)
      let googleCompletions: string[] = [];
      osmTasks.push(
        (async () => {
          try {
            const lowerQ = cleanQ.toLowerCase();
            const isCategory =
              lowerQ.includes("school") ||
              lowerQ.includes("hotel") ||
              lowerQ.includes("restaurant") ||
              lowerQ.includes("resturant") ||
              lowerQ.includes("resort") ||
              lowerQ.includes("lodge") ||
              lowerQ.includes("hospital") ||
              lowerQ.includes("bazar") ||
              lowerQ.includes("market") ||
              lowerQ.includes("college") ||
              lowerQ.includes("vidya") ||
              lowerQ.includes("beach") ||
              lowerQ.length <= 4;

            // For categories, query focused South 24 Parganas hubs directly
            const googleQueries = isCategory
              ? [
                  `${cleanQ} kakdwip`,
                  `${cleanQ} bakkhali`,
                  `${cleanQ} diamond harbour`,
                  `${cleanQ} namkhana`,
                  `${cleanQ} sagar island`,
                  `${cleanQ} south 24 parganas`,
                ]
              : [cleanQ, `${cleanQ} south 24 parganas`];

            const gFetchTasks = googleQueries.map(async (queryStr) => {
              try {
                const gRes = await fetch(
                  `https://suggestqueries.google.com/complete/search?client=chrome&gl=in&hl=en&q=${encodeURIComponent(
                    queryStr
                  )}`,
                  {
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    },
                    signal: AbortSignal.timeout(2400),
                  }
                );
                if (gRes.ok) {
                  const gData = await gRes.json();
                  return Array.isArray(gData[1]) ? gData[1] : [];
                }
              } catch {}
              return [];
            });

            const allGResults = await Promise.all(gFetchTasks);
            const rawQueries = Array.from(new Set(allGResults.flat()));

            const junkRegex = /\b(train time|time table|today|weather|pin code|distance|ticket|status|chart|meaning|bag|shoes|friends|runaway|game|movie|song|video|holiday|leave application|leave|uniform|image|images|generator|ideas|recipe|curry|masala|fees|vacancy|style|dress|name list|name generator|in hindi|in bengali|in english|jaipur|lucknow|noida|delhi|mumbai|pune|bangalore|hyderabad|chennai|dlf|gurgaon|chandigarh|kolkata|sealdah|howrah|digha|puri|mandarmani)\b/i;
            const stripTrailing = /\b(photos|reviews|review|contact number|phone number|phone|number|price|low price list|low price|booking|room booking|menu|online|menu card|timings|timing|time)\b/gi;
            const filtered = rawQueries
              .filter((item) => typeof item === "string")
              .map((item) => item.replace(stripTrailing, "").replace(/\s+/g, " ").trim())
              .filter((item) => item.length > 3 && !junkRegex.test(item) && item.toLowerCase() !== cleanQ.toLowerCase());

            googleCompletions = filtered.slice(0, 15);

            // Convert top Google search completions into clickable location suggestions
            for (const gQuery of filtered.slice(0, 15)) {
              const gNorm = normalize(gQuery);
              const localMatch = SUNDARBAN_COMPREHENSIVE_PLACES.find(
                (p) =>
                  normalize(p.name).includes(gNorm) ||
                  gNorm.includes(normalize(p.name)) ||
                  p.aliases?.some((a) => normalize(a).includes(gNorm) || gNorm.includes(normalize(a)))
              );

              if (localMatch) {
                const catInfo = getCategoryInfo(localMatch.category);
                const isDup = suggestions.some(
                  (s) => normalize(s.name) === normalize(localMatch.name)
                );
                if (!isDup && isInsideSouth24Parganas(localMatch.lat, localMatch.lng)) {
                  const distDeg = Math.hypot(localMatch.lat - biasLat, localMatch.lng - biasLng);
                  suggestions.push({
                    name: localMatch.name,
                    full_address: `${localMatch.name} (${catInfo.label}), ${localMatch.subLocality || "South 24 Parganas"}, West Bengal`,
                    lat: localMatch.lat,
                    lng: localMatch.lng,
                    category: catInfo.label,
                    categoryBadge: catInfo.badge,
                    source: "google_live_autocomplete",
                    isInServiceArea: true,
                    distanceDeg: distDeg,
                    score: 110 - distDeg * 2,
                  });
                }
              } else {
                // Fallback anchor resolution for Google search suggestions within South 24 Parganas
                const gLower = gQuery.toLowerCase();
                const matchedAnchor =
                  REGIONAL_TOWN_ANCHORS.find((a) =>
                    a.keywords.some((k) => gLower.includes(k) || cleanQ.toLowerCase().includes(k))
                  ) ||
                  (gLower.includes("south 24") || gLower.includes("sundarban") ? REGIONAL_TOWN_ANCHORS[1] : null);

                if (matchedAnchor) {
                  const isDup = suggestions.some(
                    (s) => normalize(s.name) === normalize(gQuery)
                  );
                  if (!isDup) {
                    let hash = 0;
                    for (let i = 0; i < gQuery.length; i++) {
                      hash = (hash << 5) - hash + gQuery.charCodeAt(i);
                      hash |= 0;
                    }
                    const offsetLat = ((Math.abs(hash) % 15) - 7) * 0.0003;
                    const offsetLng = ((Math.abs(hash >> 3) % 15) - 7) * 0.0003;
                    const pLat = matchedAnchor.lat + offsetLat;
                    const pLng = matchedAnchor.lng + offsetLng;

                    if (isInsideSouth24Parganas(pLat, pLng)) {
                      const distDeg = Math.hypot(pLat - biasLat, pLng - biasLng);
                      const formattedName = gQuery
                        .split(" ")
                        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ");

                      let catLabel = "Place";
                      let catBadge = "🔍";
                      if (gLower.includes("hotel") || gLower.includes("resort") || gLower.includes("lodge")) {
                        catLabel = "Hotel / Resort";
                        catBadge = "🏨";
                      } else if (gLower.includes("school") || gLower.includes("college") || gLower.includes("vidya")) {
                        catLabel = "School / College";
                        catBadge = "🏫";
                      } else if (gLower.includes("restaurant") || gLower.includes("food") || gLower.includes("cafe")) {
                        catLabel = "Restaurant";
                        catBadge = "🍽️";
                      } else if (gLower.includes("hospital") || gLower.includes("health") || gLower.includes("clinic")) {
                        catLabel = "Hospital";
                        catBadge = "🏥";
                      } else if (gLower.includes("beach")) {
                        catLabel = "Sea Beach";
                        catBadge = "🏖️";
                      } else if (gLower.includes("ghat") || gLower.includes("ferry")) {
                        catLabel = "Ferry Ghat";
                        catBadge = "⛴️";
                      }

                      suggestions.push({
                        name: formattedName,
                        full_address: `${formattedName}, ${matchedAnchor.name}, South 24 Parganas`,
                        lat: pLat,
                        lng: pLng,
                        category: catLabel,
                        categoryBadge: catBadge,
                        source: "google_live_autocomplete",
                        isInServiceArea: true,
                        distanceDeg: distDeg,
                        score: 105 - distDeg * 2,
                      });
                    }
                  }
                }
              }
            }
          } catch {}
        })()
      );

      // 2. Photon (Komoot ElasticSearch over full OpenStreetMap database - fast text lookup)
      osmTasks.push(
        (async () => {
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
              cleanQ
            )}&lat=${biasLat}&lon=${biasLng}&lang=en&limit=10`;
            const pRes = await fetch(photonUrl, {
              headers: { "User-Agent": "SundarbanRiders/2.0" },
              signal: AbortSignal.timeout(3000),
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
                if (!isInsideSouth24Parganas(pLat, pLng)) return;

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

      // 3. OSM Nominatim Search (Fast PostgreSQL Text Index without heavy GIS viewbox overhead)
      osmTasks.push(
        (async () => {
          // Prepare candidate queries in case of slight typo or compound word
          const queryCandidates = [cleanQ];
          const simplified = cleanQ
            .replace(/seabeach/gi, "beach")
            .replace(/sea beach/gi, "beach")
            .replace(/\bmore\b/gi, "")
            .trim();
          if (simplified && simplified !== cleanQ) queryCandidates.push(simplified);

          for (const cand of queryCandidates) {
            try {
              const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                cand
              )}&countrycodes=in&limit=8&accept-language=en`;
              const nRes = await fetch(nomUrl, {
                headers: { "User-Agent": "SundarbanRiders/2.0 (dispatch@sundarbanriders.com)" },
                signal: AbortSignal.timeout(3000),
              });
              if (nRes.ok) {
                const nData = await nRes.json();
                let addedAny = false;
                (nData || []).forEach((item: any) => {
                  const nLat = parseFloat(item.lat);
                  const nLng = parseFloat(item.lon);
                  if (isNaN(nLat) || isNaN(nLng) || !isInsideSouth24Parganas(nLat, nLng)) return;

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
                  break; // Sufficient high-quality matches found
                }
              }
            } catch {}
          }
        })()
      );

      // Wait in parallel up to liveTimeoutMs
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

      // Only cache valid non-empty responses for 5 minutes
      if (finalSuggestions.length > 0) {
        geocodeCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
        if (geocodeCache.size > 500) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }
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

    // 2. Mapbox High-Precision Reverse Geocoding (100,000 requests/month free forever)
    const mapboxToken =
      process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        const mbRevUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&country=IN&types=poi,address,neighborhood,locality&limit=1`;
        const mbRes = await fetch(mbRevUrl, { signal: AbortSignal.timeout(2200) });
        if (mbRes.ok) {
          const mbData = await mbRes.json();
          const first = mbData?.features?.[0];
          if (first && first.place_name) {
            const shortName = first.text || first.place_name.split(",")[0]?.trim();
            return NextResponse.json({
              name: shortName || first.place_name,
              full_address: first.place_name,
              lat: latitude,
              lng: longitude,
              isInServiceArea: isInTerritory,
              source: "mapbox_reverse",
            });
          }
        }
      } catch {}
    }

    // 3. OpenStreetMap Nominatim reverse geocode in clean English
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
