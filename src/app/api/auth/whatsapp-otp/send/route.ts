import { NextResponse } from "next/server";
import { sendWhatsAppOtp } from "@/lib/whatsapp/otp-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, role = "passenger" } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, message: "ফোন নম্বর আবশ্যক।" },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppOtp(phone, role);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
  }
}
