import { NextResponse } from "next/server";
import { SUNDARBAN_LANDMARKS, calculateDistanceKm } from "@/lib/whatsapp/toto-engine";
import {
  isLocationInServiceArea,
  DEFAULT_CENTRAL_HUB,
  SERVICE_UNAVAILABLE_MESSAGE,
} from "@/lib/pricing/service-area";

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

      // If IP was outside service area (like Vercel cloud datacenter in Washington) or failed,
      // return Central South 24 Parganas Hub: Kakdwip Station Road
      return NextResponse.json({
        name: DEFAULT_CENTRAL_HUB.name,
        full_address: DEFAULT_CENTRAL_HUB.full_address,
        lat: DEFAULT_CENTRAL_HUB.lat,
        lng: DEFAULT_CENTRAL_HUB.lng,
        source: "default_hub",
        isInServiceArea: true,
        note: "service_territory_default",
      });
    }

    // -------------------------------------------------------------
    // CASE 1: FORWARD SEARCH (Live Real Places Suggestions from Map)
    // -------------------------------------------------------------
    if (query !== null) {
      const cleanQ = (query || "").trim();
      const suggestions: Array<{
        name: string;
        full_address: string;
        lat: number;
        lng: number;
        source?: string;
      }> = [];

      // If empty query or single character, return empty suggestions list (no hardcoded defaults)
      if (!cleanQ || cleanQ.length < 2) {
        return NextResponse.json({
          suggestions: [],
        });
      }

      // 1. Query Google Maps Geocoding if API key is present
      const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            cleanQ + ", West Bengal, India"
          )}&key=${googleKey}`;
          const gRes = await fetch(url);
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
                });
              }
            });
          }
        } catch (err) {
          console.warn("[geocode] Google Maps error:", err);
        }
      }

      // 2. Query OpenStreetMap Nominatim with English headers (Real, Live Google Maps-style addresses)
      try {
        const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          cleanQ
        )}&format=json&addressdetails=1&countrycodes=in&limit=10`;
        const nRes = await fetch(nUrl, {
          headers: {
            "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
            "Accept-Language": "en",
          },
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

              const isDuplicate = suggestions.some(
                (s) =>
                  s.name.toLowerCase() === mainName.toLowerCase() ||
                  (Math.abs(s.lat - parseFloat(item.lat)) < 0.001 &&
                    Math.abs(s.lng - parseFloat(item.lon)) < 0.001)
              );

              if (!isDuplicate) {
                suggestions.push({
                  name: mainName,
                  full_address: fullAddress,
                  lat: parseFloat(item.lat),
                  lng: parseFloat(item.lon),
                  source: "osm_nominatim",
                });
              }
            });
          }
        }
      } catch (nErr) {
        console.warn("[geocode] Nominatim search error:", nErr);
      }

      // 3. Query Photon Geocoder (Fast Live Map Data in English)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          cleanQ
        )}&lang=en&limit=10`;
        const pRes = await fetch(photonUrl);
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

            const isDuplicate = suggestions.some(
              (s) =>
                s.name.toLowerCase() === placeName.toLowerCase() ||
                (Math.abs(s.lat - f.geometry.coordinates[1]) < 0.001 &&
                  Math.abs(s.lng - f.geometry.coordinates[0]) < 0.001)
            );

            if (!isDuplicate) {
              suggestions.push({
                name: placeName,
                full_address: fullAddr,
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                source: "photon",
              });
            }
          });
        }
      } catch (pErr) {
        console.warn("[geocode] Photon search error:", pErr);
      }

      // Tag each suggestion with isInServiceArea
      const taggedSuggestions = suggestions.map((s) => ({
        ...s,
        isInServiceArea: isLocationInServiceArea(s.lat, s.lng),
      }));

      // Sort: local service territory suggestions come first
      taggedSuggestions.sort((a, b) => {
        if (a.isInServiceArea && !b.isInServiceArea) return -1;
        if (!a.isInServiceArea && b.isInServiceArea) return 1;
        return 0;
      });

      return NextResponse.json({
        name: taggedSuggestions[0]?.name || cleanQ,
        full_address: taggedSuggestions[0]?.full_address || cleanQ,
        lat: taggedSuggestions[0]?.lat || 0,
        lng: taggedSuggestions[0]?.lng || 0,
        isInServiceArea: taggedSuggestions[0] ? taggedSuggestions[0].isInServiceArea : false,
        suggestions: taggedSuggestions.slice(0, 8),
      });
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
