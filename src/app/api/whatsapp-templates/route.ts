import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { ALL_WHATSAPP_TEMPLATES, invalidateTemplateCache } from "@/lib/whatsapp/message-templates";
import { invalidateCachedSettings } from "@/lib/whatsapp/toto-engine";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data: settings } = await admin.from("system_settings").select("*");

    const settingsMap = new Map<string, string>();
    if (settings) {
      settings.forEach((s) => {
        if (s.key && s.value) settingsMap.set(s.key, s.value);
      });
    }

    const templates = ALL_WHATSAPP_TEMPLATES.map((tpl) => {
      const customKey = `wa_tpl_${tpl.key}`;
      const customValue = settingsMap.get(customKey);
      return {
        ...tpl,
        currentText: customValue || tpl.defaultText,
        isCustomized: Boolean(customValue && customValue !== tpl.defaultText),
      };
    });

    return NextResponse.json({ templates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templates } = body; // Array of { key: string, text: string }

    if (!Array.isArray(templates) || templates.length === 0) {
      return NextResponse.json({ error: "Invalid templates array" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const upsertRows = templates.map((t: { key: string; text: string }) => ({
      key: `wa_tpl_${t.key}`,
      value: t.text,
      description: `Custom WhatsApp template: ${t.key}`,
      updated_at: new Date().toISOString(),
    }));

    // Legacy mirror mappings for backward compatibility
    const legacyMirrors: Record<string, string[]> = {
      welcome_message: ["welcome_message_bengali", "welcome_message"],
      driver_terms: ["driver_terms_bengali", "driver_terms"],
      customer_disclaimer: ["customer_disclaimer_bengali", "customer_disclaimer"],
      customer_strike_warning: ["cancellation_warning_bengali", "customer_strike_warning"],
      driver_new_booking_alert: ["driver_new_booking_alert"],
    };

    for (const t of templates) {
      const keys = legacyMirrors[t.key];
      if (keys) {
        for (const k of keys) {
          upsertRows.push({
            key: k,
            value: t.text,
            description: `Legacy mirror for ${t.key}`,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    const { error } = await admin
      .from("system_settings")
      .upsert(upsertRows, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidate in-memory caches immediately so changes reflect right away in real WhatsApp messages
    invalidateTemplateCache();
    invalidateCachedSettings();

    return NextResponse.json({
      success: true,
      message: "সমস্ত হোয়াটসঅ্যাপ টেমপ্লেট সফলভাবে সংরক্ষিত হয়েছে!",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
