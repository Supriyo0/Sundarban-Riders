import { NextResponse } from "next/server";
import { getWhatsAppQRStatus } from "@/lib/whatsapp/qr-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getWhatsAppQRStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to get QR status" }, { status: 500 });
  }
}
