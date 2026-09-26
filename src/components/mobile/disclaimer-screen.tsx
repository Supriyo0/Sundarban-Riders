"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  CreditCard,
  Ban,
  PhoneCall,
  Sparkles,
  ArrowRight,
  ChevronRight,
  X,
  CheckSquare,
  Square,
  Car,
  User,
  HeartHandshake,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";

export interface DisclaimerItem {
  id: string;
  title: string;
  enTitle: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

export const PASSENGER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "p_fare",
    title: "স্বচ্ছ ভাড়া ও সঠিক অর্থপ্রদান",
    enTitle: "Transparent Fare & Payment",
    description:
      "সুন্দরবন রাইডার্স অ্যাপে দূরত্বের ভিত্তিতে প্রদর্শিত সঠিক নির্ধারিত ভাড়া যাত্রা সমাপ্তিতে চালককে সরাসরি নগদ (Cash) অথবা QR কোড / UPI মারফত পরিশোধ করতে বাধ্য থাকিব। চালকের সাথে অযৌক্তিক দরদাম বা ভাড়া নিয়ে বচসা করব না।",
    icon: CreditCard,
    badge: "ভাড়া নীতি",
  },
  {
    id: "p_conduct",
    title: "চালক ও টোটোর প্রতি সম্মান প্রদর্শন",
    enTitle: "Respect for Driver & Vehicle",
    description:
      "স্থানীয় পরিশ্রমী টোটো চালক বন্ধুদের সাথে সদাচরণ ও শালীনতা রক্ষা করব। টোটোর কোনো অভ্যন্তরীণ বা বহিরাগত ক্ষতিসাধন করব না এবং চালককে বিপজ্জনকভাবে দ্রুতগতিতে বা আইন অমান্য করে চালাতে বাধ্য করব না।",
    icon: HeartHandshake,
    badge: "আচরণ বিধি",
  },
  {
    id: "p_cancel",
    title: "যাত্রা চলাকালীন বাতিল নিষেধ",
    enTitle: "No Cancellation During Journey",
    description:
      "চালক পিকআপে আসার পূর্বে প্রয়োজনবোধে ট্রিপ বাতিল করা যাবে; কিন্তু একবার যাত্রা (Trip) শুরু হয়ে গেলে আর কোনোভাবেই ট্রিপ বাতিল করা যাবে না। কেবল গন্তব্যে পৌঁছানোর পর চালকের মাধ্যমে যাত্রা সম্পন্ন হবে।",
    icon: Ban,
    badge: "বাতিল নীতি",
  },
  {
    id: "p_safety",
    title: "জরুরি সুরক্ষা ও SOS অধিকার",
    enTitle: "Emergency & SOS Safety Rights",
    description:
      "যাত্রাপথে যেকোনো ধরনের জরুরি পরিস্থিতি বা নিরাপত্তা সংকটে অ্যাপের ভেতরে থাকা জরুরি SOS সুরক্ষা বোতাম ব্যবহার করে স্থানীয় পুলিশ (১১২), মহিলা হেল্পলাইন (১০৯১) বা সুন্দরবন রাইডার্স হেল্পলাইনের সহায়তা নেওয়ার অধিকার আমার আছে।",
    icon: ShieldCheck,
    badge: "সুরক্ষা নীতি",
  },
  {
    id: "p_info",
    title: "সঠিক লোকেশন ও সক্রিয় যোগাযোগ",
    enTitle: "Accurate Location & Live Contact",
    description:
      "আমার পিকআপ পয়েন্ট ও গন্তব্যের সঠিক তথ্য প্রদান করব এবং বুকিংয়ের সময় প্রদত্ত সক্রিয় WhatsApp নম্বরে চালকের ফোন বা বার্তার উত্তর দিতে সচেষ্ট থাকব যাতে মসৃণ পিকআপ সম্ভব হয়।",
    icon: UserCheck,
    badge: "যোগাযোগ নীতি",
  },
];

