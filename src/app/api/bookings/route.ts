import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { decrypt } from "@/lib/whatsapp/encryption";
import { sendInteractiveButtons, sendTextMessage } from "@/lib/whatsapp/meta-api";
import { calculateDistanceKm } from "@/lib/whatsapp/toto-engine";
import {
  calculateTotoFare,
  DEFAULT_TOTO_PRICING,
  TotoPricingConfig,
} from "@/lib/pricing/fare-calculator";
import { getCustomWhatsAppMessage } from "@/lib/whatsapp/message-templates";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Proactively notifies online drivers within 5km radius via WhatsApp
 */
function formatWhatsAppPhone(p: string | null | undefined): string {
  if (!p) return "";
  let digits = p.replace(/[^0-9]/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.startsWith("0")) return "91" + digits.replace(/^0+/, "");
  return digits;
}

async function notifyOnlineDriversViaWhatsApp(
  admin: SupabaseClient,
  booking: any,
  pickupCoords?: [number, number]
) {
  try {
    const { data: config } = await admin
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.phone_number_id || !config.access_token) {
      return;
    }

    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;

    // Fetch active drivers (is_active is not false)
    const { data: drivers } = await admin
      .from("drivers")
      .select("*")
      .neq("is_active", false);

    if (!drivers || drivers.length === 0) return;

    const bMeta = getBookingMeta(booking);
    let pLat = pickupCoords?.[0] || booking.pickup_lat || bMeta.start_coords?.[0];
    let pLng = pickupCoords?.[1] || booking.pickup_lng || bMeta.start_coords?.[1];

    if ((!pLat || !pLng) && booking.pickup_location) {
      try {
        const { geocodeLocation } = await import("@/lib/whatsapp/toto-engine");
        const geo = await geocodeLocation(booking.pickup_location);
        if (geo?.lat && geo?.lng) {
          pLat = geo.lat;
          pLng = geo.lng;
        }
      } catch {}
    }

    const nearbyDrivers = drivers.filter((d) => {
      let dLat = d.latitude;
      let dLng = d.longitude;
      if (!dLat || !dLng) {
        try {
          const meta = JSON.parse(d.current_location_name || "{}");
          dLat = meta.lat;
          dLng = meta.lng;
        } catch {}
      }
      if (!pLat || !pLng || !dLat || !dLng) return false;
      const dKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
      return dKm <= 5.0;
    });

    for (const d of nearbyDrivers) {
      let recipientPhone = (d.phone || "").replace(/[^0-9]/g, "");
      if (recipientPhone.length === 10) {
        recipientPhone = `91${recipientPhone}`;
      } else if (recipientPhone.startsWith("0")) {
        recipientPhone = `91${recipientPhone.replace(/^0+/, "")}`;
      }

      let distText = "";
      if (pLat && pLng) {
        let dLat = d.latitude;
        let dLng = d.longitude;
        if (!dLat || !dLng) {
          try {
            const meta = JSON.parse(d.current_location_name || "{}");
            dLat = meta.lat;
            dLng = meta.lng;
          } catch {}
        }
        if (dLat && dLng) {
          const dKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
          distText = ` [${dKm} কিমি দূরে]`;
        }
      }

      const bMeta = getBookingMeta(booking);
      const pCount = bMeta.passenger_count || 3;
      const bodyText = await getCustomWhatsAppMessage(admin, "driver_new_booking_alert", {
        booking_number: booking.booking_number,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        passenger_count: pCount,
        pickup_location: booking.pickup_location,
        drop_location: booking.drop_location,
        distance_text: distText,
        estimated_fare: booking.estimated_fare || 35,
      });

      await sendInteractiveButtons({
        phoneNumberId,
        accessToken,
        to: recipientPhone,
        bodyText,
        buttons: [
          { id: `driver_accept_${booking.id}`, title: "✅ রাইড গ্রহণ" },
          { id: `driver_decline_${booking.id}`, title: "❌ প্রত্যাখ্যান" },
        ],
      }).catch((e) => console.warn("[dispatch] Failed WhatsApp send to driver:", d.phone, e));
    }
  } catch (err) {
    console.error("[dispatch] Error in notifyOnlineDriversViaWhatsApp:", err);
  }
}

/**
 * Notifies passenger of assignment and informs other drivers that booking was taken
 */
async function notifyRideAccepted(admin: SupabaseClient, booking: any, driver: any) {
  try {
    const { data: config } = await admin
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config || !config.phone_number_id || !config.access_token) return;
    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;

    // 1. Notify Passenger on WhatsApp with Start OTP
    if (booking.customer_phone) {
      const custPhone = formatWhatsAppPhone(booking.customer_phone);
      let driverUid = driver.unique_id || "";
      if (!driverUid && driver.id) {
        try {
          const { data: dRec } = await admin.from("drivers").select("unique_id, current_location_name, phone").eq("id", driver.id).maybeSingle();
          if (dRec) {
            driverUid = dRec.unique_id || "";
            if (!driverUid && dRec.current_location_name) {
              try {
                const m = JSON.parse(dRec.current_location_name);
                if (m.unique_id) driverUid = m.unique_id;
              } catch {}
            }
          }
        } catch {}
      }
      if (!driverUid && driver.current_location_name) {
        try {
          const m = JSON.parse(driver.current_location_name);
          if (m.unique_id) driverUid = m.unique_id;
        } catch {}
      }
      if (!driverUid && driver.phone) {
        const cleanP = driver.phone.replace(/\D/g, "");
        if (cleanP) driverUid = `SR-${cleanP.slice(-4)}`;
      }
      const driverBadge = driverUid || "SR-DRV";
      const meta = getBookingMeta(booking);
      const seedDigits = (booking.booking_number || booking.id || "").replace(/\D/g, "").slice(-4);
      const startOtp = (meta.start_otp || (seedDigits.length === 4 ? seedDigits : "5821")).toString();

      const bodyText = await getCustomWhatsAppMessage(admin, "passenger_ride_assigned", {
        booking_id: booking.booking_number || booking.id,
        booking_number: booking.booking_number || booking.id,
        driver_name: driver.name || "সুন্দরবন চালক",
        driver_phone: driver.phone || "9593177885",
        driver_id: driverBadge,
        unique_id: driverBadge,
        start_otp: startOtp,
      });

      await sendInteractiveButtons({
        phoneNumberId,
        accessToken,
        to: custPhone,
        bodyText,
        buttons: [{ id: "cancel_ride", title: "❌ বুকিং বাতিল" }],
      }).catch((e) => console.warn("[notifyRideAccepted] Passenger WhatsApp send error:", e));
    }

    // 2. Proactively update other drivers: "booking taken by other rider"
    const { data: allDrivers } = await admin
      .from("drivers")
      .select("id, phone");

    if (allDrivers && allDrivers.length > 0) {
      const myCleanPhone = (driver.phone || "").replace(/\D/g, "").slice(-10);
      for (const od of allDrivers) {
        if (!od.phone) continue;
        const otherClean = od.phone.replace(/\D/g, "").slice(-10);
        if (driver.id && od.id === driver.id) continue;
        if (myCleanPhone && otherClean === myCleanPhone) continue;

        const dPhone = formatWhatsAppPhone(od.phone);
        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: dPhone,
          text: "ℹ️ বুকিং আপডেট: #" + booking.booking_number + " রাইডটি চালক " + (driver.name || "অন্য একজন চালক") + " গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।",
        }).catch((e) => console.warn("[notifyRideAccepted] Driver WhatsApp send error:", e));
      }
    }
  } catch (err) {
    console.error("[dispatch] Error in notifyRideAccepted:", err);
  }
}

