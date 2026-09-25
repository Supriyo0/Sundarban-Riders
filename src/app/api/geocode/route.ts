import { NextResponse } from "next/server";
import { SUNDARBAN_LANDMARKS, calculateDistanceKm } from "@/lib/whatsapp/toto-engine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const query = searchParams.get("q") || searchParams.get("query");

    // -------------------------------------------------------------
    // CASE 1: FORWARD SEARCH (Query String e.g. "কাকদ্বীপ", "লট ৮")
    // -------------------------------------------------------------
    if (query && query.trim()) {
      const cleanQ = query.trim().toLowerCase();

      // 1. Prioritize Curated Regional Hubs First
      const matchedLandmarks = SUNDARBAN_LANDMARKS.filter((lm) => {
        const nameMatch = lm.name.toLowerCase().includes(cleanQ);
        const aliasMatch = lm.aliases?.some((a) => cleanQ.includes(a.toLowerCase()) || a.toLowerCase().includes(cleanQ));
        return nameMatch || aliasMatch;
      });

      if (matchedLandmarks.length > 0) {
        const top = matchedLandmarks[0];
        return NextResponse.json({
          name: top.name,
          lat: top.lat,
          lng: top.lng,
          isHub: true,
          suggestions: matchedLandmarks.map((lm) => ({
            name: lm.name,
            lat: lm.lat,
            lng: lm.lng,
            isHub: true,
          })),
        });
      }

      // 2. Query Google Maps Geocoding API if key configured (with regional bounding box bias)
      const googleKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        try {
          // Bounding box for Kakdwip, Namkhana, Diamond Harbour, Lakshmikantapur corridor
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            query + ", South 24 Parganas, West Bengal, India"
          )}&bounds=21.5,88.10|22.3,88.50&key=${googleKey}`;
          const gRes = await fetch(url);
          const gData = await gRes.json();
          if (gData.status === "OK" && gData.results?.[0]?.geometry?.location) {
            const loc = gData.results[0].geometry.location;
            const formatted = gData.results[0].formatted_address || query;
            return NextResponse.json({
              name: formatted.split(",")[0] || query,
              full_address: formatted,
              lat: loc.lat,
              lng: loc.lng,
              suggestions: gData.results.slice(0, 5).map((r: any) => ({
                name: r.formatted_address.split(",")[0],
                full_address: r.formatted_address,
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
              })),
            });
          }
        } catch {}
      }

      // 3. Fallback: OpenStreetMap Nominatim with Regional Viewbox
      try {
        const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query + ", South 24 Parganas, West Bengal"
        )}&format=json&viewbox=88.1,22.3,88.5,21.5&bounded=0&limit=5`;
        const nRes = await fetch(nUrl, {
          headers: {
            "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
            "Accept-Language": "bn,en;q=0.8",
          },
        });
        const nData = await nRes.json();
        if (Array.isArray(nData) && nData.length > 0) {
          const top = nData[0];
          return NextResponse.json({
            name: top.display_name.split(",")[0] || query,
            full_address: top.display_name,
            lat: parseFloat(top.lat),
            lng: parseFloat(top.lon),
            suggestions: nData.map((item: any) => ({
              name: item.display_name.split(",")[0],
              full_address: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            })),
          });
        }
      } catch {}

      // If nothing matched, default to Kakdwip Station Road
      return NextResponse.json({
        name: query,
        lat: 21.8760,
        lng: 88.1920,
        suggestions: [],
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

    // 1. Check if coords are very close to one of our regional hubs (< 800m)
    for (const lm of SUNDARBAN_LANDMARKS) {
      const d = calculateDistanceKm(latitude, longitude, lm.lat, lm.lng);
      if (d < 0.8) {
        return NextResponse.json({
          name: lm.name,
          lat: latitude,
          lng: longitude,
          isHub: true,
        });
      }
    }

    // 2. OpenStreetMap Nominatim reverse geocode
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
          "Accept-Language": "bn,en;q=0.8",
        },
      }
    );

    if (!res.ok) {
      try {
        const bgRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=bn`
        );
        if (bgRes.ok) {
          const bgData = await bgRes.json();
          const place = [
            bgData.locality || bgData.localityInfo?.administrative?.[3]?.name,
            bgData.city || bgData.principalSubdivision
          ].filter(Boolean).join(", ");
          if (place) {
            return NextResponse.json({
              name: place,
              lat: latitude,
              lng: longitude,
            });
          }
        }
      } catch {}

      return NextResponse.json({
        name: `লোকেশন (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        lat: latitude,
        lng: longitude,
      });
    }

    const data = await res.json();
    const addr = data.address || {};

    const parts = [
      addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || addr.road,
      addr.town || addr.city_district || addr.county || addr.state_district,
    ].filter(Boolean);

    const displayName = parts.length > 0 ? parts.join(", ") : (data.display_name?.split(",").slice(0, 2).join(",") || "বর্তমান অবস্থান");

    return NextResponse.json({
      name: displayName.trim(),
      full_address: data.display_name,
      lat: latitude,
      lng: longitude,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      name: "লাইভ জিপিএস অবস্থান",
      error: (err as Error).message,
    });
  }
}