export const RIDER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "r_kyc",
    title: "বৈধ টোটো নম্বর ও আসল KYC তথ্য",
    enTitle: "Valid Toto Registration & KYC Verification",
    description:
      "আমার টোটোর লাইসেন্স/পৌর বা পঞ্চায়েত রেজিস্ট্রেশন নম্বর, আধার কার্ড এবং সমস্ত দাখিলকৃত নথিপত্র সম্পূর্ণ সত্য ও নির্ভুল। কোনো ভুয়ো বা অন্য কারো তথ্য প্ল্যাটফর্মে ব্যবহারের জন্য আমি সম্পূর্ণ দায়বদ্ধ থাকব।",
    icon: Scale,
    badge: "বৈধতা নীতি",
  },
  {
    id: "r_safety",
    title: "যাত্রী সুরক্ষা ও নিরাপদ চালনা",
    enTitle: "Passenger Safety & Safe Driving",
    description:
      "অতিরিক্ত যাত্রী বোঝাই করব না। ট্রাফিকের গতিসীমা মেনে চলব এবং কোনো অবস্থাতেই মাদকাসক্ত বা মাতাল অবস্থায় টোটো চালাব না। যাত্রী ওঠানামার সময় গাড়ি সম্পূর্ণ থামিয়ে নিরাপদ স্থান নির্বাচন করব।",
    icon: ShieldCheck,
    badge: "চালনা বিধি",
  },
  {
    id: "r_fare",
    title: "ন্যায্য ভাড়া ও অতিরিক্ত টাকা দাবি নিষেধ",
    enTitle: "Fair Meter Pricing — No Overcharging",
    description:
      "সুন্দরবন রাইডার্স অ্যাপের ডিজিটাল হিসাব অনুযায়ী প্রদর্শিত ভাড়ার অতিরিক্ত কোনো বাড়তি অর্থ যাত্রীর থেকে দাবি করব না। নগদ বা ডিজিটাল লেনদেনে সর্বদা স্বচ্ছতা বজায় রাখব।",
    icon: CreditCard,
    badge: "ন্যায্যতা নীতি",
  },
  {
    id: "r_conduct",
    title: "যাত্রীদের সর্বোচ্চ সম্মান ও সংবেদনশীলতা",
    enTitle: "Respectful Service for All Passengers",
    description:
      "সকল যাত্রী—বিশেষ করে মহিলা, প্রবীণ ও শিশু যাত্রীদের প্রতি সর্বোচ্চ নিরাপত্তা ও সম্মান প্রদর্শন করব। কোনো যাত্রীর সাথে দুর্ব্যবহার বা অসংবেদনশীল আচরণ করব না।",
    icon: HeartHandshake,
    badge: "মর্যাদা বিধি",
  },
  {
    id: "r_finish",
    title: "দায়িত্বশীল ট্রিপ সমাপ্তি ও সততা",
    enTitle: "Honest Trip Completion & Lost Property",
    description:
      "যাত্রী নিরাপদে গন্তব্যে পৌঁছানোর পরেই কেবল নিজের অ্যাপ থেকে ট্রিপ সমাপ্ত করব। টোটোতে যাত্রীর কোনো জিনিসপত্র ভুলে ফেলে যাওয়া হলে তা সাথে সাথে যাত্রীকে ফেরত দেব বা সুন্দরবন রাইডার্স হেল্পলাইনে জমা দেব।",
    icon: AlertTriangle,
    badge: "দায়িত্ব নীতি",
  },
];

// Helper functions for disclaimer storage in localStorage
export function getDisclaimerStorageKey(role: "rider" | "passenger", phone?: string): string {
  const clean = phone ? phone.replace(/\D/g, "").slice(-10) : "";
  return clean ? `sr_disclaimer_accepted_${role}_${clean}` : `sr_disclaimer_accepted_${role}`;
}

export function hasUserAcceptedDisclaimer(role: "rider" | "passenger", phone?: string): boolean {
  if (typeof window === "undefined") return false;
  const specificKey = getDisclaimerStorageKey(role, phone);
  if (localStorage.getItem(specificKey) === "true") return true;
  // Also check global fallback for this role
  if (localStorage.getItem(`sr_disclaimer_accepted_${role}`) === "true") return true;
  return false;
}

export function setUserAcceptedDisclaimer(role: "rider" | "passenger", phone?: string): void {
  if (typeof window === "undefined") return;
  const specificKey = getDisclaimerStorageKey(role, phone);
  localStorage.setItem(specificKey, "true");
  localStorage.setItem(`sr_disclaimer_accepted_${role}`, "true");
}

interface DisclaimerScreenProps {
  role: "rider" | "passenger";
  phone?: string;
  onAccept: () => void;
  onBack?: () => void;
}