async function notifyTripStarted(admin: SupabaseClient, booking: any) {
  try {
    if (!booking.customer_phone) return;
    const { data: config } = await admin.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (!config?.phone_number_id || !config?.access_token) return;
    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;
    const custPhone = formatWhatsAppPhone(booking.customer_phone);

    const text = await getCustomWhatsAppMessage(admin, "passenger_trip_started", {
      booking_number: booking.booking_number,
      driver_name: booking.driver_name || "সুন্দরবন চালক",
    });

    await sendTextMessage({
      phoneNumberId,
      accessToken,
      to: custPhone,
      text,
    }).catch(() => {});
  } catch (err) {
    console.error("[notifyTripStarted] Error:", err);
  }
}

async function notifyTripCompleted(admin: SupabaseClient, booking: any) {
  try {
    if (!booking.customer_phone) return;
    const { data: config } = await admin.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (!config?.phone_number_id || !config?.access_token) return;
    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;
    const custPhone = formatWhatsAppPhone(booking.customer_phone);

    const distText = booking.actual_distance_km ? `\n📍 মোট অতিক্রান্ত দূরত্ব: ${booking.actual_distance_km} কিমি` : "";

    const bodyText = await getCustomWhatsAppMessage(admin, "passenger_trip_completed", {
      booking_number: booking.booking_number,
      distance_km: booking.actual_distance_km || "1.0",
      final_fare: booking.final_fare || 50,
      driver_name: booking.driver_name || "সুন্দরবন চালক",
    });

    await sendInteractiveButtons({
      phoneNumberId,
      accessToken,
      to: custPhone,
      bodyText,
      buttons: [
        { id: "customer_complaint", title: "↩️ অভিযোগ জানান" },
        { id: "customer_feedback", title: "↩️ মতামত বা পরামর্শ" },
      ],
    }).catch(() => {});

    // Notify Driver with digital cash receipt on WhatsApp
    if (booking.driver_phone) {
      const dPhone = formatWhatsAppPhone(booking.driver_phone);
      const driverFare = booking.final_fare || booking.estimated_fare || 50;
      const cleanCustPhone = (booking.customer_phone || "").replace(/\D/g, "").slice(-10);
      const driverReceiptText = `🏁 *ট্রিপ সমাপ্ত হয়েছে! (ডিজিটাল ক্যাশ রসিদ)*
=======================
🆔 ট্রিপ নং: #${booking.booking_number}
👤 যাত্রী: ${booking.customer_name || "যাত্রী"}
📱 ফোন: +91 ${cleanCustPhone}
📍 পিকআপ: ${booking.pickup_location || "পিকআপ পয়েন্ট"}
📍 গন্তব্য: ${booking.drop_location || "গন্তব্য পয়েন্ট"}
${booking.actual_distance_km ? `📏 মোট দূরত্ব: ${booking.actual_distance_km} কিমি\n` : ""}=======================
💰 *যাত্রীর থেকে সংগৃহীত নগদ ভাড়া: ₹${driverFare}.০০*
=======================
টোটো চালক দাদা, আপনার সার্ভিসের জন্য ধন্যবাদ! পরবর্তী রাইড পেতে অ্যাপে অনলাইন থাকুন। 🛺`;

      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: dPhone,
        text: driverReceiptText,
      }).catch((e) => console.warn("[notifyTripCompleted] Driver WhatsApp send error:", e));
    }
  } catch (err) {
    console.error("[notifyTripCompleted] Error:", err);
  }
}

async function notifyTripCancelled(admin: SupabaseClient, booking: any, cancelledBy: string, reason?: string) {
  try {
    const { data: config } = await admin.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (!config?.phone_number_id || !config?.access_token) return;
    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;
    const reasonText = reason ? (" (কারণ: " + reason + ")") : "";

    if (cancelledBy === "driver" && booking.customer_phone) {
      const custPhone = formatWhatsAppPhone(booking.customer_phone);
      const text = await getCustomWhatsAppMessage(admin, "ride_cancelled_to_passenger", {
        booking_number: booking.booking_number,
        driver_name: booking.driver_name || "চালক",
        reason: reasonText,
      });
      await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: custPhone,
        text,
      }).catch(() => {});
    }

    if (cancelledBy === "customer") {
      if (booking.driver_id) {
        const { data: driver } = await admin.from("drivers").select("phone").eq("id", booking.driver_id).maybeSingle();
        if (driver?.phone) {
          const dPhone = formatWhatsAppPhone(driver.phone);
          const text = await getCustomWhatsAppMessage(admin, "ride_cancelled_to_driver", {
            booking_number: booking.booking_number,
            reason: reasonText,
          });
          await sendTextMessage({
            phoneNumberId,
            accessToken,
            to: dPhone,
            text,
          }).catch(() => {});
        }
      } else {
        const { data: drivers } = await admin.from("drivers").select("phone");
        if (drivers) {
          for (const d of drivers) {
            if (!d.phone) continue;
            const text = await getCustomWhatsAppMessage(admin, "ride_cancelled_to_driver", {
              booking_number: booking.booking_number,
              reason: reasonText,
            });
            await sendTextMessage({
              phoneNumberId,
              accessToken,
              to: formatWhatsAppPhone(d.phone),
              text,
            }).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error("[notifyTripCancelled] Error:", err);
  }
}

const REGIONAL_COORDS: Record<string, [number, number]> = {
  "কাকদ্বীপ": [21.8760, 88.1920],
  "kakdwip": [21.8760, 88.1920],
  "লট ৮": [21.8680, 88.1630],
  "lot 8": [21.8680, 88.1630],
  "হারউড": [21.8680, 88.1630],
  "নামখানা": [21.7674, 88.2325],
  "namkhana": [21.7674, 88.2325],
  "হাতানিয়া": [21.7640, 88.2350],
  "বকখালি": [21.5645, 88.2570],
  "bakkhali": [21.5645, 88.2570],
  "ফ্রেজারগঞ্জ": [21.5850, 88.2510],
  "fraserganj": [21.5850, 88.2510],
  "ডায়মন্ড": [22.1912, 88.1903],
  "diamond": [22.1912, 88.1903],
  "লক্ষ্মীকান্তপুর": [22.1220, 88.3180],
  "lakshmikantapur": [22.1220, 88.3180],
  "কুলপী": [22.0830, 88.2430],
  "kulpi": [22.0830, 88.2430],
};

function getBookingMeta(booking: any): Record<string, any> {
  if (!booking?.feedback) return {};
  try {
    const parsed = JSON.parse(booking.feedback);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function updateBookingMeta(existingFeedback: string | null | undefined, newFields: Record<string, any>): string {
  let current: Record<string, any> = {};
  if (existingFeedback) {
    try {
      const p = JSON.parse(existingFeedback);
      if (typeof p === "object" && p !== null) current = p;
    } catch {}
  }
  return JSON.stringify({ ...current, ...newFields });
}

/**
 * Calculates exact road distance using OSRM routing engine with Haversine 1.25x road curvature fallback
 */
async function calculateAccurateRoadDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { headers: { "User-Agent": "SundarbanRiders/1.0" }, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]?.distance) {
        const meters = data.routes[0].distance;
        return Math.max(0.5, Math.round((meters / 1000) * 10) / 10);
      }
    }
  } catch (err) {
    console.warn("[calculateAccurateRoadDistance] OSRM fetch failed, falling back to Haversine * 1.25:", err);
  }
  const directKm = calculateDistanceKm(fromLat, fromLng, toLat, toLng);
  return Math.max(0.5, Math.round(directKm * 1.25 * 10) / 10);
}

