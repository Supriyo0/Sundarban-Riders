import * as path from "path";
import * as fs from "fs";

export interface WhatsAppQRStatus {
  status: "disconnected" | "connecting" | "waiting_scan" | "connected";
  qr: string | null;
  phone: string | null;
  updatedAt?: string;
}

export async function getWhatsAppQRStatus(): Promise<WhatsAppQRStatus> {
  const authDir = path.resolve(process.cwd(), ".whatsapp_auth");
  const qrFilePath = path.join(authDir, "qr_status.json");

  try {
    if (fs.existsSync(qrFilePath)) {
      const data = fs.readFileSync(qrFilePath, "utf8");
      const parsed = JSON.parse(data);
      return {
        status: parsed.status || "disconnected",
        qr: parsed.qr || null,
        phone: parsed.phone || null,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch (err) {
    console.error("Error reading WhatsApp QR status:", err);
  }

  return {
    status: "disconnected",
    qr: null,
    phone: null,
  };
}
