"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Share2,
  Star,
  MessageSquare,
  AlertTriangle,
  Receipt,
  Car,
  Clock,
  MapPin,
  ChevronRight,
  Send,
  ThumbsUp,
  ShieldCheck,
  RefreshCw,
  X,
  QrCode,
  IndianRupee,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TripCompletionReceiptProps {
  tripId?: string;
  customerName: string;
  customerPhone: string;
  driverName: string;
  driverPhone: string;
  totoNumber: string;
  pickup: string;
  drop: string;
  distanceKm: number;
  fare: number;
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  durationMinutes?: number;
  completedAt?: string | Date;
  onBookAnother: () => void;
  role?: "rider" | "passenger";
}

function formatBengaliDateTime(d?: string | Date) {
  try {
    const dateObj = d ? (typeof d === "string" ? new Date(d) : d) : new Date();
    if (isNaN(dateObj.getTime())) return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const formattedDate = dateObj.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const formattedTime = dateObj.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${formattedDate}, ${formattedTime}`;
  } catch {
    return new Date().toLocaleString();
  }
}

export function TripCompletionReceipt({
  tripId = "SR-9412",
  customerName,
  customerPhone,
  driverName,
  driverPhone,
  totoNumber,
  pickup,
  drop,
  distanceKm,
  fare,
  estimatedDistanceKm,
  estimatedFare,
  durationMinutes = 12,
  completedAt,
  onBookAnother,
  role = "passenger",
}: TripCompletionReceiptProps) {
  // Rating State
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);

  // Feedback / Inquiry State
  const [activeTab, setActiveTab] = useState<"receipt" | "feedback" | "complaint">("receipt");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<string | null>(null);

  // Driver / Passenger Settlement States
  const [driverPaymentType, setDriverPaymentType] = useState<"cash" | "upi" | null>(null);
  const [showPassengerUpiQr, setShowPassengerUpiQr] = useState(false);
  const driverUpiQr = typeof window !== "undefined" ? localStorage.getItem("sr_driver_upi_qr") : null;
  const driverUpiId = (typeof window !== "undefined" ? localStorage.getItem("sr_driver_upi_id") : null) || "8348122122@ybl";
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(driverUpiId)}&pn=${encodeURIComponent(driverName)}&am=${fare}&cu=INR`;

  const compliments = [
    "🛺 মসৃণ ড্রাইভ",
    "⏱️ সঠিক সময়",
    "🤝 চমৎকার ব্যবহার",
    "🧼 পরিষ্কার টোটো",
    "🛡️ নিরাপদ ভ্রমণ",
  ];

  const toggleCompliment = (comp: string) => {
    if (selectedCompliments.includes(comp)) {
      setSelectedCompliments(selectedCompliments.filter((c) => c !== comp));
    } else {
      setSelectedCompliments([...selectedCompliments, comp]);
    }
  };

  // WhatsApp Receipt Share
  const handleShareReceiptOnWhatsApp = () => {
    const estNote = estimatedDistanceKm && estimatedDistanceKm !== distanceKm
      ? `\n📌 *প্রাথমিক বুকিং:* ${estimatedDistanceKm} কিমি (আনুমানিক ₹${estimatedFare || fare}.০০)`
      : "";

    const receiptMsg = `🧾 *সুন্দরবন রাইডার্স — ডিজিটাল রসিদ ও ট্রিপ সারাংশ*
==============================
🆔 রাইড নং: #${tripId}
📅 তারিখ ও সময়: ${formatBengaliDateTime(completedAt)}
👤 যাত্রী: ${customerName || "যাত্রী বন্ধু"}
📞 ফোন: ${customerPhone}
🛺 চালক: ${driverName} (${totoNumber})
📞 চালকের ফোন: ${driverPhone}

📍 *পিকআপ:* ${pickup}
🏁 *গন্তব্য:* ${drop}${estNote}
📏 *প্রকৃত ভ্রমণ দূরত্ব:* ${distanceKm} কিমি
⏱️ *মোট ভ্রমণের সময় (Accept to Finish):* ~${durationMinutes} মিনিট

💵 *ভাড়ার বিবরণ:*
- প্রদেয় চূড়ান্ত নগদ ভাড়া: ₹${fare}.০০ (সংগৃহীত)
==============================
সুন্দরবন রাইডার্সের সাথে ভ্রমণ করার জন্য ধন্যবাদ! নিরাপদ ও আরামদায়ক যাত্রা।`;

    const encoded = encodeURIComponent(receiptMsg);
    const targetPhone = (role === "rider" ? (customerPhone || driverPhone) : (driverPhone || customerPhone)).replace(/\D/g, "");
    const waUrl = targetPhone.length >= 10
      ? `https://wa.me/91${targetPhone.slice(-10)}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, "_blank");
    toast.success("হোয়াটসঅ্যাপে রসিদ পাঠানোর উইন্ডো ওপেন হয়েছে");
  };

  // Submit Driver Rating
  const handleSubmitRating = () => {
    setRatingSubmitted(true);
    toast.success(`ধন্যবাদ! আপনি চালক ${driverName}-কে ${rating} স্টার রেটিং দিয়েছেন।`);
  };

  // Submit Complaint / Suggestion to Admin Panel
  const handleSubmitFeedback = async (type: "suggestion" | "complaint") => {
    if (!feedbackText.trim()) {
      toast.error("অনুগ্রহ করে আপনার বক্তব্য লিখুন");
      return;
    }

    try {
      setFeedbackSubmitting(true);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          customer_name: customerName,
          customer_phone: customerPhone,
          message: `[রাইড #${tripId} | চালক: ${driverName}] ${feedbackText}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTicketResult(json.item.ticket);
        setFeedbackText("");
        toast.success(
          type === "complaint"
            ? `অভিযোগ নথিবদ্ধ হয়েছে! টিকিট নং: ${json.item.ticket}`
            : `পরামর্শ জমা হয়েছে! টিকিট নং: ${json.item.ticket}`
        );
      } else {
        toast.error("জমা দিতে সমস্যা হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="space-y-4 max-w-md mx-auto w-full">
        {/* Header Status */}
        <div className="relative text-center pt-2">
          <button
            type="button"
            onClick={onBookAnother}
            className="absolute top-0 right-0 w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-700 cursor-pointer shadow-xs transition-colors"
            title="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-md animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            ট্রিপ সফলভাবে সমাপ্ত!
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {role === "rider"
              ? "যাত্রীর থেকে নগদ ভাড়া সংগ্রহ করুন এবং পরবর্তী রাইডের জন্য প্রস্তুত হন।"
              : "সুন্দরবন রাইডার ব্যবহার করার জন্য ধন্যবাদ।"}
          </p>
        </div>

        {/* View Switcher Tabs (রসিদ | পরামর্শ | অভিযোগ) */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-2xl text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("receipt")}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === "receipt" ? "bg-white text-emerald-700 shadow-sm font-black" : "hover:text-slate-900"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>ডিজিটাল রসিদ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === "feedback" ? "bg-white text-blue-700 shadow-sm font-black" : "hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>পরামর্শ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("complaint")}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === "complaint" ? "bg-white text-red-700 shadow-sm font-black" : "hover:text-slate-900"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>অভিযোগ</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: RECEIPT & RATING VIEW                                  */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "receipt" && (
          <div className="space-y-4">
            {/* The Formal Receipt Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    রাইড আইডি
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900">#{tripId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    তারিখ ও সময়
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {formatBengaliDateTime(completedAt)}
                  </span>
                </div>
              </div>

              {/* Route Summary */}
              <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">পিকআপ</span>
                    <p className="font-bold text-slate-900 text-xs">{pickup}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">গন্তব্য</span>
                    <p className="font-bold text-slate-900 text-xs">{drop}</p>
                  </div>
                </div>
              </div>

              {/* Participant Box: Driver view shows Passenger info; Passenger view shows Driver info */}
              {role === "rider" ? (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                      👤
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">যাত্রীর বিবরণ (Passenger)</span>
                      <h5 className="font-bold text-slate-900 text-sm">{customerName || "যাত্রী বন্ধু"}</h5>
                      {customerPhone && (
                        <span className="font-mono font-bold text-blue-800 text-[11px]">+91 {customerPhone.replace(/\D/g, "").slice(-10)}</span>
                      )}
                    </div>
                  </div>
                  {customerPhone && (
                    <a
                      href={`tel:${customerPhone}`}
                      className="text-xs text-blue-700 bg-white px-3 py-1.5 rounded-xl border border-blue-300 font-bold flex items-center gap-1 shadow-2xs hover:bg-blue-50"
                    >
                      📞 কল করুন
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                      🛺
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">চালক ও টোটো</span>
                      <h5 className="font-bold text-slate-900">{driverName}</h5>
                      <span className="font-mono font-bold text-emerald-800 text-[11px]">{totoNumber}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                    ভেরিফায়েড চালক
                  </span>
                </div>
              )}

              {/* Initial vs Actual Realized Comparison (For early drop-off or extended distance) */}
              {estimatedDistanceKm !== undefined && estimatedFare !== undefined && (
                <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-600 font-semibold">
                    <span>📌 প্রাথমিক বুকিং অনুমান:</span>
                    <span className="font-mono text-slate-700">{estimatedDistanceKm} কিমি • ₹{estimatedFare}</span>
                  </div>
                  <div className="flex items-center justify-between font-black text-amber-950 pt-1 border-t border-amber-200">
                    <span>🏁 প্রকৃত ভ্রমণ ও স্থায়িত্ব:</span>
                    <span className="text-emerald-700 font-mono">{distanceKm} কিমি • ~{durationMinutes} মিনিট</span>
                  </div>
                </div>
              )}

              {/* Fare Breakdown */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>ভ্রমণ দূরত্ব (Travel Distance):</span>
                  <span className="font-bold text-slate-900">{distanceKm} কিমি</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>মোট ভ্রমণের সময় (Accept to Finish):</span>
                  <span className="font-bold text-slate-900">~{durationMinutes} মিনিট</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>চূড়ান্ত প্রদেয় নগদ ভাড়া (Final Cash Fare):</span>
                  <span className="text-emerald-600 text-lg">₹{fare}.০০</span>
                </div>
              </div>
            </div>

            {/* Share on WhatsApp Button */}
            <Button
              type="button"
              className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
              onClick={handleShareReceiptOnWhatsApp}
            >
              <Share2 className="w-4 h-4" />
              <span>📲 হোয়াটসঅ্যাপে রসিদ পাঠান / শেয়ার করুন</span>
            </Button>

            {role === "rider" ? (
              <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-3xl p-5 border-2 border-emerald-300 text-center space-y-3.5 shadow-sm">
                <span className="text-3xl">💰</span>
                <div>
                  <h4 className="font-extrabold text-base text-emerald-950">
                    ভাড়া সংগ্রহ নিশ্চিতকরণ: ₹{fare}.০০
                  </h4>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    যাত্রী {customerName}-এর কাছ থেকে কীভাবে ভাড়া পেয়েছেন সিলেক্ট করুন:
                  </p>
                </div>

                {driverPaymentType ? (
                  <div className="p-3 rounded-2xl bg-emerald-100/90 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      {driverPaymentType === "cash" ? "নগদে" : "UPI QR-এ"} ₹{fare}.০০ ভাড়া সংগ্রহ নিশ্চিত হয়েছে ✓
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDriverPaymentType("cash");
                        toast.success(`নগদ ভাড়া ₹${fare}.০০ সংগ্রহ কনফার্ম করা হয়েছে! 💵`);
                      }}
                      className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
                    >
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>নগদে পেয়েছি</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDriverPaymentType("upi");
                        toast.success(`UPI মাধ্যমে ₹${fare}.০০ ভাড়া সংগ্রহ কনফার্ম করা হয়েছে! 📲`);
                      }}
                      className="py-3 px-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition-all"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>UPI QR-এ পেয়েছি</span>
                    </button>
                  </div>
                )}

                {customerPhone && (
                  <div className="pt-1">
                    <a
                      href={`tel:${customerPhone}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold text-xs shadow-2xs hover:bg-emerald-100/50"
                    >
                      📞 যাত্রীকে ফোন করুন: +91 {customerPhone.replace(/\D/g, "").slice(-10)}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              /* Passenger UPI QR Settlement Card */
              <div className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 rounded-3xl p-4 border border-indigo-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950">চালকের UPI QR পেমেন্ট</h4>
                      <p className="text-[10px] text-indigo-700">PhonePe / GPay দিয়ে সরাসরি পে করুন</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassengerUpiQr((prev) => !prev)}
                    className="text-xs font-bold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-1 rounded-xl shadow-2xs hover:bg-indigo-50 transition-colors"
                  >
                    {showPassengerUpiQr ? "QR লুকান" : "QR দেখুন"}
                  </button>
                </div>

                {showPassengerUpiQr && (
                  <div className="pt-2 border-t border-indigo-100 text-center space-y-2 animate-in fade-in duration-200">
                    {driverUpiQr ? (
                      <div className="bg-white p-2 rounded-xl border border-indigo-200 shadow-xs inline-block mx-auto">
                        <img
                          src={driverUpiQr}
                          alt="Driver UPI QR"
                          className="w-32 h-32 object-contain mx-auto rounded-lg"
                        />
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-700 font-mono">UPI ID: {driverUpiId}</p>
                    )}
                    <a
                      href={upiDeepLink}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>PhonePe / GPay এ খুলুন (₹{fare})</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Driver Rating & Review Section (Only for passenger) */}
            {role !== "rider" && (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="text-center">
                  <h4 className="font-bold text-sm text-slate-900">
                    চালক {driverName}-কে রেটিং দিন
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    আপনার মতামত চালকের মান ও সুন্দরবনের পরিষেবা উন্নত করতে সাহায্য করে।
                  </p>
                </div>

                {/* Interactive 5-Star Selector */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      disabled={ratingSubmitted}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 text-amber-400 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          (hoverRating || rating) >= star
                            ? "fill-amber-400 text-amber-500"
                            : "text-slate-200"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Compliments Chips */}
                {!ratingSubmitted && (
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {compliments.map((comp) => (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => toggleCompliment(comp)}
                        className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                          selectedCompliments.includes(comp)
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {comp}
                      </button>
                    ))}
                  </div>
                )}

                {!ratingSubmitted ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-10 rounded-xl text-xs font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                    onClick={handleSubmitRating}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                    রেটিং জমা দিন ({rating} স্টার)
                  </Button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>রেটিং সফলভাবে জমা হয়েছে ✓</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: SUGGESTION / OPINION FORM                             */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "feedback" && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h4 className="font-bold text-base text-slate-900">মতামত বা পরামর্শ জানান</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                টোটো রুট, সার্ভিস বা সুন্দরবনের যাতায়াত নিয়ে আপনার কোনো পরামর্শ থাকলে লিখুন। অ্যাডমিন টিম সরাসরি তা খতিয়ে দেখবে।
              </p>
            </div>

            <Textarea
              rows={4}
              placeholder="আপনার মূল্যবান মতামত লিখুন..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm rounded-2xl p-3 text-slate-900 focus:bg-white resize-none"
            />

            {ticketResult && (
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-semibold space-y-1">
                <span className="block font-bold">পরামর্শ গ্রহণ করা হয়েছে!</span>
                <span>টিকিট আইডি: {ticketResult} (অ্যাডমিন ড্যাশবোর্ডে সংরক্ষিত)</span>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20"
              disabled={feedbackSubmitting}
              onClick={() => handleSubmitFeedback("suggestion")}
            >
              {feedbackSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              পরামর্শ সাবমিট করুন
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: COMPLAINT / INQUIRY / LOST ITEM FORM                   */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "complaint" && (
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">অভিযোগ বা অনুসন্ধান দাখিল</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                  গাড়িতে জিনিস ফেলে যাওয়া, অতিরিক্ত ভাড়া দাবি বা চালকের আচরণ সংক্রান্ত অভিযোগ সরাসরি অ্যাডমিনকে জানান।
                </p>
              </div>
            </div>

            <Textarea
              rows={4}
              placeholder="অভিযোগের বিস্তারিত কারণ বা হারানো সামগ্রীর বিবরণ লিখুন..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm rounded-2xl p-3 text-slate-900 focus:bg-white resize-none"
            />

            {ticketResult && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 font-semibold space-y-1">
                <span className="block font-bold text-red-700">⚠️ অফিসিয়াল অভিযোগ নথিবদ্ধ হয়েছে!</span>
                <span>টিকিট নং: {ticketResult}। কন্ট্রোল রুম থেকে দ্রুত আপনার সাথে ফোনে যোগাযোগ করা হবে।</span>
              </div>
            )}

            <Button
              className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20"
              disabled={feedbackSubmitting}
              onClick={() => handleSubmitFeedback("complaint")}
            >
              {feedbackSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-1.5" />
              )}
              অফিসিয়াল অভিযোগ দাখিল করুন
            </Button>
          </div>
        )}
      </div>

      {/* Book Another Ride Action Bar */}
      <div className="pt-4 max-w-md mx-auto w-full">
        <Button
          variant="outline"
          size="lg"
          className="w-full h-13 rounded-2xl border-slate-300 text-slate-800 font-bold text-sm bg-white hover:bg-slate-100 shadow-sm"
          onClick={onBookAnother}
        >
          <span>
            {role === "rider"
              ? "✅ পরবর্তী রাইডের জন্য প্রস্তুত (ডিউটিতে ফিরুন)"
              : "🛺 নতুন আরেকটি রাইড বুক করুন"}
          </span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Safe Area Clearance so action button is never obscured by bottom navbar */}
      <div className="h-32 w-full shrink-0" aria-hidden="true" />
    </div>
  );
}