export function DisclaimerScreen({ role, phone, onAccept, onBack }: DisclaimerScreenProps) {
  const items = role === "rider" ? RIDER_DISCLAIMERS : PASSENGER_DISCLAIMERS;
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const allChecked = items.every((item) => checkedIds[item.id]);
  const checkedCount = items.filter((item) => checkedIds[item.id]).length;

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = () => {
    if (allChecked) {
      setCheckedIds({});
    } else {
      const all: Record<string, boolean> = {};
      items.forEach((item) => {
        all[item.id] = true;
      });
      setCheckedIds(all);
    }
  };

  const handleSubmit = () => {
    if (!allChecked) return;
    setUserAcceptedDisclaimer(role, phone);
    onAccept();
  };

  return (
    <div
      className="min-h-full flex-1 text-slate-900 flex flex-col justify-between select-none"
      style={{
        background:
          role === "rider"
            ? "linear-gradient(180deg, #fefce8 0%, #f8fafc 35%, #ffffff 100%)"
            : "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 35%, #ffffff 100%)",
      }}
    >
      {/* Top Header Bar */}
      <div className="px-5 pt-4 pb-2 border-b border-slate-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95"
            >
              ← ফিরে যান
            </button>
          ) : (
            <div />
          )}
          <SundarbanLogo size="sm" variant="badge" showTagline={false} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 pt-4 pb-32 max-w-md mx-auto w-full space-y-4">
        {/* Role Pill & Title */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                role === "rider"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}
            >
              {role === "rider" ? "🛺 চালক পার্টনার নির্দেশিকা" : "👤 যাত্রী সুরক্ষা নির্দেশিকা"}
            </span>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              বাধ্যতামূলক সম্মতি
            </span>
          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
            {role === "rider"
              ? "সুন্দরবন চালক পার্টনার নিয়মাবলী ও শর্তাবলী"
              : "সুন্দরবন যাত্রী সুরক্ষা ও ব্যবহারের শর্তাবলী"}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {role === "rider"
              ? "সুন্দরবন রাইডার্স প্ল্যাটফর্মে একজন দায়িত্বশীল চালক হিসেবে যুক্ত হতে নিচের প্রতিটি শর্ত মনোযোগ দিয়ে পড়ুন এবং সবকটিতে টিক চিহ্ন দিন।"
              : "সুন্দরবন রাইডার্সের মাধ্যমে নিরাপদ ও আনন্দদায়ক টোটো ভ্রমণ উপভোগ করতে নিচের নীতিমালায় সম্মতি জানানো আবশ্যক।"}
          </p>
        </div>

        {/* Quick Select All Button */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                allChecked
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {checkedCount}/{items.length}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {allChecked ? "সবকটি শর্ত নির্বাচিত হয়েছে" : "প্রতিটি শর্তে টিক চিহ্ন দিন"}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                এগিয়ে যেতে {items.length} টি শর্তই গ্রহণ করতে হবে
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            className={`text-xs font-black px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              allChecked
                ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            }`}
          >
            {allChecked ? "নির্বাচন সরান" : "সবকটি টিক দিন"}
          </button>
        </div>

        {/* Disclaimer Checkbox Cards */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const isChecked = Boolean(checkedIds[item.id]);
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                  isChecked
                    ? "bg-emerald-50/60 border-emerald-300 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Custom Checkbox */}
                  <div className="pt-0.5 shrink-0">
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                        isChecked
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-500/30"
                          : "border-2 border-slate-300 bg-white"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400 font-mono">
                          #{idx + 1}
                        </span>
                        <h3
                          className={`text-xs font-black leading-snug transition-colors ${
                            isChecked ? "text-emerald-950" : "text-slate-900"
                          }`}
                        >
                          {item.title}
                        </h3>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Assurance Note */}
        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5 text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            সুন্দরবন রাইডার্স সুন্দরবনবাসীর জন্য একটি সৎ, নিরাপদ ও সমন্বিত ই-রিকশা প্ল্যাটফর্ম। আপনার এই সম্মতি প্ল্যাটফর্মের নিরাপত্তা বজায় রাখতে সাহায্য করে।
          </p>
        </div>
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 shadow-xl z-30">
        <div className="max-w-md mx-auto space-y-2">
          <Button
            size="lg"
            disabled={!allChecked}
            onClick={handleSubmit}
            className={`w-full h-13 rounded-2xl font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              allChecked
                ? role === "rider"
                  ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-400/30 active:scale-98"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-98"
                : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
            }`}
          >
            {allChecked ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>আমি সম্পূর্ণ সম্মত ও গ্রহণ করলাম</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <span>বাকি {items.length - checkedCount} টি শর্তে টিক দিন</span>
            )}
          </Button>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            শর্তাবলী গ্রহণের পর সরাসরি আপনার একাউন্টে প্রবেশ করতে পারবেন
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW-ANYTIME MODAL: Allows inspecting Passenger or Rider Disclaimers anytime
// ---------------------------------------------------------------------------
interface DisclaimerViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: "rider" | "passenger";
}

export function DisclaimerViewerModal({
  isOpen,
  onClose,
  defaultRole = "passenger",
}: DisclaimerViewerModalProps) {
  const [activeTab, setActiveTab] = useState<"passenger" | "rider">(defaultRole);

  useEffect(() => {
    setActiveTab(defaultRole);
  }, [defaultRole, isOpen]);

  if (!isOpen) return null;

  const items = activeTab === "rider" ? RIDER_DISCLAIMERS : PASSENGER_DISCLAIMERS;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
              📜
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-none">
                নিয়ম ও নির্দেশিকা (Disclaimers)
              </h2>
              <span className="text-[10px] text-slate-500 font-medium">
                সুন্দরবন রাইডার্স ব্যবহারের শর্তাবলী
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-3 bg-white border-b border-slate-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("passenger")}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
              activeTab === "passenger"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>👤 যাত্রী নির্দেশিকা</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rider")}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
              activeTab === "rider"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>🛺 চালক নির্দেশিকা</span>
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            {activeTab === "passenger"
              ? "টোটো বুকিং ও ভ্রমণের সময় সুন্দরবন যাত্রীদের নিরাপত্তা ও সেবামূলক অধিকার:"
              : "সুন্দরবন চালক পার্টনার হিসেবে প্ল্যাটফর্মে যাত্রী পরিবহনের দায়িত্ব ও সুরক্ষা বিধিমালা:"}
          </div>

          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pl-8">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <Button
            size="sm"
            onClick={onClose}
            className="w-full h-10 rounded-xl bg-slate-900 text-white font-bold text-xs"
          >
            ঠিক আছে, বন্ধ করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
