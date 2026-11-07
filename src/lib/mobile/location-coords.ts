/**
 * Centralized, robust coordinate extraction for Sundarban Riders Bookings.
 * Guaranteed to extract real GPS coordinates regardless of whether the booking
 * originated from WhatsApp Bot, Mobile Web App, PWA, or Capacitor.
 */

export function extractPickupCoordinates(b: any): [number, number] | null {
  if (!b) return null;

  // 1. Array in pickupCoords
  if (Array.isArray(b.pickupCoords) && b.pickupCoords.length === 2) {
    const lat = Number(b.pickupCoords[0]);
    const lng = Number(b.pickupCoords[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 2. Array in start_coords
  if (Array.isArray(b.start_coords) && b.start_coords.length === 2) {
    const lat = Number(b.start_coords[0]);
    const lng = Number(b.start_coords[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 3. Direct columns pickup_lat & pickup_lng
  if (b.pickup_lat !== undefined && b.pickup_lat !== null && b.pickup_lng !== undefined && b.pickup_lng !== null) {
    const lat = Number(b.pickup_lat);
    const lng = Number(b.pickup_lng);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 4. Coordinates inside feedback / meta JSON
  if (b.feedback) {
    try {
      const meta = typeof b.feedback === "string" ? JSON.parse(b.feedback) : b.feedback;
      if (meta && typeof meta === "object") {
        if (Array.isArray(meta.start_coords) && meta.start_coords.length === 2) {
          const lat = Number(meta.start_coords[0]);
          const lng = Number(meta.start_coords[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
        }
        if (Array.isArray(meta.pickup_coords) && meta.pickup_coords.length === 2) {
          const lat = Number(meta.pickup_coords[0]);
          const lng = Number(meta.pickup_coords[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
        }
      }
    } catch {}
  }

  // 5. GPS pattern inside pickup_location string: e.g. "নামখানা (GPS: 21.76543,88.23451)"
  const loc = b.pickup_location || b.pickup || "";
  if (typeof loc === "string" && loc.includes(",")) {
    const gpsMatch = loc.match(/(?:GPS:\s*)?([0-9]{2}\.[0-9]+)\s*,\s*([0-9]{2}\.[0-9]+)/i);
    if (gpsMatch) {
      const lat = parseFloat(gpsMatch[1]);
      const lng = parseFloat(gpsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
    }
  }

  return null;
}

export function extractDropCoordinates(b: any): [number, number] | null {
  if (!b) return null;

  // 1. Array in dropCoords
  if (Array.isArray(b.dropCoords) && b.dropCoords.length === 2) {
    const lat = Number(b.dropCoords[0]);
    const lng = Number(b.dropCoords[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 2. Array in end_coords
  if (Array.isArray(b.end_coords) && b.end_coords.length === 2) {
    const lat = Number(b.end_coords[0]);
    const lng = Number(b.end_coords[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 3. Direct columns drop_lat & drop_lng
  if (b.drop_lat !== undefined && b.drop_lat !== null && b.drop_lng !== undefined && b.drop_lng !== null) {
    const lat = Number(b.drop_lat);
    const lng = Number(b.drop_lng);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
  }

  // 4. Coordinates inside feedback / meta JSON
  if (b.feedback) {
    try {
      const meta = typeof b.feedback === "string" ? JSON.parse(b.feedback) : b.feedback;
      if (meta && typeof meta === "object") {
        if (Array.isArray(meta.end_coords) && meta.end_coords.length === 2) {
          const lat = Number(meta.end_coords[0]);
          const lng = Number(meta.end_coords[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
        }
        if (Array.isArray(meta.drop_coords) && meta.drop_coords.length === 2) {
          const lat = Number(meta.drop_coords[0]);
          const lng = Number(meta.drop_coords[1]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
        }
      }
    } catch {}
  }

  // 5. GPS pattern inside drop_location string
  const loc = b.drop_location || b.drop || "";
  if (typeof loc === "string" && loc.includes(",")) {
    const gpsMatch = loc.match(/(?:GPS:\s*)?([0-9]{2}\.[0-9]+)\s*,\s*([0-9]{2}\.[0-9]+)/i);
    if (gpsMatch) {
      const lat = parseFloat(gpsMatch[1]);
      const lng = parseFloat(gpsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) return [lat, lng];
    }
  }

  return null;
}