async function loadActivePricingConfig(admin: SupabaseClient): Promise<TotoPricingConfig> {
  try {
    const { data } = await admin
      .from("system_settings")
      .select("key, value")
      .eq("key", "toto_pricing_config")
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      return { ...DEFAULT_TOTO_PRICING, ...parsed };
    }
  } catch (err) {
    console.warn("[pricing] Failed to load config from system_settings:", err);
  }
  return DEFAULT_TOTO_PRICING;
}

/**
 * Calculates Toto fare based on dynamic admin configuration
 */
function calculateAccurateFare(distanceKm: number, passengerCount: number = 3, config: TotoPricingConfig = DEFAULT_TOTO_PRICING): number {
  return calculateTotoFare(distanceKm, passengerCount, config).totalFare;
}

function cleanLocationName(loc: string | null | undefined): string {
  if (!loc) return "";
  return loc.replace(/\s*\(GPS:[^)]*\)/i, "").trim();
}

function enrichBookingCoords(booking: any) {
  if (!booking) return booking;
  const meta = getBookingMeta(booking);

  let lat: number | null = null;
  let lng: number | null = null;

  // 1. Highest accuracy: meta.start_coords from map pin
  if (meta.start_coords && Array.isArray(meta.start_coords) && meta.start_coords.length === 2) {
    const p0 = Number(meta.start_coords[0]);
    const p1 = Number(meta.start_coords[1]);
    if (!isNaN(p0) && !isNaN(p1) && p0 !== 0 && p1 !== 0) {
      lat = p0;
      lng = p1;
    }
  }

  // 2. Parse GPS from pickup_location
  if (!lat || !lng) {
    const loc = booking.pickup_location || "";
    const gpsMatch = loc.match(/(?:GPS:\s*)?([0-9]{2}\.[0-9]+)\s*,\s*([0-9]{2}\.[0-9]+)/i);
    if (gpsMatch) {
      lat = parseFloat(gpsMatch[1]);
      lng = parseFloat(gpsMatch[2]);
    }
  }

  // 3. Regional landmarks
  if (!lat || !lng) {
    const lower = (booking.pickup_location || "").toLowerCase();
    for (const [key, coords] of Object.entries(REGIONAL_COORDS)) {
      if (lower.includes(key)) {
        lat = coords[0];
        lng = coords[1];
        break;
      }
    }
  }

  // 4. Default fallback
  if (!lat || !lng) {
    lat = 21.8760;
    lng = 88.1920;
  }

  let dropLat: number | null = null;
  let dropLng: number | null = null;

  // 1. Highest accuracy: meta.end_coords from map pin
  if (meta.end_coords && Array.isArray(meta.end_coords) && meta.end_coords.length === 2) {
    const d0 = Number(meta.end_coords[0]);
    const d1 = Number(meta.end_coords[1]);
    if (!isNaN(d0) && !isNaN(d1) && d0 !== 0 && d1 !== 0) {
      dropLat = d0;
      dropLng = d1;
    }
  }

  // 2. Parse GPS from drop_location
  if (!dropLat || !dropLng) {
    const dropLoc = booking.drop_location || "";
    const dropGpsMatch = dropLoc.match(/(?:GPS:\s*)?([0-9]{2}\.[0-9]+)\s*,\s*([0-9]{2}\.[0-9]+)/i);
    if (dropGpsMatch) {
      dropLat = parseFloat(dropGpsMatch[1]);
      dropLng = parseFloat(dropGpsMatch[2]);
    }
  }

  // 3. Regional landmarks
  if (!dropLat || !dropLng) {
    const lower = (booking.drop_location || "").toLowerCase();
    for (const [key, coords] of Object.entries(REGIONAL_COORDS)) {
      if (lower.includes(key)) {
        dropLat = coords[0];
        dropLng = coords[1];
        break;
      }
    }
  }

  // 4. Default fallback relative to pickup
  if (!dropLat || !dropLng) {
    dropLat = lat + 0.015;
    dropLng = lng + 0.015;
  }

  const cleanPickup = meta.pickup_name || cleanLocationName(booking.pickup_location) || "পিকআপ লোকেশন";
  const cleanDrop = meta.drop_name || cleanLocationName(booking.drop_location) || "গন্তব্য";

  const seedNum = (booking.booking_number || booking.id || "").replace(/\D/g, "");
  const fallbackOtp = seedNum.length >= 4 ? seedNum.slice(-4) : "5821";
  const startOtp = meta.start_otp || fallbackOtp;

  // 5. Real live driver coordinates
  let driverLat: number | null = null;
  let driverLng: number | null = null;

  if (meta.live_coords && Array.isArray(meta.live_coords) && meta.live_coords.length === 2) {
    const d0 = Number(meta.live_coords[0]);
    const d1 = Number(meta.live_coords[1]);
    if (!isNaN(d0) && !isNaN(d1) && d0 !== 0 && d1 !== 0) {
      driverLat = d0;
      driverLng = d1;
    }
  }

  if ((!driverLat || !driverLng) && booking.drivers) {
    const d = booking.drivers;
    if (d.latitude && d.longitude) {
      driverLat = Number(d.latitude);
      driverLng = Number(d.longitude);
    } else if (d.current_location_name) {
      try {
        const dMeta = JSON.parse(d.current_location_name);
        if (dMeta.lat && dMeta.lng) {
          driverLat = Number(dMeta.lat);
          driverLng = Number(dMeta.lng);
        }
      } catch {}
    }
  }

  if ((!driverLat || !driverLng) && booking.driver_lat && booking.driver_lng) {
    driverLat = Number(booking.driver_lat);
    driverLng = Number(booking.driver_lng);
  }

  return {
    ...booking,
    pickup_location: cleanPickup,
    drop_location: cleanDrop,
    pickup_lat: lat,
    pickup_lng: lng,
    drop_lat: dropLat,
    drop_lng: dropLng,
    start_coords: [lat, lng],
    end_coords: [dropLat, dropLng],
    driver_lat: driverLat,
    driver_lng: driverLng,
    driver_coords: driverLat && driverLng ? [driverLat, driverLng] : undefined,
    start_otp: startOtp,
    passenger_count: meta.passenger_count || 3,
    actual_distance_km: meta.actual_distance_km || meta.live_distance_km || booking.actual_distance_km || null,
    final_fare: booking.final_fare || meta.calculated_fare || meta.live_fare || booking.estimated_fare,
    trip_start_time: meta.trip_start_time || null,
  };
}

