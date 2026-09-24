import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { decrypt } from "@/lib/whatsapp/encryption";
import { sendInteractiveButtons, sendTextMessage } from "@/lib/whatsapp/meta-api";
import { calculateDistanceKm } from "@/lib/whatsapp/toto-engine";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Proactively notifies online drivers within 5km radius via WhatsApp
 */
async function notifyOnlineDriversViaWhatsApp(admin: SupabaseClient, booking: any) {
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

    // Fetch active & available drivers
    const { data: drivers } = await admin
      .from("drivers")
      .select("*")
      .eq("is_active", true)
      .eq("is_available", true);

    if (!drivers || drivers.length === 0) return;

    const pLat = booking.pickup_lat;
    const pLng = booking.pickup_lng;

    const nearbyDrivers = drivers.filter((d) => {
      if (!pLat || !pLng) return true;
      let dLat = d.latitude;
      let dLng = d.longitude;
      if (!dLat || !dLng) {
        try {
          const meta = JSON.parse(d.current_location_name || "{}");
          dLat = meta.lat;
          dLng = meta.lng;
        } catch {}
      }
      if (!dLat || !dLng) return true;
      const dKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
      return dKm <= 5.0;
    });

    for (const d of nearbyDrivers) {
      const recipientPhone = d.phone.replace(/[^0-9]/g, "");
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

      await sendInteractiveButtons({
        phoneNumberId,
        accessToken,
        to: recipientPhone,
        bodyText: `🛺 নতুন টোটো বুকিং অনুরোধ! 🛺\n=======================\n🆔 বুকিং নং: #${booking.booking_number}\n👤 যাত্রী: ${booking.customer_name}\n📞 ফোন: ${booking.customer_phone}\n📍 পিকআপ: ${booking.pickup_location}${distText}\n🏁 গন্তব্য: ${booking.drop_location}\n💵 আনুমানিক ভাড়া: ₹${booking.estimated_fare}.00\n=======================\nআপনি কি এই রাইডটি গ্রহণ করতে চান?`,
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

    // 1. Notify Passenger on WhatsApp
    if (booking.customer_phone) {
      const custPhone = booking.customer_phone.replace(/[^0-9]/g, "");
      await sendInteractiveButtons({
        phoneNumberId,
        accessToken,
        to: custPhone,
        bodyText: `✨ আপনার রাইড নিশ্চিত হয়েছে! ✨\n=======================\n🛺 চালক: ${driver.name || "সুন্দরবন চালক"}\n📞 ফোন: ${driver.phone}\n🚘 টোটো নম্বর: ${driver.toto_number || "WB-96-T-XXXX"}\n=======================\nচালক কিছুক্ষণের মধ্যেই আপনার পিকআপ অবস্থানে পৌঁছাবেন।`,
        buttons: [{ id: "cancel_ride", title: "❌ বুকিং বাতিল" }],
      }).catch(() => {});
    }

    // 2. Proactively update other online drivers: "booking took by other rider"
    const { data: otherDrivers } = await admin
      .from("drivers")
      .select("phone")
      .neq("id", driver.id || "");

    if (otherDrivers && otherDrivers.length > 0) {
      for (const od of otherDrivers) {
        const dPhone = od.phone.replace(/[^0-9]/g, "");
        await sendTextMessage({
          phoneNumberId,
          accessToken,
          to: dPhone,
          text: `ℹ️ বুকিং আপডেট: #${booking.booking_number} রাইডটি চালক ${driver.name || "অন্য একজন চালক"} গ্রহণ করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[dispatch] Error in notifyRideAccepted:", err);
  }
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
      const { data, error } = await admin
        .from("bookings")
        .select("*, drivers(*)")
        .or(`id.eq.${id},booking_number.eq.${id}`)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (status === "pending") {
      const { data, error } = await admin
        .from("bookings")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (driverId) {
      const { data, error } = await admin
        .from("bookings")
        .select("*")
        .eq("driver_id", driverId)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, "");
      const { data, error } = await admin
        .from("bookings")
        .select("*, drivers(*)")
        .or(`customer_phone.eq.${customerPhone},customer_phone.eq.${cleanPhone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ booking: data });
    }

    // Default: return recent pending bookings
    const { data, error } = await admin
      .from("bookings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bookings: data });
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
    const {
      customerName,
      customerPhone,
      pickupLocation,
      dropLocation,
      pickupCoords,
      dropCoords,
      estimatedFare,
    } = body;

    if (!pickupLocation || !dropLocation) {
      return NextResponse.json({ error: "পিকআপ ও গন্তব্য অবস্থান আবশ্যক" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const cleanPhone = (customerPhone || "918348122122").replace(/[^0-9]/g, "");
    const bookingNumber = `SR-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: booking, error: insertErr } = await admin
      .from("bookings")
      .insert({
        booking_number: bookingNumber,
        customer_name: customerName || "যাত্রী",
        customer_phone: cleanPhone,
        pickup_location: pickupLocation,
        drop_location: dropLocation,
        pickup_lat: pickupCoords?.[0],
        pickup_lng: pickupCoords?.[1],
        drop_lat: dropCoords?.[0],
        drop_lng: dropCoords?.[1],
        estimated_fare: estimatedFare || 50,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Proactively dispatch WhatsApp interactive alerts to all nearby online drivers
    void notifyOnlineDriversViaWhatsApp(admin, booking);

    return NextResponse.json({
      success: true,
      booking,
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
    const { action, bookingId, driverId, driverName, driverPhone, totoNumber } = body;

    if (!bookingId || !action) {
      return NextResponse.json({ error: "bookingId and action required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

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

      // Assign ride atomically
      const { data: assigned, error: assignErr } = await admin
        .from("bookings")
        .update({
          status: "assigned",
          driver_id: driverId || null,
          driver_name: driverName || "সুন্দরবন চালক",
          driver_phone: driverPhone || "",
          toto_number: totoNumber || "WB-96-T-8421",
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .eq("status", "pending")
        .select()
        .maybeSingle();

      if (assignErr || !assigned) {
        return NextResponse.json(
          {
            error: "booking_already_taken",
            message: "দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন।",
          },
          { status: 409 }
        );
      }

      // Mark this driver as busy/unavailable
      if (driverId) {
        void Promise.resolve(
          admin.from("drivers").update({ is_available: false, is_active: true }).eq("id", driverId)
        ).catch(() => {});
      }

      // Notify passenger on WhatsApp + notify other drivers that booking was taken
      void notifyRideAccepted(admin, assigned, {
        name: driverName,
        phone: driverPhone,
        toto_number: totoNumber,
        id: driverId,
      });

      return NextResponse.json({
        success: true,
        booking: assigned,
        message: "রাইড গ্রহণ সফল হয়েছে!",
      });
    }

async function notifyTripStarted(admin: SupabaseClient, booking: any) {
  try {
    if (!booking.customer_phone) return;
    const { data: config } = await admin.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (!config?.phone_number_id || !config?.access_token) return;
    const accessToken = decrypt(config.access_token);
    const phoneNumberId = config.phone_number_id;
    const custPhone = booking.customer_phone.replace(/[^0-9]/g, "");

    await sendTextMessage({
      phoneNumberId,
      accessToken,
      to: custPhone,
      text: `🛺 আপনার যাত্রা শুরু হয়েছে! সুন্দরবন রাইডারের সাথে আপনার যাত্রা শুভ ও নিরাপদ হোক।`,
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
    const custPhone = booking.customer_phone.replace(/[^0-9]/g, "");

    await sendInteractiveButtons({
      phoneNumberId,
      accessToken,
      to: custPhone,
      bodyText: `🙏 আপনার যাত্রা সফলভাবে সম্পন্ন হয়েছে! "সুন্দরবন রাইডার"-এ ভ্রমণের জন্য অসংখ্য ধন্যবাদ। "সুন্দরবন রাইডার" আপনার সুস্বাস্থ্য ও নিরাপদ যাত্রা কামনা করে ।🙏\n\n💵 সংগৃহীত ভাড়া: ₹${booking.final_fare || booking.estimated_fare || 50}.00\n\n🛺 আমাদের পরিষেবাকে আরও উন্নত করতে; আপনার অভিজ্ঞতা, অভিযোগ বা মূল্যবান পরামর্শ জানাতে —\nক্লিক করুন :`,
      buttons: [
        { id: "customer_complaint", title: "↩️ অভিযোগ জানান" },
        { id: "customer_feedback", title: "↩️ মতামত বা পরামর্শ" },
      ],
    }).catch(() => {});
  } catch (err) {
    console.error("[notifyTripCompleted] Error:", err);
  }
}

    // -------------------------------------------------------------
    // ACTION: START TRIP
    // -------------------------------------------------------------
    if (action === "start") {
      const { data: updated } = await admin
        .from("bookings")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", booking.id)
        .select()
        .single();

      if (updated) {
        void notifyTripStarted(admin, updated);
      }

      return NextResponse.json({ success: true, booking: updated });
    }

    // -------------------------------------------------------------
    // ACTION: COMPLETE TRIP
    // -------------------------------------------------------------
    if (action === "complete") {
      const { data: updated } = await admin
        .from("bookings")
        .update({
          status: "completed",
          final_fare: booking.estimated_fare,
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select()
        .single();

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
        void notifyTripCompleted(admin, updated);
      }

      return NextResponse.json({ success: true, booking: updated });
    }

    // -------------------------------------------------------------
    // ACTION: CANCEL
    // -------------------------------------------------------------
    if (action === "cancel") {
      const { data: updated } = await admin
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_by: driverId ? "driver" : "customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", booking.id)
        .select()
        .single();

      if (booking.driver_id) {
        void Promise.resolve(
          admin
            .from("drivers")
            .update({ is_available: true, is_active: true })
            .eq("id", booking.driver_id)
        ).catch(() => {});
      }

      return NextResponse.json({ success: true, booking: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
