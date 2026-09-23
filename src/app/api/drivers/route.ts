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

    return NextResponse.json({ drivers: data || [] });
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

    const { name, phone, toto_number } = body;

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
      const { data: updated, error: updateErr } = await admin
        .from("drivers")
        .update({
          name: name.trim(),
          toto_number: toto_number.trim().toUpperCase(),
          is_active: true,
          is_available: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ driver: updated, message: "চালক আপডেট করা হয়েছে" });
    }

    // Insert new driver
    const { data: created, error: insertErr } = await admin
      .from("drivers")
      .insert({
        name: name.trim(),
        phone: rawPhone,
        toto_number: toto_number.trim().toUpperCase(),
        vehicle_type: "toto",
        is_active: true,
        is_available: true,
        agreed_terms: true,
        rating: 5,
        total_trips: 0,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ driver: created, message: "নতুন চালক সফলভাবে যুক্ত হয়েছে" }, { status: 201 });
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
