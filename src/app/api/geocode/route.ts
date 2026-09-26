import { NextResponse } from "next/server";
import { SUNDARBAN_LANDMARKS, calculateDistanceKm } from "@/lib/whatsapp/toto-engine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const query = searchParams.get("q") || searchParams.get("query");

    // -------------------------------------------------------------
    // CASE 1: FORWARD SEARCH (Live Real Places Suggestions)
    // -------------------------------------------------------------
    if (query && query.trim()) {
      const cleanQ = query.trim().toLowerCase();
      const suggestions: Array<{
        name: string;
        full_address: string;
        lat: number;
        lng: number;
        isHub?: boolean;
      }> = [];

      // 1. Check matching local landmarks
      const matchedLandmarks = SUNDARBAN_LANDMARKS.filter((lm) => {
        const nameMatch = lm.name.toLowerCase().includes(cleanQ);
        const aliasMatch = lm.aliases?.some(
          (a) => cleanQ.includes(a.toLowerCase()) || a.toLowerCase().includes(cleanQ)
        );
        return nameMatch || aliasMatch;
      });

      matchedLandmarks.forEach((lm) => {
        suggestions.push({
          name: lm.name,
          full_address: `${lm.name}, সুন্দরবন অঞ্চল, দক্ষিণ ২৪ পরগনা`,
          lat: lm.lat,
          lng: lm.lng,
          isHub: true,
        });
      });

      // 2. Query Google Maps Geocoding if API key is present
      const googleKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            query + ", South 24 Parganas, West Bengal, India"
          )}&bounds=21.5,88.10|22.3,88.50&key=${googleKey}`;
          const gRes = await fetch(url);
          const gData = await gRes.json();
          if (gData.status === "OK" && gData.results?.length) {
            gData.results.slice(0, 5).forEach((r: any) => {
              suggestions.push({
                name: r.formatted_address.split(",")[0],
                full_address: r.formatted_address,
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
              });
            });
          }
        } catch (err) {
          console.warn("[geocode] Google Maps error:", err);
        }
      }

      // 3. Query Photon Geocoder (Fast, Live Real Map Data tailored to Bengal/Sundarbans)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query
        )}&lat=21.876&lon=88.192&bbox=87.5,21.3,89.2,22.8&limit=8`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          (pData.features || []).forEach((f: any) => {
            const props = f.properties || {};
            const placeName = props.name || props.street || props.city || query;
            const fullAddr = [
              props.name,
              props.street,
              props.district || props.county,
              props.state || "West Bengal",
            ]
              .filter(Boolean)
              .join(", ");

            // Avoid exact duplicates
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
              });
            }
          });
        }
      } catch (pErr) {
        console.warn("[geocode] Photon search error:", pErr);
      }

      // 4. Fallback to Nominatim if suggestions are still sparse (< 2)
      if (suggestions.length < 2) {
        try {
          const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query + ", West Bengal, India"
          )}&format=json&limit=5`;
          const nRes = await fetch(nUrl, {
            headers: {
              "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
              "Accept-Language": "bn,en;q=0.8",
            },
          });
          if (nRes.ok) {
            const nData = await nRes.json();
            if (Array.isArray(nData)) {
              nData.forEach((item: any) => {
                const pName = item.display_name.split(",")[0];
                if (!suggestions.some((s) => s.name === pName)) {
                  suggestions.push({
                    name: pName,
                    full_address: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                  });
                }
              });
            }
          }
        } catch {}
      }

      const top = suggestions[0] || {
        name: query,
        full_address: `${query}, কাকদ্বীপ অঞ্চল`,
        lat: 21.876,
        lng: 88.192,
      };

      return NextResponse.json({
        name: top.name,
        full_address: top.full_address,
        lat: top.lat,
        lng: top.lng,
        suggestions: suggestions.slice(0, 7),
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

    // 1. Check if coords are close to one of our regional hubs (< 600m)
    for (const lm of SUNDARBAN_LANDMARKS) {
      const d = calculateDistanceKm(latitude, longitude, lm.lat, lm.lng);
      if (d < 0.6) {
        return NextResponse.json({
          name: lm.name,
          full_address: `${lm.name}, সুন্দরবন অঞ্চল, দক্ষিণ ২৪ পরগনা`,
          lat: latitude,
          lng: longitude,
          isHub: true,
        });
      }
    }

    // 2. OpenStreetMap Nominatim reverse geocode
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "SundarbanRiders/1.0 (contact@sundarbanriders.com)",
            "Accept-Language": "bn,en;q=0.8",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const parts = [
          addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || addr.road,
          addr.town || addr.city_district || addr.county || addr.state_district,
        ].filter(Boolean);

        const displayName =
          parts.length > 0
            ? parts.join(", ")
            : data.display_name?.split(",").slice(0, 2).join(",") || "বর্তমান অবস্থান";

        return NextResponse.json({
          name: displayName.trim(),
          full_address: data.display_name,
          lat: latitude,
          lng: longitude,
        });
      }
    } catch {}

    return NextResponse.json({
      name: `লোকেশন (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
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
