import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, driverId, subscription } = body;

    if (!phone && !driverId) {
      return NextResponse.json({ error: "Phone or driverId is required" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    // Save push subscription into drivers current_location_name metadata
    let query = admin.from("drivers").select("id, current_location_name");
    if (driverId) {
      query = query.eq("id", driverId);
    } else {
      query = query.ilike("phone", `%${cleanPhone}`);
    }

    const { data: driverRow, error } = await query.maybeSingle();

    if (!error && driverRow) {
      let meta: any = {};
      if (driverRow.current_location_name) {
        try {
          meta = JSON.parse(driverRow.current_location_name);
        } catch {}
      }
      meta.push_subscription = subscription;
      meta.push_updated_at = new Date().toISOString();

      await admin
        .from("drivers")
        .update({
          current_location_name: JSON.stringify(meta),
        })
        .eq("id", driverRow.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[push-subscribe] Error saving push subscription:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
