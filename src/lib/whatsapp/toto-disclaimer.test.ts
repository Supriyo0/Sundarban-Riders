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
    // 919876543210 is a driver without agreed_terms in DB
    const action = await processTotoMessage({
      fromPhone: "+919876543210",
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
});