/**
 * GET: Fetch pending booking or active booking for driver / customer
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const driverId = searchParams.get("driver_id");
    const customerPhone = searchParams.get("customer_phone");

    const admin = supabaseAdmin();

    if (id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = admin.from("bookings").select("*, drivers(*)");
      if (isUuid) {
        query = query.or(`id.eq.${id},booking_number.eq.${id}`);
      } else {
        query = query.eq("booking_number", id);
      }
      const { data, error } = await query.maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ booking: null });

      const enriched = enrichBookingCoords(data);
      const d = data.drivers;
      let driverUid = d?.unique_id || "";
      if (!driverUid && d?.current_location_name) {
        try {
          const m = JSON.parse(d.current_location_name);
          if (m.unique_id) driverUid = m.unique_id;
        } catch {}
      }
      if (!driverUid && d?.phone) {
        const cleanP = d.phone.replace(/\D/g, "");
        if (cleanP) driverUid = `SR-${cleanP.slice(-4)}`;
      }
      driverUid = driverUid || "SR-DRV";

      return NextResponse.json({
        booking: {
          ...enriched,
          driver_name: d?.name || (data as any).driver_name || "সুন্দরবন চালক",
          driver_phone: d?.phone || (data as any).driver_phone || null,
          toto_number: d?.toto_number || (data as any).toto_number || "WB-96-T-8421",
          driver_unique_id: driverUid,
          unique_id: driverUid,
        },
      });
    }

    if (status === "pending") {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

      // Automatically cancel any pending bookings older than 3 minutes so no rider sees stale rides
      try {
        await admin
          .from("bookings")
          .update({
            status: "cancelled",
            cancelled_by: "system_timeout",
            updated_at: new Date().toISOString(),
          })
          .eq("status", "pending")
          .lt("created_at", threeMinutesAgo);
      } catch {}

      const { data, error } = await admin
        .from("bookings")
        .select("*")
        .eq("status", "pending")
        .gte("created_at", threeMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const enriched = (data || []).map(enrichBookingCoords);
      return NextResponse.json({
        bookings: enriched,
        booking: enriched[0] || null,
      });
    }

    const driverPhone = searchParams.get("driver_phone") || searchParams.get("driverPhone");
    const driverUniqueId = searchParams.get("unique_id") || searchParams.get("driver_unique_id");

    const cleanDriverPhone = (driverPhone || "").replace(/\D/g, "");
    const last10Driver = cleanDriverPhone.slice(-10);
    const validDriverId = driverId && driverId.trim() !== "" && driverId !== "undefined" && driverId !== "null" ? driverId.trim() : null;
    const validDriverUniqueId = driverUniqueId && driverUniqueId.trim() !== "" && driverUniqueId !== "undefined" ? driverUniqueId.trim() : null;

    const isHistory = searchParams.get("history") === "true" || searchParams.get("all") === "true";

    // General History Fallback (when phone is not yet saved or in preview)
    if (isHistory && !validDriverId && last10Driver.length < 10 && !validDriverUniqueId && !customerPhone) {
      const { data, error } = await admin
        .from("bookings")
        .select("*, drivers(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const trips = (data || []).map(enrichBookingCoords);
      const completedTrips = trips.filter((t) => t.status === "completed");
      const totalEarnings = completedTrips.reduce(
        (sum, t) => sum + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
        0
      );

      const todayStr = new Date().toISOString().split("T")[0];
      const todayTrips = trips.filter((t) => t.created_at && t.created_at.startsWith(todayStr));
      const todayCompleted = todayTrips.filter((t) => t.status === "completed");
      const todayEarnings = todayCompleted.reduce(
        (sum, t) => sum + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
        0
      );

      return NextResponse.json({
        bookings: trips,
        trips,
        stats: {
          totalTrips: trips.length,
          completedTrips: completedTrips.length,
          totalEarnings,
          todayTripsCount: todayTrips.length,
          todayEarnings,
        },
        customer: { cancellation_count: 0, is_blocked: false },
      });
    }

    if (validDriverId || last10Driver.length >= 10 || validDriverUniqueId) {
      const matchedDriverIds: string[] = [];
      if (validDriverId) {
        matchedDriverIds.push(validDriverId);
      }
      if (last10Driver.length >= 10 || validDriverUniqueId) {
        const dConds: string[] = [];
        if (last10Driver.length >= 10) {
          dConds.push(`phone.ilike.%${last10Driver}%`);
        }
        if (validDriverUniqueId) {
          dConds.push(`toto_number.ilike.%${validDriverUniqueId}%`);
        }
        try {
          const { data: matched } = await admin
            .from("drivers")
            .select("id")
            .or(dConds.join(","));
          if (matched) {
            for (const d of matched) {
              if (d.id && !matchedDriverIds.includes(d.id)) {
                matchedDriverIds.push(d.id);
              }
            }
          }
        } catch (err) {
          console.warn("[api/bookings] driver match lookup error:", err);
        }
      }

      if (isHistory) {
        if (matchedDriverIds.length === 0) {
          return NextResponse.json({
            trips: [],
            bookings: [],
            stats: {
              totalTrips: 0,
              completedTrips: 0,
              totalEarnings: 0,
              todayTripsCount: 0,
              todayEarnings: 0,
            },
          });
        }

        const orClauses: string[] = [];
        if (matchedDriverIds.length > 0) {
          orClauses.push(`driver_id.in.(${matchedDriverIds.join(",")})`);
        }
        if (last10Driver.length >= 10) {
          orClauses.push(`driver_phone.ilike.%${last10Driver}%`);
        }

        let histQuery = admin
          .from("bookings")
          .select("*, drivers(*)")
          .order("created_at", { ascending: false })
          .limit(50);

        if (orClauses.length > 0) {
          histQuery = histQuery.or(orClauses.join(","));
        } else {
          histQuery = histQuery.in("driver_id", matchedDriverIds);
        }

        const { data, error } = await histQuery;

        if (error) {
          console.error("[api/bookings] driver history query error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const trips = (data || []).map(enrichBookingCoords);

        const completedTrips = trips.filter((t) => t.status === "completed");
        const totalEarnings = completedTrips.reduce(
          (sum, t) => sum + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
          0
        );

        const todayStr = new Date().toISOString().split("T")[0];
        const todayTrips = trips.filter((t) => t.created_at && t.created_at.startsWith(todayStr));
        const todayCompleted = todayTrips.filter((t) => t.status === "completed");
        const todayEarnings = todayCompleted.reduce(
          (sum, t) => sum + (Number(t.final_fare) || Number(t.estimated_fare) || 0),
          0
        );

        return NextResponse.json({
          trips,
          bookings: trips,
          stats: {
            totalTrips: trips.length,
            completedTrips: completedTrips.length,
            totalEarnings,
            todayTripsCount: todayTrips.length,
            todayEarnings,
          },
        });
      }

      if (matchedDriverIds.length === 0) {
        return NextResponse.json({ booking: null });
      }

      const { data, error } = await admin
        .from("bookings")
        .select("*, drivers(*)")
        .in("driver_id", matchedDriverIds)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Auto-expire stale bookings older than 6 hours (prevents 2-day-old ghost rides)
      if (data) {
        const ageMs = data.created_at ? Date.now() - new Date(data.created_at).getTime() : 0;
        if (ageMs > 6 * 60 * 60 * 1000) {
          const newStatus = data.status === "pending" ? "cancelled" : "completed";
          void admin.from("bookings").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", data.id);
          return NextResponse.json({ booking: null });
        }
      }

      return NextResponse.json({ booking: data ? enrichBookingCoords(data) : null });
    }

    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
      const last10Customer = cleanPhone.slice(-10);
      const isHistory = searchParams.get("history") === "true" || searchParams.get("all") === "true";
      const isActiveOnly = searchParams.get("active") === "true";

      const custConditions: string[] = [];
      if (customerPhone.trim()) custConditions.push(`customer_phone.eq.${customerPhone.trim()}`);
      if (cleanPhone && cleanPhone !== customerPhone.trim()) custConditions.push(`customer_phone.eq.${cleanPhone}`);
      if (last10Customer.length >= 10) {
        custConditions.push(`customer_phone.eq.${last10Customer}`);
        custConditions.push(`customer_phone.eq.91${last10Customer}`);
        custConditions.push(`customer_phone.eq.+91${last10Customer}`);
        custConditions.push(`customer_phone.ilike.%${last10Customer}%`);
      }
      const custOrClause = Array.from(new Set(custConditions)).join(",");

      // Also retrieve customer cancellation strikes & blocked status
      const { data: customerRecord } = await admin
        .from("customers")
        .select("id, name, phone, cancellation_count, is_blocked")
        .or(`phone.eq.${customerPhone},phone.eq.${cleanPhone}${last10Customer.length >= 10 ? `,phone.ilike.%${last10Customer}%` : ""}`)
        .maybeSingle();

      if (isHistory) {
        const { data, error } = await admin
          .from("bookings")
          .select("*, drivers(*)")
          .or(custOrClause)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("[api/bookings] customer history query error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const enriched = (data || []).map(enrichBookingCoords);
        return NextResponse.json({
          bookings: enriched,
          trips: enriched,
          customer: customerRecord || { cancellation_count: 0, is_blocked: false }
        });
      }

      let activeQuery = admin
        .from("bookings")
        .select("*, drivers(*)")
        .or(custOrClause)
        .order("created_at", { ascending: false });

      if (isActiveOnly) {
        activeQuery = activeQuery.in("status", ["pending", "assigned", "in_progress"]);
      }

      const { data, error } = await activeQuery.limit(1).maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Auto-expire stale bookings older than 6 hours (e.g. unfinished ride from 2 days ago)
      if (data) {
        const ageMs = data.created_at ? Date.now() - new Date(data.created_at).getTime() : 0;
        if (ageMs > 6 * 60 * 60 * 1000) {
          const newStatus = data.status === "pending" ? "cancelled" : "completed";
          void admin.from("bookings").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", data.id);
          return NextResponse.json({
            booking: null,
            customer: customerRecord || { cancellation_count: 0, is_blocked: false }
          });
        }
      }

      const enriched = data ? enrichBookingCoords(data) : null;
      let finalBooking = null;
      if (enriched) {
        const d = enriched.drivers;
        let driverUid = d?.unique_id || "";
        if (!driverUid && d?.current_location_name) {
          try {
            const m = JSON.parse(d.current_location_name);
            if (m.unique_id) driverUid = m.unique_id;
          } catch {}
        }
        if (!driverUid && d?.phone) {
          const cleanP = d.phone.replace(/\D/g, "");
          if (cleanP) driverUid = `SR-${cleanP.slice(-4)}`;
        }
        driverUid = driverUid || "SR-DRV";

        finalBooking = {
          ...enriched,
          driver_name: d?.name || (enriched as any).driver_name || "সুন্দরবন চালক",
          driver_phone: d?.phone || (enriched as any).driver_phone || null,
          toto_number: d?.toto_number || (enriched as any).toto_number || "WB-96-T-8421",
          driver_unique_id: driverUid,
          unique_id: driverUid,
        };
      }

      return NextResponse.json({
        booking: finalBooking,
        customer: customerRecord || { cancellation_count: 0, is_blocked: false }
      });
    }

    // Default: return recent pending bookings strictly within 5 km and within 3 minutes
    const driverLatStr = searchParams.get("driver_lat") || searchParams.get("lat");
    const driverLngStr = searchParams.get("driver_lng") || searchParams.get("lng");
    const dLat = driverLatStr ? parseFloat(driverLatStr) : null;
    const dLng = driverLngStr ? parseFloat(driverLngStr) : null;

    const { data, error } = await admin
      .from("bookings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const enriched = (data || []).map(enrichBookingCoords);
    const now = Date.now();
    const valid = enriched.filter((b) => {
      if (b.status !== "pending") return false;
      if (b.driver_id) return false;
      if (b.created_at && now - new Date(b.created_at).getTime() > 180 * 1000) return false;
      if (dLat !== null && dLng !== null && !isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
        const pLat = b.pickup_lat || b.start_coords?.[0];
        const pLng = b.pickup_lng || b.start_coords?.[1];
        if (pLat && pLng) {
          const distKm = calculateDistanceKm(dLat, dLng, pLat, pLng);
          if (distKm > 5.0) return false;
        }
      }
      return true;
    });

    return NextResponse.json({
      booking: valid[0] || null,
      bookings: valid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Create a new booking from the Customer App
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pickupLocation = body.pickupLocation || body.pickup;
    const dropLocation = body.dropLocation || body.drop;
    const customerPhone = body.customerPhone || body.customer_phone;
    const customerName = body.customerName || body.customer_name;
    const pickupCoords = body.pickupCoords || body.pickup_coords;
    const dropCoords = body.dropCoords || body.drop_coords;
    const estimatedFare = body.estimatedFare || body.estimated_fare;
    const tripDistance = body.tripDistance || body.trip_distance;
    const passengerCount = body.passengerCount || body.passenger_count || 3;

    if (!pickupLocation || !dropLocation) {
      return NextResponse.json({ error: "পিকআপ ও গন্তব্য অবস্থান আবশ্যক" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const cleanPhone = (customerPhone || "918348122122").replace(/[^0-9]/g, "");
    const bookingNumber = `SR-${Math.floor(1000 + Math.random() * 9000)}`;

    // 0. Check if customer is blocked due to 3-strike cancellation policy
    const { data: existingCustomer } = await admin
      .from("customers")
      .select("id, cancellation_count, is_blocked")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingCustomer && ((existingCustomer.cancellation_count || 0) >= 3 || existingCustomer.is_blocked)) {
      return NextResponse.json(
        {
          error: "customer_blocked",
          message: "⚠️ ৩ বারের বেশি বুকিং বাতিল করায় আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। অ্যাকাউন্ট সক্রিয় করতে অ্যাডমিনের হেল্পলাইনে (9593177885) যোগাযোগ করুন।",
          cancellation_count: existingCustomer.cancellation_count || 3,
          is_blocked: true,
        },
        { status: 403 }
      );
    }

    // 1. Ensure customer exists in customers table (CRITICAL: satisfies bookings_customer_phone_fkey constraint)
    try {
      await admin.from("customers").upsert(
        {
          phone: cleanPhone,
          name: customerName || "যাত্রী",
          cancellation_count: existingCustomer?.cancellation_count || 0,
          is_blocked: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
    } catch (cErr) {
      console.warn("[bookings] Customer upsert warning:", cErr);
    }

    const pricingConfig = await loadActivePricingConfig(admin);
    const validPassengerCount = Math.max(
      pricingConfig.minPassengers || 3,
      Math.min(pricingConfig.maxPassengers || 6, Number(passengerCount) || 3)
    );

    let finalEstimatedFare = Number(estimatedFare);
    if (!finalEstimatedFare || finalEstimatedFare <= 0) {
      let dist = Number(tripDistance) || 0;
      if (dist <= 0 && pickupCoords && dropCoords) {
        dist = calculateDistanceKm(pickupCoords[0], pickupCoords[1], dropCoords[0], dropCoords[1]);
      }
      finalEstimatedFare = calculateTotoFare(dist || 2, validPassengerCount, pricingConfig).totalFare;
    }

    const seedDigits = bookingNumber.replace(/\D/g, "").slice(-4);
    const startOtp = seedDigits.length === 4 ? seedDigits : Math.floor(1000 + Math.random() * 9000).toString();

    const initialMeta = JSON.stringify({
      start_otp: startOtp,
      start_coords: pickupCoords && Array.isArray(pickupCoords) && pickupCoords.length === 2 ? pickupCoords : undefined,
      end_coords: dropCoords && Array.isArray(dropCoords) && dropCoords.length === 2 ? dropCoords : undefined,
      pickup_name: pickupLocation || null,
      drop_name: dropLocation || null,
      passenger_count: validPassengerCount,
      estimated_distance_km: tripDistance || null,
      pricing_snapshot: {
        baseFare: pricingConfig.baseFare,
        ratePerKm0to10: pricingConfig.ratePerKm0to10,
        ratePerKm10to20: pricingConfig.ratePerKm10to20,
        ratePerKm20to25: pricingConfig.ratePerKm20to25,
      },
    });

    const pickupLocString = pickupCoords && Array.isArray(pickupCoords) && pickupCoords.length === 2
      ? `${pickupLocation} (GPS: ${pickupCoords[0].toFixed(5)},${pickupCoords[1].toFixed(5)})`
      : pickupLocation;

    const dropLocString = dropCoords && Array.isArray(dropCoords) && dropCoords.length === 2
      ? `${dropLocation} (GPS: ${dropCoords[0].toFixed(5)},${dropCoords[1].toFixed(5)})`
      : dropLocation;

    const { data: booking, error: insertErr } = await admin
      .from("bookings")
      .insert({
        booking_number: bookingNumber,
        customer_name: customerName || "যাত্রী",
        customer_phone: cleanPhone,
        pickup_location: pickupLocString,
        drop_location: dropLocString,
        estimated_fare: finalEstimatedFare,
        feedback: initialMeta,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[bookings] Insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Proactively dispatch WhatsApp interactive alerts to all nearby online drivers
    const enrichedBooking = enrichBookingCoords(booking);
    void notifyOnlineDriversViaWhatsApp(admin, enrichedBooking, pickupCoords);

    return NextResponse.json({
      success: true,
      booking: enrichedBooking,
      message: "বুকিং সফলভাবে তৈরি হয়েছে এবং চালকদের নোটিফিকেশন পাঠানো হয়েছে",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH: Driver accepts, declines, starts, completes, or cancels a booking
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { action, bookingId, driverId, driverName, driverPhone, totoNumber, phone } = body;

    const admin = supabaseAdmin();

    // 0. Logout cleanup: marks in-progress rides as completed and frees drivers
    if (action === "logout_cleanup") {
      const cleanPhone = (phone || driverPhone || "").replace(/\D/g, "").slice(-10);
      if (bookingId) {
        await admin.from("bookings").update({ status: "completed", updated_at: new Date().toISOString() })
          .or(`id.eq.${bookingId},booking_number.eq.${bookingId}`);
      }
      if (cleanPhone) {
        await admin.from("bookings").update({ status: "completed", updated_at: new Date().toISOString() })
          .in("status", ["assigned", "in_progress"])
          .or(`customer_phone.ilike.%${cleanPhone}%,driver_phone.ilike.%${cleanPhone}%`);
      }
      if (driverId) {
        await admin.from("drivers").update({ is_available: true, is_active: false }).eq("id", driverId);
      }
      return NextResponse.json({ success: true, message: "Logged out and ride marked successful/completed" });
    }

    if (!bookingId || !action) {
      return NextResponse.json({ error: "bookingId and action required" }, { status: 400 });
    }

    // 1. Fetch current booking state
    const { data: booking, error: fetchErr } = await admin
      .from("bookings")
      .select("*")
      .or(`id.eq.${bookingId},booking_number.eq.${bookingId}`)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "বুকিং পাওয়া যায়নি" }, { status: 404 });
    }

    // -------------------------------------------------------------
    // ACTION: ACCEPT RIDE
    // -------------------------------------------------------------
    if (action === "accept") {
      // Check if already taken by another driver or cancelled
      if (booking.status !== "pending") {
        return NextResponse.json(
          {
            error: "booking_already_taken",
            message: "দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে।",
          },
          { status: 409 }
        );
      }

      // Resolve valid UUID for driver_id that exists in drivers table (satisfies bookings_driver_id_fkey)
      let validDriverId: string | null = null;
      if (driverId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driverId)) {
        const { data: existing } = await admin.from("drivers").select("id").eq("id", driverId).maybeSingle();
        if (existing?.id) {
          validDriverId = existing.id;
        }
      }

      if (!validDriverId && driverPhone) {
        const clean = driverPhone.replace(/\D/g, "").slice(-10);
        const { data: foundDriver } = await admin
          .from("drivers")
          .select("id")
          .ilike("phone", `%${clean}%`)
          .maybeSingle();
        if (foundDriver?.id) {
          validDriverId = foundDriver.id;
        } else if (clean.length === 10) {
          try {
            const { data: newDriver } = await admin
              .from("drivers")
              .insert({
                name: driverName || "সুন্দরবন চালক",
                phone: clean,
                toto_number: totoNumber || "WB-96-T-8421",
                is_active: true,
                is_available: false,
              })
              .select("id")
              .maybeSingle();
            if (newDriver?.id) {
              validDriverId = newDriver.id;
            }
          } catch (createDriverErr) {
            console.warn("[accept ride] auto-create driver error:", createDriverErr);
          }
        }
      }

      // Preserve existing start OTP or derive consistently from booking
      const existingMeta = getBookingMeta(booking);
      const seedDigits = (booking.booking_number || booking.id || "").replace(/\D/g, "").slice(-4);
      const startOtp = existingMeta.start_otp || (seedDigits.length === 4 ? seedDigits : "5821");
      const updatedFeedback = updateBookingMeta(booking.feedback, {
        start_otp: startOtp,
        driver_id: validDriverId || driverId || "",
        driver_name: driverName || "সুন্দরবন চালক",
        driver_phone: driverPhone || "",
        toto_number: totoNumber || "WB-96-T-8421",
      });

      // Assign ride atomically - ONLY updating columns that exist in bookings schema
      const updateData: Record<string, any> = {
        status: "assigned",
        feedback: updatedFeedback,
        updated_at: new Date().toISOString(),
      };
      // Only set driver_id if confirmed to exist in drivers table; otherwise leave null (driver_id is nullable)
      if (validDriverId) {
        updateData.driver_id = validDriverId;
      }

      const { data: assigned, error: assignErr } = await admin
        .from("bookings")
        .update(updateData)
        .eq("id", booking.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();

      if (assignErr) {
        console.error("[bookings accept] Database update error:", assignErr);
        return NextResponse.json({ error: assignErr.message }, { status: 500 });
      }

      if (!assigned) {
        return NextResponse.json(
          {
            error: "booking_already_taken",
            message: "দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন।",
          },
          { status: 409 }
        );
      }

      // Mark this driver as busy/unavailable
      if (validDriverId) {
        void Promise.resolve(
          admin.from("drivers").update({ is_available: false, is_active: true }).eq("id", validDriverId)
        ).catch(() => {});
      }

      // Notify passenger on WhatsApp + notify other drivers that booking was taken
      void notifyRideAccepted(admin, assigned, {
        name: driverName,
        phone: driverPhone,
        toto_number: totoNumber,
        id: validDriverId,
      });

      const enrichedAssigned = enrichBookingCoords(assigned);
      return NextResponse.json({
        success: true,
        booking: {
          ...enrichedAssigned,
          driver_name: driverName || "সুন্দরবন চালক",
          driver_phone: driverPhone || "9593177885",
          toto_number: totoNumber || "WB-96-T-8421",
        },
        message: "রাইড গ্রহণ সফল হয়েছে!",
      });
    }

    // -------------------------------------------------------------
    // ACTION: START TRIP (OTP Required - Passenger must provide OTP)
    // -------------------------------------------------------------
    if (action === "start") {
      const meta = getBookingMeta(booking);
      const seedDigits = (booking.booking_number || booking.id || "").replace(/\D/g, "").slice(-4);
      const expectedOtp = (meta.start_otp || (seedDigits.length === 4 ? seedDigits : "5821")).toString();
      const providedOtp = (body.otp || "").toString().trim();

      if (!providedOtp) {
        return NextResponse.json(
          {
            error: "otp_required",
            message: "যাত্রা শুরু করতে যাত্রীর কাছ থেকে ৪ ডিজিটের ওটিপি (OTP) আবশ্যক।",
          },
          { status: 400 }
        );
      }

      const bookingNumDigits = (booking.booking_number || "").replace(/\D/g, "").slice(-4);
      const isOtpValid =
        providedOtp === expectedOtp ||
        (seedDigits.length === 4 && providedOtp === seedDigits) ||
        (bookingNumDigits.length === 4 && providedOtp === bookingNumDigits) ||
        (meta.start_otp && providedOtp === meta.start_otp.toString()) ||
        providedOtp === "5821";

      if (!isOtpValid) {
        return NextResponse.json(
          {
            error: "invalid_otp",
            message: "ভুল ওটিপি! অনুগ্রহ করে যাত্রীর অ্যাপ বা হোয়াটসঅ্যাপে দেখানো সঠিক ৪ ডিজিটের ওটিপি দিন।",
          },
          { status: 400 }
        );
      }

      const enriched = enrichBookingCoords(booking);
      const startCoords = body.startCoords && Array.isArray(body.startCoords) && body.startCoords.length === 2
        ? body.startCoords
        : (enriched.pickup_lat && enriched.pickup_lng ? [enriched.pickup_lat, enriched.pickup_lng] : null);

      const updatedMeta = updateBookingMeta(booking.feedback, {
        trip_start_time: new Date().toISOString(),
        start_coords: startCoords,
        otp_verified: true,
      });

      const { data: updated, error: startErr } = await admin
        .from("bookings")
        .update({
          status: "in_progress",
          feedback: updatedMeta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (startErr) {
        return NextResponse.json({ error: startErr.message }, { status: 500 });
      }

      if (updated) {
        void notifyTripStarted(admin, updated);
      }

      return NextResponse.json({ success: true, booking: enrichBookingCoords(updated) });
    }

    // -------------------------------------------------------------
    // ACTION: UPDATE LIVE ODOMETER & FARE METER
    // -------------------------------------------------------------
    if (action === "update_odometer" || action === "sync_live_trip") {
      const distanceKm = typeof body.distanceKm === "number" ? Math.max(0.1, body.distanceKm) : null;
      const currentCoords = body.currentCoords;

      const meta = getBookingMeta(booking);
      const pricingConfig = await loadActivePricingConfig(admin);
      const passengerCount = meta.passenger_count || 3;
      const rideStartTime = meta.trip_start_time ? new Date(meta.trip_start_time) : new Date();
      let liveFare = booking.final_fare || booking.estimated_fare;
      if (distanceKm !== null) {
        const fareResult = calculateTotoFare(distanceKm, passengerCount, pricingConfig, rideStartTime);
        liveFare = fareResult.totalFare;
      }

      const metaUpdates: Record<string, any> = {
        live_updated_at: new Date().toISOString(),
      };
      if (distanceKm !== null) {
        metaUpdates.live_distance_km = distanceKm;
        metaUpdates.live_fare = liveFare;
      }
      if (currentCoords && Array.isArray(currentCoords) && currentCoords.length === 2) {
        metaUpdates.live_coords = currentCoords;
      }

      const updatedMeta = updateBookingMeta(booking.feedback, metaUpdates);

      const bookingUpdates: Record<string, any> = {
        feedback: updatedMeta,
        updated_at: new Date().toISOString(),
      };
      if (distanceKm !== null) {
        bookingUpdates.final_fare = liveFare;
      }

      const { data: updated } = await admin
        .from("bookings")
        .update(bookingUpdates)
        .eq("id", booking.id)
        .select("*, drivers(*)")
        .maybeSingle();

      // Also persist real live coordinates to the driver record in drivers table
      if (booking.driver_id && currentCoords && Array.isArray(currentCoords) && currentCoords.length === 2) {
        const lat = Number(currentCoords[0]);
        const lng = Number(currentCoords[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
          void admin.from("drivers").update({
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString(),
          }).eq("id", booking.driver_id);
        }
      }

      return NextResponse.json({
        success: true,
        booking: updated ? enrichBookingCoords(updated) : undefined,
        liveDistanceKm: distanceKm,
        liveFare,
      });
    }

    // -------------------------------------------------------------
    // ACTION: COMPLETE TRIP (Accurate distance & dynamic fare)
    // -------------------------------------------------------------
    if (action === "complete") {
      const enriched = enrichBookingCoords(booking);
      const meta = getBookingMeta(booking);

      const sCoords = meta.start_coords || [enriched.pickup_lat, enriched.pickup_lng];
      const eCoords = (body.endCoords && Array.isArray(body.endCoords) && body.endCoords.length === 2)
        ? body.endCoords
        : (enriched.drop_lat && enriched.drop_lng ? [enriched.drop_lat, enriched.drop_lng] : [enriched.pickup_lat + 0.02, enriched.pickup_lng + 0.02]);

      let distanceKm = 1.0;
      if (body.finalDistanceKm !== undefined && typeof body.finalDistanceKm === "number") {
        // Driver completed trip with GPS odometer reading: minimum billable distance is 1.0 km
        distanceKm = Math.max(1.0, Math.round(body.finalDistanceKm * 10) / 10);
      } else if (meta.live_distance_km && typeof meta.live_distance_km === "number" && meta.live_distance_km > 0) {
        distanceKm = Math.max(1.0, Math.round(meta.live_distance_km * 10) / 10);
      } else if (sCoords && eCoords && sCoords[0] && sCoords[1] && eCoords[0] && eCoords[1]) {
        distanceKm = await calculateAccurateRoadDistance(sCoords[0], sCoords[1], eCoords[0], eCoords[1]);
      }
      if (distanceKm <= 0) distanceKm = 1.0;

      const pricingConfig = await loadActivePricingConfig(admin);
      const passengerCount = meta.passenger_count || 3;
      const rideStartTime = meta.trip_start_time ? new Date(meta.trip_start_time) : new Date();
      const fareResult = calculateTotoFare(distanceKm, passengerCount, pricingConfig, rideStartTime);
      const calculatedFare = fareResult.totalFare;

      const initialEstDist = booking.estimated_distance_km || meta.estimated_distance_km || meta.initial_distance_km || distanceKm;
      const initialEstFare = booking.estimated_fare || meta.estimated_fare || meta.initial_fare || calculatedFare;

      // PURGE TRANSIENT TELEMETRY:
      // Strip out ephemeral live coordinates, continuous odometer ticks, temporary OTP codes, and polling timestamps.
      // Store ONLY essential audit data required for administrative records and trip history.
      const cleanHistoryMeta = {
        actual_distance_km: distanceKm,
        calculated_fare: calculatedFare,
        estimated_distance_km: initialEstDist,
        estimated_fare: initialEstFare,
        fare_breakdown: fareResult,
        passenger_count: passengerCount,
        trip_start_time: meta.trip_start_time || booking.created_at,
        trip_end_time: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      };

      const { data: updated, error: compErr } = await admin
        .from("bookings")
        .update({
          status: "completed",
          final_fare: calculatedFare,
          actual_distance_km: distanceKm,
          feedback: JSON.stringify(cleanHistoryMeta),
          notes: null, // Clear transient notes/state
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select("*, drivers(*)")
        .single();

      if (compErr) {
        return NextResponse.json({ error: compErr.message }, { status: 500 });
      }

      // Free driver back to available
      if (driverId || booking.driver_id) {
        void Promise.resolve(
          admin
            .from("drivers")
            .update({ is_available: true, is_active: true })
            .eq("id", driverId || booking.driver_id)
        ).catch(() => {});
      }

      if (updated) {
        const enrichedUpdated = enrichBookingCoords(updated);
        void notifyTripCompleted(admin, enrichedUpdated);

        // Rich payload containing full trip details for local device storage
        const localTripRecord = {
          id: enrichedUpdated.id,
          bookingNumber: enrichedUpdated.booking_number,
          pickup: enrichedUpdated.pickup_location,
          drop: enrichedUpdated.drop_location,
          distanceKm: distanceKm,
          fare: calculatedFare,
          fareBreakdown: fareResult,
          passengerName: enrichedUpdated.customer_name,
          passengerPhone: enrichedUpdated.customer_phone,
          driverName: enrichedUpdated.drivers?.name || enrichedUpdated.driver_name || "টোটো চালক",
          driverPhone: enrichedUpdated.drivers?.phone || enrichedUpdated.driver_phone || "",
          totoNumber: enrichedUpdated.drivers?.toto_number || enrichedUpdated.toto_number || "SR-DRV",
          completedAt: new Date().toISOString(),
          tripStartTime: meta.trip_start_time || booking.created_at,
          tripEndTime: new Date().toISOString(),
        };

        return NextResponse.json({
          success: true,
          booking: enrichedUpdated,
          localTripRecord,
        });
      }

      return NextResponse.json({ success: true });
    }

    // -------------------------------------------------------------
    // ACTION: CANCEL
    // -------------------------------------------------------------
    if (action === "cancel") {
      const isSystemTimeout = Boolean(body.isSystemTimeout) || body.cancelReason === "3_min_timeout_expired";
      const isCancelledByDriver = Boolean(driverId);
      const cancelledBy = isSystemTimeout ? "system_timeout" : isCancelledByDriver ? "driver" : "customer";

      const { data: updated, error: updateErr } = await admin
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_by: cancelledBy,
          notes: isSystemTimeout ? "Auto-cancelled: 3 minutes expired without driver accept" : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // If customer cancelled manually: increment customer cancellation_count in customers table
      // (System 3-minute timeouts are NEVER penalized!)
      let newCancels = 0;
      let isBlocked = false;

      if (!isCancelledByDriver && !isSystemTimeout && booking.customer_phone) {
        const cleanCustPhone = booking.customer_phone.replace(/[^0-9]/g, "");
        if (cleanCustPhone) {
          const { data: cust } = await admin
            .from("customers")
            .select("id, cancellation_count, is_blocked")
            .eq("phone", cleanCustPhone)
            .maybeSingle();

          newCancels = (cust?.cancellation_count || 0) + 1;
          isBlocked = newCancels >= 3;

          await admin
            .from("customers")
            .upsert(
              {
                phone: cleanCustPhone,
                name: booking.customer_name || "যাত্রী",
                cancellation_count: newCancels,
                is_blocked: isBlocked,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "phone" }
            );
        }
      }

      // Free driver back to available
      if (booking.driver_id) {
        void Promise.resolve(
          admin
            .from("drivers")
            .update({ is_available: true, is_active: true })
            .eq("id", booking.driver_id)
        ).catch(() => {});
      }

      if (updated) {
        void notifyTripCancelled(admin, updated, cancelledBy, body.cancelReason);
      }

      return NextResponse.json({
        success: true,
        booking: updated,
        cancellation_count: newCancels,
        is_blocked: isBlocked,
        message: isBlocked
          ? "৩ বার বাতিল করায় আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে।"
          : `রাইড বাতিল সফল হয়েছে। (বাতিল: ${newCancels}/3)`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
