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
  X
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
  onBookAnother: () => void;
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
  onBookAnother,
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
    const receiptMsg = `🧾 *সুন্দরবন রাইডার — ক্যাব রসিদ ও ট্রিপ সারাংশ*
==============================
🆔 রাইড নং: #${tripId}
👤 যাত্রী: ${customerName || "যাত্রী বন্ধু"}
📞 ফোন: ${customerPhone}
🛺 চালক: ${driverName} (${totoNumber})
📞 চালকের ফোন: ${driverPhone}

📍 *পিকআপ:* ${pickup}
🏁 *গন্তব্য:* ${drop}
📏 *মোট দূরত্ব:* ${distanceKm} কিমি
⏱️ *ট্রিপ স্থায়িত্ব:* ~১২ মিনিট

💵 *ভাড়ার বিবরণ:*
- বেস ফেয়ার: ₹২০.০০
- দূরত্ব চার্জ: ₹${Math.max(0, fare - 20)}.00
------------------------------
💰 *মোট নগদ ভাড়া:* ₹${fare}.০০ (সংগৃহীত)
==============================
সুন্দরবন রাইডারের সাথে ভ্রমণ করার জন্য আপনাকে ধন্যবাদ! আপনার সুস্বাস্থ্য ও নিরাপদ যাত্রা কামনা করি।`;

    const encoded = encodeURIComponent(receiptMsg);
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const waUrl = cleanPhone.length >= 10
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encoded}`
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
        <div className="text-center pt-2">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-md animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            ট্রিপ সফলভাবে সমাপ্ত!
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            সুন্দরবন রাইডার ব্যবহার করার জন্য ধন্যবাদ।
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
                  <span className="text-xs font-semibold text-slate-700">আজ, রিয়েলটাইম</span>
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

              {/* Driver & Vehicle Box */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                    🛺
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">{driverName}</h5>
                    <span className="font-mono font-bold text-emerald-800 text-[11px]">{totoNumber}</span>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                  ভেরিফায়েড চালক
                </span>
              </div>

              {/* Fare Breakdown */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>বেস ফেয়ার (Base Fare):</span>
                  <span>₹২০.০০</span>
                </div>
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>দূরত্ব চার্জ ({distanceKm} কিমি):</span>
                  <span>₹{Math.max(0, fare - 20)}.০০</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>মোট নগদ ভাড়া (Cash Paid):</span>
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

            {/* Driver Rating & Review Section */}
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
          <span>🛺 নতুন আরেকটি রাইড বুক করুন</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Safe Area Clearance so action button is never obscured by bottom navbar */}
      <div className="h-32 w-full shrink-0" aria-hidden="true" />
    </div>
  );
}
