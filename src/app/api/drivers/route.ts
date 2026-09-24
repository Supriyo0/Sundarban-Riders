import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });

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

      if (d.current_location_name) {
        try {
          const meta = JSON.parse(d.current_location_name);
          district = district || meta.district || "";
          block = block || meta.block || "";
          aadhar_no = aadhar_no || meta.aadhar_no || "";
          email = email || meta.email || "";
          aadhar_card_url = meta.aadhar_card_url || "";
          secondary_doc_url = meta.secondary_doc_url || "";
          secondary_doc_type = meta.secondary_doc_type || "";
        } catch {}
      }

      return {
        ...d,
        district,
        block,
        aadhar_no,
        email,
        aadhar_card_url,
        secondary_doc_url,
        secondary_doc_type,
        is_approved: d.is_approved !== false,
      };
    });

    return NextResponse.json({ drivers });
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

    const metaString = JSON.stringify({
      district: distStr,
      block: blockStr,
      aadhar_no: aadharStr,
    });

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
    if (!body || !body.id) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 });
    }

    const { id, is_active, is_available } = body;
    const admin = supabaseAdmin();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (typeof is_available === "boolean") updates.is_available = is_available;

    const { data, error } = await admin
      .from("drivers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ driver: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
