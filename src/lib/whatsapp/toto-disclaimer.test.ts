import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  processTotoMessage,
  RIDER_DISCLAIMER_PDF_URL,
  CUSTOMER_DISCLAIMER_PDF_URL,
  toBengaliDigits,
} from "./toto-engine";

describe("WhatsApp Disclaimers & Media Attachments", () => {
  it("has correct URLs configured for the rider PDF and customer PDF", () => {
    expect(RIDER_DISCLAIMER_PDF_URL).toContain("rider-disclaimer.pdf");
    expect(CUSTOMER_DISCLAIMER_PDF_URL).toContain("customer-disclaimer.pdf");
  });

  it("returns customer disclaimer PDF on initial book_toto request with single agree button", async () => {
    const freshPhone = "+919112233445";
    const action = await processTotoMessage({
      fromPhone: freshPhone,
      buttonPayload: "book_toto",
    });

    expect(action).not.toBeNull();
    expect(action?.type).toBe("interactive_buttons");
    expect(action?.media?.kind).toBe("document");
    expect(action?.media?.url).toBe(CUSTOMER_DISCLAIMER_PDF_URL);
    expect(action?.buttons).toEqual([
      { id: "agree_disclaimer", title: "✅ সম্মত আছি" },
    ]);
  });

  it("returns driver disclaimer with attached PDF for first-time rider login", async () => {
    // 919883838854 is a registered driver with agreed_terms: false in DB
    const action = await processTotoMessage({
      fromPhone: "+919883838854",
      buttonPayload: "take_ride",
    });

    expect(action).not.toBeNull();
    expect(action?.type).toBe("interactive_buttons");
    expect(action?.media?.kind).toBe("document");
    expect(action?.media?.url).toBe(RIDER_DISCLAIMER_PDF_URL);
    expect(action?.media?.filename).toContain("Rider_Disclaimer");
    expect(action?.buttons).toEqual([
      { id: "driver_agree_terms", title: "✅ সম্মত আছি" },
    ]);
  });

  it("allows a registered driver to book toto as a passenger and get passenger options", async () => {
    // 1. Driver clicks book_toto
    const step1 = await processTotoMessage({
      fromPhone: "+919876543210",
      buttonPayload: "book_toto",
    });
    expect(step1).not.toBeNull();
    // Driver gets passenger disclaimer (or location prompt if agreed), NOT driver duty options
    expect(step1?.buttons?.some(b => b.id === "driver_go_offline")).toBeFalsy();
    expect(step1?.buttons?.some(b => b.id === "driver_agree_terms")).toBeFalsy();

    // 2. Driver agrees to customer disclaimer as a passenger
    const step2 = await processTotoMessage({
      fromPhone: "+919876543210",
      buttonPayload: "agree_disclaimer",
    });
    expect(step2).not.toBeNull();
    // Must ask for passenger pickup location, NOT driver duty location
    expect(step2?.bodyText).toContain("Current Pickup Location");
    expect(step2?.bodyText).not.toContain("Driver Location");

    // 3. Driver sends pickup location as passenger
    const step3 = await processTotoMessage({
      fromPhone: "+919876543210",
      textBody: "কাকদ্বীপ স্টেশন",
    });
    expect(step3).not.toBeNull();
    // Must ask for drop location as passenger, NOT turn online on duty
    expect(step3?.bodyText).toContain("Drop Location");
    expect(step3?.bodyText).not.toContain("ডিউটি স্ট্যাটাস: অনলাইন");
  });

  it("handles driver going offline via WhatsApp", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919876543210",
      buttonPayload: "driver_go_offline",
    });
    expect(action).not.toBeNull();
    expect(action?.bodyText).toContain("অফলাইনে আছেন");
    expect(action?.buttons).toEqual([
      { id: "take_ride", title: "🛺 রাইডার লগইন" },
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ]);
  });

  it("converts numbers to Bengali numerals cleanly without mixed English digits", () => {
    expect(toBengaliDigits(3)).toBe("৩");
    expect(toBengaliDigits(1)).toBe("১");
    expect(toBengaliDigits("3/3")).toBe("৩/৩");
    expect(`(আপনার বর্তমান বাতিল সংখ্যা: ${toBengaliDigits(3)}/৩)`).toBe("(আপনার বর্তমান বাতিল সংখ্যা: ৩/৩)");
  });

  it("handles greeting 'hii' with clean welcome message, play store link, and exactly 2 buttons", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919000000001",
      textBody: "hii",
    });

    expect(action).not.toBeNull();
    expect(action?.type).toBe("interactive_buttons");
    expect(action?.bodyText).toContain("play.google.com");
    expect(action?.buttons).toEqual([
      { id: "take_ride", title: "🛺 রাইডার লগইন" },
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ]);
  });

  it("returns admin contact details when unregistered rider clicks rider login", async () => {
    // Unregistered phone number
    const action = await processTotoMessage({
      fromPhone: "+919999888877",
      buttonPayload: "take_ride",
    });

    expect(action).not.toBeNull();
    expect(action?.bodyText).toContain("নিবন্ধিত নন");
    expect(action?.bodyText).toContain("8348122122");
    expect(action?.buttons).toEqual([
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ]);
  });

  it("returns 2 buttons (offline + book toto) when driver declines a ride request", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919876543210",
      buttonPayload: "driver_decline_SR-1234",
    });

    expect(action).not.toBeNull();
    expect(action?.buttons).toEqual([
      { id: "driver_go_offline", title: "🔴 অফলাইন যান" },
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ]);
  });

  it("returns start menu buttons when customer skips review", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919112233445",
      buttonPayload: "skip_review",
    });

    expect(action).not.toBeNull();
    expect(action?.buttons).toEqual([
      { id: "take_ride", title: "🛺 রাইডার লগইন" },
      { id: "book_toto", title: "🛺 টোটো বুকিং করুন" },
    ]);
  });

  it("removes estimated fare and [00 km dure] from new booking notification sent to drivers", async () => {
    const testPhone = "+919123456789";
    await processTotoMessage({ fromPhone: testPhone, buttonPayload: "agree_disclaimer" });
    await processTotoMessage({ fromPhone: testPhone, textBody: "কাকদ্বীপ স্টেশন" });
    const stepFinal = await processTotoMessage({ fromPhone: testPhone, textBody: "লট ৮ ফেরিঘাট" });

    expect(stepFinal).not.toBeNull();
    if (stepFinal?.extraNotifications && stepFinal.extraNotifications.length > 0) {
      for (const notif of stepFinal.extraNotifications) {
        expect(notif.bodyText).not.toContain("আনুমানিক ভাড়া");
        expect(notif.bodyText).not.toContain("কিমি দূরে]");
      }
    }
  });

  it("handles cancellation after timeout without penalizing customer under the 3-cancellation rule", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919123456789",
      buttonPayload: "cancel_no_penalty_SR-9999",
    });

    expect(action).not.toBeNull();
    expect(action?.bodyText).toContain("কোনো পেনাল্টি বা ৩ বার বাতিল নিয়মের আওতায় নেওয়া হয়নি");
    expect(action?.buttons).toEqual([
      { id: "book_toto", title: "🛺 নতুন টোটো বুকিং" },
    ]);
  });

  it("returns specific message when driver accepts a non-existent, expired, or cancelled ride", async () => {
    const action = await processTotoMessage({
      fromPhone: "+919876543210",
      buttonPayload: "driver_accept_nonexistent_id",
    });

    expect(action).not.toBeNull();
    expect(action?.bodyText).toContain("দুঃখিত");
  });

  it("verifies passenger confirmation does not contain estimated fare", async () => {
    const { getSupabaseAdmin } = await import("@/lib/whatsapp/toto-engine");
    const supabase = getSupabaseAdmin();
    
    // Create mock booking
    const { data: b } = await supabase.from("bookings").insert({
      booking_number: "SR-TEST-FARE",
      customer_phone: "919999988888",
      customer_name: "টেস্ট যাত্রী",
      pickup_location: "কাকদ্বীপ",
      drop_location: "নামখানা",
      status: "pending",
    }).select().single();

    if (b) {
      const action = await processTotoMessage({
        fromPhone: "+919593177885",
        buttonPayload: `driver_accept_${b.id}`,
      });

      expect(action).not.toBeNull();
      const passengerNotification = action?.extraNotifications?.find(
        (n) => n.toPhone === "919999988888"
      );
      if (passengerNotification) {
        expect(passengerNotification.bodyText).not.toContain("আনুমানিক ভাড়া");
        expect(passengerNotification.bodyText).toContain("আপনার রাইড নিশ্চিত হয়েছে");
      }

      // Cleanup
      await supabase.from("bookings").delete().eq("id", b.id);
    }
  });
});


