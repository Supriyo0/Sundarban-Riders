import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { driverLocationStates } from "@/lib/whatsapp/toto-engine";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filterPhone = url.searchParams.get("phone");
    const filterId = url.searchParams.get("id");

    const admin = supabaseAdmin();
    let query = admin
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterId) {
      query = query.eq("id", filterId);
    } else if (filterPhone) {
      const cleanPhone = filterPhone.replace(/\D/g, "");
      const last10 = cleanPhone.slice(-10);
      query = query.or(`phone.eq.${filterPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone},phone.eq.${last10},phone.ilike.%${last10}`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const drivers = (data || []).map((d) => {
      let district = d.district || "";
      let block = d.block || "";
      let aadhar_no = d.aadhar_no || d.license_number || "";

      let email = d.email || "";
      let aadhar_card_url = "";
      let secondary_doc_url = "";
      let secondary_doc_type = "";
      let license_no = "";
      let license_doc_url = "";
      let unique_id = d.unique_id || "";
      let latitude = typeof d.latitude === "number" ? d.latitude : (d.latitude ? parseFloat(d.latitude) : null);
      let longitude = typeof d.longitude === "number" ? d.longitude : (d.longitude ? parseFloat(d.longitude) : null);

      if (d.current_location_name) {
        try {
          const meta = JSON.parse(d.current_location_name);
          district = district || meta.district || "";
          block = block || meta.block || "";
          aadhar_no = aadhar_no || meta.aadhar_no || "";
          license_no = meta.license_no || "";
          email = email || meta.email || "";
          aadhar_card_url = meta.aadhar_card_url || "";
          license_doc_url = meta.license_doc_url || "";
          secondary_doc_url = meta.secondary_doc_url || meta.toto_receipt_doc_url || "";
          secondary_doc_type = meta.secondary_doc_type || "toto_receipt";
          unique_id = unique_id || meta.unique_id || "";
          if ((latitude === null || isNaN(latitude)) && meta.lat) latitude = parseFloat(meta.lat);
          if ((longitude === null || isNaN(longitude)) && meta.lng) longitude = parseFloat(meta.lng);
        } catch {}
      }

      const cleanPhoneDigits = (d.phone || "").replace(/\D/g, "");
      unique_id = unique_id || (cleanPhoneDigits ? `SR-${cleanPhoneDigits.slice(-4)}` : "SR-DRV");

      // Strict: Do not generate fake/mock GPS coordinates. Only use real driver coordinates if available.

      let isApproved = Boolean(d.is_active);
      if (d.current_location_name) {
        try {
          const meta = JSON.parse(d.current_location_name);
          if (meta.status === "pending_approval") {
            isApproved = false;
          } else if (meta.status === "approved") {
            isApproved = true;
          }
        } catch {}
      }

      return {
        ...d,
        latitude,
        longitude,
        district,
        block,
        aadhar_no,
        license_no,
        email,
        aadhar_card_url,
        secondary_doc_url,
        secondary_doc_type,
        license_doc_url,
        toto_receipt_doc_url: secondary_doc_url,
        unique_id,
        is_approved: isApproved,
      };
    });

    return NextResponse.json({
      driver: drivers[0] || null,
      drivers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { name, phone, toto_number, district, block, aadhar_no } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "চালকের নাম প্রদান করুন" }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "চালকের ফোন নম্বর প্রদান করুন" }, { status: 400 });
    }
    if (!toto_number || typeof toto_number !== "string" || !toto_number.trim()) {
      return NextResponse.json({ error: "টোটো নম্বর প্রদান করুন" }, { status: 400 });
    }

    const rawPhone = phone.trim().replace(/[^0-9+]/g, "");
    const cleanDigits = rawPhone.replace(/[^0-9]/g, "");
    const last10 = cleanDigits.slice(-10);

    const distStr = (district || "").toString().trim();
    const blockStr = (block || "").toString().trim();
    const aadharStr = (aadhar_no || "").toString().trim();
    const aadharCardUrl = (body.aadhar_card_url || "").toString().trim();
    const totoReceiptDocUrl = (body.toto_receipt_doc_url || body.secondary_doc_url || "").toString().trim();
    const licenseNo = (body.license_no || "").toString().trim();
    const licenseDocUrl = (body.license_doc_url || "").toString().trim();

    const metaObj: Record<string, unknown> = {
      district: distStr,
      block: blockStr,
      aadhar_no: aadharStr,
    };
    if (aadharCardUrl) metaObj.aadhar_card_url = aadharCardUrl;
    if (totoReceiptDocUrl) {
      metaObj.toto_receipt_doc_url = totoReceiptDocUrl;
      metaObj.secondary_doc_url = totoReceiptDocUrl;
      metaObj.secondary_doc_type = "toto_receipt";
    }
    if (licenseNo) metaObj.license_no = licenseNo;
    if (licenseDocUrl) metaObj.license_doc_url = licenseDocUrl;

    const metaString = JSON.stringify(metaObj);

    const admin = supabaseAdmin();

    // Check if driver already exists with this phone number (matching 10 digits or exact)
    const { data: existing } = await admin
      .from("drivers")
      .select("*")
      .or(`phone.eq.${rawPhone},phone.eq.${cleanDigits},phone.eq.+${cleanDigits},phone.eq.${last10}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update existing driver
      const updateData: Record<string, unknown> = {
        name: name.trim(),
        toto_number: toto_number.trim().toUpperCase(),
        license_number: aadharStr || existing.license_number,
        current_location_name: metaString,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await admin
        .from("drivers")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        driver: {
          ...updated,
          district: distStr,
          block: blockStr,
          aadhar_no: aadharStr,
          aadhar_card_url: aadharCardUrl,
          toto_receipt_doc_url: totoReceiptDocUrl,
          secondary_doc_url: totoReceiptDocUrl,
          license_no: licenseNo,
          license_doc_url: licenseDocUrl,
        },
        message: "চালক তথ্য আপডেট করা হয়েছে",
      });
    }

    // Insert new driver
    const insertPayload: Record<string, unknown> = {
      name: name.trim(),
      phone: rawPhone,
      toto_number: toto_number.trim().toUpperCase(),
      vehicle_type: "toto",
      is_active: false,
      is_available: false,
      agreed_terms: false,
      license_number: aadharStr,
      current_location_name: metaString,
      rating: 5,
      total_trips: 0,
    };

    const { data: created, error: insertErr } = await admin
      .from("drivers")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      driver: {
        ...created,
        district: distStr,
        block: blockStr,
        aadhar_no: aadharStr,
        aadhar_card_url: aadharCardUrl,
        toto_receipt_doc_url: totoReceiptDocUrl,
        secondary_doc_url: totoReceiptDocUrl,
        license_no: licenseNo,
        license_doc_url: licenseDocUrl,
      },
      message: "নতুন চালক সফলভাবে যুক্ত হয়েছে",
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || (!body.id && !body.phone)) {
      return NextResponse.json({ error: "Driver ID or Phone is required" }, { status: 400 });
    }

    const { id, phone, is_active, is_available, latitude, longitude, current_location_name, unique_id, name, toto_number } = body;
    const admin = supabaseAdmin();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (typeof is_available === "boolean") updates.is_available = is_available;
    if (name && typeof name === "string") updates.name = name.trim();
    if (toto_number && typeof toto_number === "string") updates.toto_number = toto_number.trim().toUpperCase();
    if (typeof latitude === "number" || (typeof latitude === "string" && !isNaN(Number(latitude)))) {
      updates.latitude = Number(latitude);
    }
    if (typeof longitude === "number" || (typeof longitude === "string" && !isNaN(Number(longitude)))) {
      updates.longitude = Number(longitude);
    }
    if (current_location_name) {
      updates.current_location_name = current_location_name;
    }

    // Handle unique_id update
    if (unique_id && typeof unique_id === "string") {
      const cleanUid = unique_id.trim().toUpperCase();
      updates.unique_id = cleanUid;

      // Also ensure meta has unique_id
      try {
        let meta: Record<string, unknown> = {};
        if (current_location_name) {
          meta = JSON.parse(current_location_name);
        } else {
          // Fetch existing to preserve meta
          let findQ = admin.from("drivers").select("current_location_name");
          if (id) findQ = findQ.eq("id", id);
          const { data: ex } = await findQ.maybeSingle();
          if (ex?.current_location_name) {
            meta = JSON.parse(ex.current_location_name);
          }
        }
        meta.unique_id = cleanUid;
        updates.current_location_name = JSON.stringify(meta);
      } catch {}
    }

    let updateQuery = admin.from("drivers").update(updates);
    if (id) {
      updateQuery = updateQuery.eq("id", id);
    } else if (phone) {
      const clean = phone.replace(/\D/g, "");
      const last10 = clean.slice(-10);
      updateQuery = updateQuery.or(`phone.eq.${phone},phone.eq.${clean},phone.eq.+${clean},phone.eq.${last10},phone.ilike.%${last10}`);
    }

    let { data, error } = await updateQuery.select().maybeSingle();

    if (error && error.message?.includes("unique_id")) {
      // Fallback if unique_id column does not exist yet
      delete updates.unique_id;
      let fallbackQuery = admin.from("drivers").update(updates);
      if (id) {
        fallbackQuery = fallbackQuery.eq("id", id);
      } else if (phone) {
        const clean = phone.replace(/\D/g, "");
        const last10 = clean.slice(-10);
        fallbackQuery = fallbackQuery.or(`phone.eq.${phone},phone.eq.${clean},phone.eq.+${clean},phone.eq.${last10},phone.ilike.%${last10}`);
      }
      const fallbackRes = await fallbackQuery.select().maybeSingle();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync online/offline across WhatsApp toto-engine and toto_riders table
    const targetPhone = (phone || data?.phone || "").replace(/\D/g, "");
    if (targetPhone) {
      if (is_active === false || is_available === false) {
        // Driver is going offline: clear WhatsApp memory cache and update toto_riders table
        driverLocationStates.delete(targetPhone);
        const last10 = targetPhone.slice(-10);
        void Promise.resolve(
          admin
            .from("toto_riders")
            .update({ duty_status: "offline" })
            .or(`phone_number.eq.${targetPhone},phone_number.ilike.%${last10}`)
        ).catch(() => {});
      } else if (is_active === true && is_available === true) {
        // Driver is going online
        const last10 = targetPhone.slice(-10);
        void Promise.resolve(
          admin
            .from("toto_riders")
            .update({ duty_status: "online_available" })
            .or(`phone_number.eq.${targetPhone},phone_number.ilike.%${last10}`)
        ).catch(() => {});
      }
    }

    return NextResponse.json({ driver: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let id = url.searchParams.get("id");
    let phone = url.searchParams.get("phone");

    // Also check body if available
    if (!id && !phone) {
      try {
        const body = await request.json();
        id = body?.id || null;
        phone = body?.phone || null;
      } catch {}
    }

    if (!id && !phone) {
      return NextResponse.json({ error: "Driver ID or Phone is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Locate the driver first
    let findQuery = admin.from("drivers").select("*");
    if (id) {
      findQuery = findQuery.eq("id", id);
    } else if (phone) {
      const clean = phone.replace(/\D/g, "");
      const last10 = clean.slice(-10);
      findQuery = findQuery.or(`phone.eq.${phone},phone.eq.${clean},phone.eq.+${clean},phone.eq.${last10},phone.ilike.%${last10}`);
    }

    const { data: driver, error: findError } = await findQuery.maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!driver) {
      // Driver already deleted or not found
      return NextResponse.json({ success: true, message: "চালক প্রোফাইল পাওয়া যায়নি বা আগেই মুছে ফেলা হয়েছে।" });
    }

    const targetId = driver.id;
    const targetPhone = (driver.phone || phone || "").replace(/\D/g, "");

    // 2. Unlink any references in bookings so foreign key constraint isn't violated
    try {
      await admin
        .from("bookings")
        .update({ driver_id: null })
        .eq("driver_id", targetId);
    } catch (bookingErr) {
      console.warn("[DELETE /api/drivers] Unlink bookings warning:", bookingErr);
    }

    // 3. Delete from drivers table
    const { error: deleteError } = await admin
      .from("drivers")
      .delete()
      .eq("id", targetId);

    if (deleteError) {
      console.error("[DELETE /api/drivers] Delete driver error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 4. Delete from toto_riders table in WhatsApp CRM so the phone is completely free
    if (targetPhone) {
      const last10 = targetPhone.slice(-10);
      try {
        await admin
          .from("toto_riders")
          .delete()
          .or(`phone_number.eq.${targetPhone},phone_number.ilike.%${last10}`);
      } catch (totoErr) {
        console.warn("[DELETE /api/drivers] Delete toto_riders warning:", totoErr);
      }

      // Remove from active location state in WhatsApp engine
      driverLocationStates.delete(targetPhone);
    }

    return NextResponse.json({
      success: true,
      message: "চালক প্রোফাইল সফলভাবে মুছে ফেলা হয়েছে। এখন এই নম্বরে পুনরায় নতুনভাবে রেজিস্ট্রেশন করা যাবে।",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

