import { NextResponse } from "next/server";
import { SUNDARBAN_LANDMARKS, calculateDistanceKm } from "@/lib/whatsapp/toto-engine";
import {
  isLocationInServiceArea,
  DEFAULT_CENTRAL_HUB,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/pricing/service-area";

const geocodeCache = new Map<string, { timestamp: number; data: any }>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const query = searchParams.get("q") || searchParams.get("query");
    const isIpRequest = searchParams.get("ip") === "true";

    // -------------------------------------------------------------
    // CASE 0: REAL IP-BASED GEOLOCATION (When Browser GPS Fails/Unavailable)
    // -------------------------------------------------------------
    if (isIpRequest) {
      try {
        const ipRes = await fetch("https://ipwho.is/", {
          headers: { "User-Agent": "SundarbanRiders/1.0" },
          cache: "no-store",
        });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          const ipLat = Number(ipData?.latitude);
          const ipLng = Number(ipData?.longitude);
          // STRICT SERVICE AREA VALIDATION: Never accept foreign (e.g. Washington/USA) or out-of-service IPs
          if (ipData.success && ipLat && ipLng && isLocationInServiceArea(ipLat, ipLng)) {
            const cityName = ipData.city || ipData.region || "আপনার বর্তমান অবস্থান";
            const fullAddr = [ipData.city, ipData.region, ipData.postal, ipData.country]
              .filter(Boolean)
              .join(", ");
            return NextResponse.json({
              name: cityName,
              full_address: fullAddr || cityName,
              lat: ipLat,
              lng: ipLng,
              source: "ip_geolocation",
              isInServiceArea: true,
              ip: ipData.ip,
            });
          }
        }
      } catch (ipErr) {
        console.warn("[geocode] ipwho.is failed, trying ipapi:", ipErr);
      }

      // Secondary IP fallback
      try {
        const ipapiRes = await fetch("https://ipapi.co/json/", {
          headers: { "User-Agent": "SundarbanRiders/1.0" },
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
      } catch (err2) {
        console.warn("[geocode] All IP geolocations failed:", err2);
      }

      // If IP was outside service area or failed, return error instead of fake hub
      return NextResponse.json(
        { error: "IP location unavailable or outside service territory" },
        { status: 404 }
      );
    }

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // CASE 1: FORWARD SEARCH (Live Real Places Suggestions from Map)
    // -------------------------------------------------------------
    if (query !== null) {
      const cleanQ = (query || "").trim();
      const biasLat = parseFloat(lat || "21.876");
      const biasLng = parseFloat(lng || "88.192");
      const cacheKey = `${cleanQ.toLowerCase()}_${biasLat.toFixed(2)}_${biasLng.toFixed(2)}`;

      // Check In-Memory Cache (Instant 1ms response for repeated/similar queries)
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
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
      }> = [];

      // 1. Instant 0ms Match: Local Landmarks & Regional Hubs
      const qLower = cleanQ.toLowerCase();
      for (const lm of SUNDARBAN_LANDMARKS) {
        const matchesName = lm.name.toLowerCase().includes(qLower);
        const matchesAlias = lm.aliases?.some((a) => a.toLowerCase().includes(qLower) || qLower.includes(a.toLowerCase()));
        if (matchesName || matchesAlias) {
          suggestions.push({
            name: lm.name,
            full_address: `${lm.name}, দক্ষিণ ২৪ পরগনা, পশ্চিমবঙ্গ`,
            lat: lm.lat,
            lng: lm.lng,
            source: "local_landmark",
            isInServiceArea: true,
          });
        }
      }

      // 2. Parallel Remote Providers (Photon + Google Maps + OSM with tight timeouts)
      const tasks: Promise<void>[] = [];

      // Provider A: Fast Photon Geocoder with Location Biasing (Uber/Rapido style local proximity)
      tasks.push(
        (async () => {
          try {
            const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
              cleanQ
            )}&lat=${biasLat}&lon=${biasLng}&lang=en&limit=10`;
            const pRes = await fetch(photonUrl, { signal: AbortSignal.timeout(1800) });
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
                ]
                  .filter(Boolean)
                  .join(", ");

                const pLat = f.geometry?.coordinates?.[1];
                const pLng = f.geometry?.coordinates?.[0];
                if (!pLat || !pLng) return;

                const isDup = suggestions.some(
                  (s) =>
                    s.name.toLowerCase() === placeName.toLowerCase() ||
                    (Math.abs(s.lat - pLat) < 0.0015 && Math.abs(s.lng - pLng) < 0.0015)
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

      // Provider B: Google Maps Geocoding if API key configured
      const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        tasks.push(
          (async () => {
            try {
              const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                cleanQ + ", West Bengal, India"
              )}&key=${googleKey}`;
              const gRes = await fetch(url, { signal: AbortSignal.timeout(2000) });
              const gData = await gRes.json();
              if (gData.status === "OK" && gData.results?.length) {
                gData.results.slice(0, 6).forEach((r: any) => {
                  const placeName = r.formatted_address.split(",")[0];
                  if (!suggestions.some((s) => s.name.toLowerCase() === placeName.toLowerCase())) {
                    suggestions.push({
                      name: placeName,
                      full_address: r.formatted_address,
                      lat: r.geometry.location.lat,
                      lng: r.geometry.location.lng,
                      source: "google_maps",
                      isInServiceArea: true,
                    });
                  }
                });
              }
            } catch {}
          })()
        );
      }

      // Provider C: OpenStreetMap Nominatim with strict timeout (1500ms max)
      tasks.push(
        (async () => {
          try {
            const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              cleanQ
            )}&format=json&addressdetails=1&countrycodes=in&limit=8`;
            const nRes = await fetch(nUrl, {
              headers: {
                "User-Agent": "SundarbanRiders/2.0 (contact@sundarbanriders.com)",
                "Accept-Language": "en,bn",
              },
              signal: AbortSignal.timeout(1600),
            });
            if (nRes.ok) {
              const nData = await nRes.json();
              if (Array.isArray(nData)) {
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

                  const isDup = suggestions.some(
                    (s) =>
                      s.name.toLowerCase() === mainName.toLowerCase() ||
                      (Math.abs(s.lat - itemLat) < 0.0015 && Math.abs(s.lng - itemLng) < 0.0015)
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
              }
            }
          } catch {}
        })()
      );

      // Await all parallel sources
      await Promise.allSettled(tasks);

      // Sort by proximity to bias coordinate if available
      suggestions.sort((a, b) => {
        const distA = Math.hypot(a.lat - biasLat, a.lng - biasLng);
        const distB = Math.hypot(b.lat - biasLat, b.lng - biasLng);
        return distA - distB;
      });

      const responsePayload = {
        name: suggestions[0]?.name || cleanQ,
        full_address: suggestions[0]?.full_address || cleanQ,
        lat: suggestions[0]?.lat || 0,
        lng: suggestions[0]?.lng || 0,
        source: suggestions[0]?.source || "search",
        suggestions: suggestions.slice(0, 12),
      };

      // Save to memory cache
      geocodeCache.set(cacheKey, { timestamp: Date.now(), data: responsePayload });
      if (geocodeCache.size > 200) {
        const oldestKey = geocodeCache.keys().next().value;
        if (oldestKey) geocodeCache.delete(oldestKey);
      }

      return NextResponse.json(responsePayload);
    }

    // -------------------------------------------------------------
    // CASE 2: REVERSE GEOCODING (Latitude & Longitude Coordinates)
    // -------------------------------------------------------------
    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing lat/lng or query" }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const isInTerritory = isLocationInServiceArea(latitude, longitude);

    // 1. First attempt OpenStreetMap Nominatim reverse geocode in English
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
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

    // 2. Secondary Reverse Geocode (BigDataCloud client geocode in English)
    try {
      const bRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        { cache: "no-store" }
      );
      if (bRes.ok) {
        const bData = await bRes.json();
        const cityLocality = bData.locality || bData.city || bData.principalSubdivision;
        if (cityLocality) {
          const fullAddr = [bData.locality, bData.city, bData.principalSubdivision, bData.countryName]
            .filter(Boolean)
            .join(", ");
          return NextResponse.json({
            name: cityLocality,
            full_address: fullAddr,
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
