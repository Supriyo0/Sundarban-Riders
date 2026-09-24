import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Load SMTP settings from env or system_settings table.
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // Check environment variables first
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || `Sundarban Riders <${process.env.SMTP_USER}>`,
    };
  }

  // Fallback to system_settings in Supabase
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"]);

    const map: Record<string, string> = {};
    data?.forEach((row) => {
      map[row.key] = row.value;
    });

    if (map.smtp_host && map.smtp_user && map.smtp_pass) {
      return {
        host: map.smtp_host,
        port: Number(map.smtp_port) || 587,
        secure: Number(map.smtp_port) === 465,
        user: map.smtp_user,
        pass: map.smtp_pass,
        from: map.smtp_from || `Sundarban Riders <${map.smtp_user}>`,
      };
    }
  } catch (err) {
    console.error("Error reading SMTP settings from database:", err);
  }

  return null;
}

/**
 * Send Driver Approval Congratulations Email
 */
export async function sendDriverApprovalEmail(params: {
  toEmail: string;
  driverName: string;
  totoNumber: string;
}): Promise<{ success: boolean; message: string }> {
  const { toEmail, driverName, totoNumber } = params;

  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, message: "ইমেইল প্রদান করা হয়নি।" };
  }

  const config = await getSmtpConfig();

  if (!config) {
    console.warn("[Mailer] SMTP credentials not configured. Skipping email dispatch.");
    return { success: false, message: "SMTP কনফিগারেশন সেট করা নেই।" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
        .content { padding: 30px; color: #334155; line-height: 1.6; }
        .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 6px 16px; border-radius: 20px; font-weight: bold; margin-bottom: 15px; border: 1px solid #a7f3d0; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 style="margin:0; font-size: 24px;">🛺 সুন্দরবন রাইডার (Sundarban Riders)</h1>
          <p style="margin: 5px 0 0; opacity: 0.9;">স্মার্ট টোটো বুকিং ও পরিবহন সেবা</p>
        </div>
        <div class="content">
          <div class="badge">✓ অ্যাকাউন্ট অনুমোদিত (Approved)</div>
          <h2>অভিনন্দন, ${driverName}! 🎉</h2>
          <p>আপনার সুন্দরবন রাইডার চালক (Rider) আবেদন এবং জমা দেওয়া প্রয়োজনীয় সকল ডকুমেন্টস সফলভাবে যাচাই ও <strong>অনুমোদিত</strong> হয়েছে।</p>
          
          <div class="box">
            <h3 style="margin-top:0; font-size:16px;">আপনার চালক বিবরণ:</h3>
            <p style="margin:5px 0;"><strong>চালক:</strong> ${driverName}</p>
            <p style="margin:5px 0;"><strong>টোটো নম্বর:</strong> ${totoNumber}</p>
            <p style="margin:5px 0;"><strong>ডিউটি স্ট্যাটাস:</strong> সক্রিয় / অনলাইন</p>
          </div>

          <p>আপনি এখন আপনার মোবাইল অ্যাপে লগইন করে সরাসরি <strong>"অনলাইন যান"</strong> বোতামে চাপ দিয়ে রাইড গ্রহণ শুরু করতে পারেন।</p>
          <p>যেকোনো প্রয়োজনে আমাদের সাপোর্ট নম্বরে যোগাযোগ করুন:<br>
          📞 WhatsApp Help: <strong>8348122122</strong></p>
          
          <p style="margin-top: 25px;">শুভকামনা সহ,<br><strong>সুন্দরবন রাইডার্স অ্যাডমিন টিম</strong></p>
        </div>
        <div class="footer">
          © 2026 Sundarban Riders. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject: `🎉 অভিনন্দন ${driverName}! আপনার সুন্দরবন রাইডার চালক অ্যাকাউন্ট অনুমোদিত হয়েছে`,
      html,
    });
    return { success: true, message: "কনফার্মেশন ইমেইল সফলভাবে পাঠানো হয়েছে।" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Mailer] Failed to send email:", errorMsg);
    return { success: false, message: errorMsg };
  }
}
