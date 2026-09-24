import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Call OpenStreetMap Nominatim with proper server User-Agent
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
