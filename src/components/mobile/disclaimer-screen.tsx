"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  CreditCard,
  Ban,
  Sparkles,
  ArrowRight,
  ChevronDown,
  X,
  Car,
  User,
  HeartHandshake,
  AlertTriangle,
  Scale,
  Download,
  Lock,
  Unlock,
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

// ---------------------------------------------------------------------------
// PASSENGER DISCLAIMERS (6 Comprehensive Sections from Official Customer PDF)
// ---------------------------------------------------------------------------
export const PASSENGER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "p_platform_role",
    title: "১. প্ল্যাটফর্মের ভূমিকা ও দায়মুক্তি",
    enTitle: "Platform Role & Limited Liability",
    description:
      "সুন্দরবন রাইডার্স কোনো পরিবহন সংস্থা বা গাড়ির মালিক নয়। এটি একটি ডিজিটাল প্রযুক্তি মাধ্যম যা যাত্রী ও স্থানীয় স্বাধীন টোটো চালকদের মধ্যে সরাসরি সংযোগ স্থাপন করে। যাত্রাপথে কোনো দুর্ঘটনা, শারীরিক আঘাত, অপ্রত্যাশিত ঘটনা বা মূল্যবান মালামাল চুরি/হারিয়ে যাওয়ার ক্ষেত্রে সুন্দরবন রাইডার্স প্ল্যাটফর্ম কর্তৃপক্ষ সরাসরি কোনোভাবেই দায়বদ্ধ থাকবে না।",
    icon: Scale,
    badge: "ভূমিকা ও দায়মুক্তি",
  },
  {
    id: "p_fare_extra_night",
    title: "২. ভাড়া, অতিরিক্ত যাত্রী ও নাইট চার্জ সংক্রান্ত নিয়ম",
    enTitle: "Fare, Extra Passenger & Night Charge Policy",
    description:
      "যাত্রী অ্যাপের ডিজিটাল ফেয়ার মিটার অনুযায়ী প্রদর্শিত নির্ধারিত ভাড়া পরিশোধ করতে বাধ্য থাকিবেন। তবে যাত্রীর অনুরোধে বা প্রয়োজন সাপেক্ষে ১ জনের বেশি অতিরিক্ত যাত্রী তোলা হলে চালক যাত্রী প্রতি অতিরিক্ত ১০ টাকা এবং রাত ৯টার পর থেকে ভোর ৬টা পর্যন্ত অ্যাপে নির্ধারিত নাইট চার্জ (Night Charge) বাবদ বাড়তি ১০ টাকা গ্রহণ করতে পারেন।",
    icon: CreditCard,
    badge: "ভাড়া ও চার্জ",
  },
  {
    id: "p_respect_conduct",
    title: "৩. চালক ও টোটোর প্রতি সম্মান প্রদর্শন",
    enTitle: "Respect for Driver & Vehicle",
    description:
      "স্থানীয় পরিশ্রমী টোটো চালক বন্ধুদের সাথে সর্বদা শালীন ও সম্মানজনক আচরণ বজায় রাখতে হবে। টোটোর কোনো অভ্যন্তরীণ বা বহিরাগত ক্ষতিসাধন করা যাবে না এবং চালককে বিপজ্জনকভাবে বা আইন অমান্য করে দ্রুতগতিতে গাড়ি চালাতে বাধ্য করা যাবে না।",
    icon: HeartHandshake,
    badge: "আচরণ বিধি",
  },
  {
    id: "p_no_cancel_enroute",
    title: "৪. যাত্রা চলাকালীন বাতিল নিষেধ",
    enTitle: "No Cancellation During Journey",
    description:
      "চালক পিকআপে আসার পূর্বে প্রয়োজনবোধে ট্রিপ বাতিল করা যাবে; কিন্তু একবার যাত্রা (Trip) শুরু হয়ে গেলে আর কোনোভাবেই ট্রিপ বাতিল করা যাবে না। কেবল গন্তব্যে পৌঁছানোর পরেই চালকের মাধ্যমে যাত্রা সম্পন্ন হবে।",
    icon: Ban,
    badge: "বাতিল নীতি",
  },
  {
    id: "p_safety_sos",
    title: "৫. জরুরি সুরক্ষা ও SOS অধিকার",
    enTitle: "Emergency & SOS Safety Rights",
    description:
      "যাত্রাপথে যেকোনো ধরনের জরুরি পরিস্থিতি বা নিরাপত্তা সংকটে অ্যাপের ভেতরে থাকা জরুরি SOS সুরক্ষা বোতাম ব্যবহার করে স্থানীয় পুলিশ (১১২), মহিলা হেল্পলাইন (১০৯১) বা সুন্দরবন রাইডার্স হেল্পলাইনের তাৎক্ষণিক সহায়তা নেওয়ার পূর্ণ অধিকার আপনার আছে।",
    icon: ShieldCheck,
    badge: "জরুরি সুরক্ষা",
  },
  {
    id: "p_accurate_location",
    title: "৬. সঠিক লোকেশন ও সক্রিয় যোগাযোগ",
    enTitle: "Accurate Location & Live Contact",
    description:
      "বুকিংয়ের সময় পিকআপ পয়েন্ট ও গন্তব্যের সঠিক তথ্য প্রদান করবেন এবং চালকের ফোন বা বার্তার যথাযথ উত্তর দিয়ে মসৃণ পিকআপে সক্রিয় সহযোগিতা করবেন।",
    icon: UserCheck,
    badge: "যোগাযোগ নীতি",
  },
];

// ---------------------------------------------------------------------------
// RIDER DISCLAIMERS (14 Comprehensive Sections from Official Rider PDF)
// ---------------------------------------------------------------------------
export const RIDER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "r_independent",
    title: "১. স্বাধীন পরিষেবা প্রদানকারী",
    enTitle: "Independent Service Provider",
    description:
      "চালক সুন্দরবন রাইডার্স প্ল্যাটফর্মের কোনো স্থায়ী কর্মী বা কর্মচারী নন। তিনি একজন সম্পূর্ণ স্বাধীন পরিষেবা প্রদানকারী (Independent Contractor) এবং স্ব-উদ্যোগে নিজ টোটোর মাধ্যমে যাত্রী পরিবহন পরিষেবা প্রদান করেন।",
    icon: User,
    badge: "স্বাধীন চালক",
  },
  {
    id: "r_no_liability",
    title: "২. দায়বদ্ধতা বর্জন",
    enTitle: "No Liability Disclaimer",
    description:
      "টোটো চালনা বা যাত্রাপথে সংঘটিত কোনো প্রকার দুর্ঘটনা, শারীরিক আঘাত, ক্ষয়ক্ষতি, ট্রাফিক আইন লঙ্ঘন, চালান বা আইনি জটিলতার জন্য সুন্দরবন রাইডার্স প্ল্যাটফর্ম কর্তৃপক্ষ কোনোভাবেই প্রত্যক্ষ বা পরোক্ষভাবে দায়ী থাকবে না। চালক নিজ দায়িত্বে সমস্ত ঝুঁকি বহন করবেন।",
    icon: Scale,
    badge: "দায়মুক্তি",
  },
  {
    id: "r_flexibility",
    title: "৩. চালকের কাজের স্বাধীনতা ও নমনীয়তা",
    enTitle: "Driver Freedom & Flexibility",
    description:
      "চালক নিজের ইচ্ছানুযায়ী যেকোনো সময় অনলাইন বা অফলাইন হতে পারেন। ডিউটির সময় নির্ধারণ চালকের সম্পূর্ণ ব্যক্তিগত এখতিয়ার। প্ল্যাটফর্মের পক্ষ থেকে কোনো নির্দিষ্ট কর্মঘণ্টা বা বাধ্যবাধকতা আরোপ করা হয় না।",
    icon: Sparkles,
    badge: "কাজের স্বাধীনতা",
  },
  {
    id: "r_leave_freedom",
    title: "৪. প্ল্যাটফর্ম ত্যাগ বা চুক্তি বাতিলের স্বাধীনতা",
    enTitle: "Freedom to Leave Platform",
    description:
      "চালক চাইলে যেকোনো সময় কোনো পূর্বশর্ত ছাড়াই সুন্দরবন রাইডার্স প্ল্যাটফর্ম ব্যবহার বন্ধ করতে বা প্ল্যাটফর্ম ত্যাগ করতে সম্পূর্ণ স্বাধীন। কোনো জরিমানা বা বাধ্যবাধকতা প্রযোজ্য হবে না।",
    icon: Ban,
    badge: "বাতিল স্বাধীনতা",
  },
  {
    id: "r_driver_safety",
    title: "৫. চালকের সুরক্ষা ও ন্যায্য অধিকার",
    enTitle: "Driver Safety & Fair Rights",
    description:
      "চালকের নিজস্ব নিরাপত্তা রক্ষার পূর্ণ অধিকার রয়েছে। কোনো যাত্রী অভব্য আচরণ করলে, মাদকাসক্ত অবস্থায় থাকলে, নিরাপত্তা বিঘ্নিত করার চেষ্টা করলে অথবা চালককে বিপজ্জনক বা বেআইনি পথে গাড়ি চালাতে বাধ্য করলে চালক তাৎক্ষণিকভাবে বুকিং বাতিল করার এবং যাত্রা প্রত্যাখ্যান করার অধিকার রাখেন।",
    icon: ShieldCheck,
    badge: "চালকের সুরক্ষা",
  },
  {
    id: "r_fair_earnings",
    title: "৬. ন্যায্য ভাড়া প্রাপ্তি",
    enTitle: "Right to Fair Earnings",
    description:
      "চালক অ্যাপ বা প্ল্যাটফর্মের নির্ধারিত ডিজিটাল ফেয়ার মিটার অনুযায়ী যাত্রীর কাছ থেকে সম্পূর্ণ ভাড়া নগদ (Cash) বা UPI মাধ্যমে সরাসরি গ্রহণ করবেন। যাত্রী নির্ধারিত ভাড়া দিতে অস্বীকার করলে চালক অভিযোগ জানানোর অধিকার রাখেন।",
    icon: CreditCard,
    badge: "ন্যায্য ভাড়া",
  },
  {
    id: "r_compliance",
    title: "৭. নিরাপত্তা ও আইন মান্য করা",
    enTitle: "Safety & Traffic Compliance",
    description:
      "চালক সর্বদা ট্রাফিক নিয়মাবলী, গতিসীমা এবং সরকারি আইন মেনে চলবেন। কোনো অবস্থাতেই মাদকাসক্ত বা নেশাগ্রস্ত অবস্থায় গাড়ি চালানো যাবে না।",
    icon: AlertTriangle,
    badge: "আইন মান্যতা",
  },
  {
    id: "r_conduct",
    title: "৮. যাত্রী সংক্রান্ত আচরণ",
    enTitle: "Passenger Conduct & Courtesy",
    description:
      "সকল যাত্রী—বিশেষ করে মহিলা, প্রবীণ ও শিশুদের প্রতি সম্মানজনক ও শালীন আচরণ প্রদর্শন করতে হবে। যাত্রীদের সাথে কোনো প্রকার দুর্ব্যবহার বা অসদাচরণ করা যাবে না।",
    icon: HeartHandshake,
    badge: "মর্যাদা বিধি",
  },
  {
    id: "r_platform_fee",
    title: "৯. প্রযুক্তিগত সহায়তা ফি",
    enTitle: "Platform Tech Fee",
    description:
      "প্ল্যাটফর্ম ব্যবহারের সুবিধা এবং প্রযুক্তিগত রক্ষণাবেক্ষণের জন্য চালক কর্তৃপক্ষ কর্তৃক নির্ধারিত সামান্য প্ল্যাটফর্ম ফি প্রদান করতে সম্মত থাকবেন (যদি প্রযোজ্য হয়)।",
    icon: CreditCard,
    badge: "প্ল্যাটফর্ম ফি",
  },
  {
    id: "r_legal_cooperation",
    title: "১০. আইনি সুরক্ষা ও সহযোগিতার সম্মতি",
    enTitle: "Legal Co-operation & Safety",
    description:
      "যাত্রী সুরক্ষা বা কোনো অভিযোগের তদন্তে পুলিশ প্রশাসন বা আইন প্রয়োগকারী সংস্থার প্রয়োজনে প্ল্যাটফর্ম কর্তৃপক্ষ চালকের প্রয়োজনীয় তথ্য সরবরাহ করতে পারবে এবং চালক তাতে পূর্ণ সহযোগিতা করতে বাধ্য থাকবেন।",
    icon: Scale,
    badge: "আইনি সুরক্ষা",
  },
  {
    id: "r_privacy",
    title: "১১. যাত্রীর তথ্য সুরক্ষা ও দায়মুক্তি",
    enTitle: "Passenger Privacy & Exemption",
    description:
      "যাত্রীর ফোন নম্বর বা ব্যক্তিগত তথ্য কোনো ব্যক্তিগত উদ্দেশ্যে ব্যবহার করা সম্পূর্ণ নিষিদ্ধ। কোনো যাত্রীর ব্যক্তিগত অসদাচরণ বা অনৈতিক কাজের দায়ভার চালকের ওপর বর্তাবে না।",
    icon: UserCheck,
    badge: "তথ্য সুরক্ষা",
  },
  {
    id: "r_cancel_policy",
    title: "১২. যাত্রা বাতিল ও ক্ষতিপূরণ নীতি",
    enTitle: "Cancellation & Compensation",
    description:
      "চালক পিকআপ লোকেশনে পৌঁছানোর পর যাত্রী কোনো যুক্তিসঙ্গত কারণ ছাড়া বুকিং বাতিল করলে বা অনুপস্থিত থাকলে চালক নিয়মমাফিক প্ল্যাটফর্ম সহায়তার জন্য আবেদন করতে পারেন।",
    icon: Ban,
    badge: "বাতিল ক্ষতিপূরণ",
  },
  {
    id: "r_driver_cancel",
    title: "১৩. চালক কর্তৃক বাতিল",
    enTitle: "Driver Cancellation Restrictions",
    description:
      "অত্যন্ত জরুরি পরিস্থিতি (যেমন—গাড়ির যান্ত্রিক ত্রুটি বা শারীরিক অসুস্থতা) ছাড়া ঘনঘন বুকিং গ্রহণ করে বাতিল করা থেকে বিরত থাকতে হবে।",
    icon: AlertTriangle,
    badge: "দায়িত্ব নীতি",
  },
  {
    id: "r_declaration",
    title: "১৪. চূড়ান্ত ঘোষণা ও সম্মতি",
    enTitle: "Final Declaration & Consent",
    description:
      "আমি সুন্দরবন রাইডার্স প্ল্যাটফর্মের সমস্ত শর্তাবলি, নিয়মাবলী ও আইনি দায়মুক্তি ভালো করে পড়েছি ও বুঝেছি এবং এতে স্বেচ্ছায় ও সম্পূর্ণভাবে সম্মতি প্রদান করছি।",
    icon: CheckCircle2,
    badge: "ঘোষণা",
  },
];

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------
export function getDisclaimerStorageKey(role: "rider" | "passenger", phone?: string): string {
  const clean = phone ? phone.replace(/\D/g, "").slice(-10) : "";
  return clean ? `sr_disclaimer_accepted_${role}_${clean}` : `sr_disclaimer_accepted_${role}`;
}

export function hasUserAcceptedDisclaimer(role: "rider" | "passenger", phone?: string): boolean {
  if (typeof window === "undefined") return false;
  const specificKey = getDisclaimerStorageKey(role, phone);
  if (localStorage.getItem(specificKey) === "true") return true;
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
  const pdfUrl = role === "rider" ? "/rider-disclaimer.pdf" : "/customer-disclaimer.pdf";
  const pdfName = role === "rider" ? "FINAL RIDER DISCLAIMER 28-09-26.pdf" : "COUSTOMER DISCLAIMER 28-09-26.pdf";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [showScrollWarning, setShowScrollWarning] = useState(false);

  // Monitor scroll position
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 45;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
      setShowScrollWarning(false);
    }
  };

  // Initial check in case screen is very tall and already shows all items
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      if (el.scrollHeight <= el.clientHeight + 40) {
        setHasScrolledToBottom(true);
      }
    }
  }, [items]);

  const handleAgreementToggle = () => {
    if (!hasScrolledToBottom) {
      setShowScrollWarning(true);
      // Auto scroll smoothly to bottom
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      setTimeout(() => setShowScrollWarning(false), 4000);
      return;
    }
    setIsAgreed((prev) => !prev);
  };

  const scrollToBottomExplicitly = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleSubmit = () => {
    if (!hasScrolledToBottom || !isAgreed) return;
    setUserAcceptedDisclaimer(role, phone);
    onAccept();
  };

  return (
    <div
      className="min-h-screen flex-1 text-slate-900 flex flex-col justify-between select-none"
      style={{
        background:
          role === "rider"
            ? "linear-gradient(180deg, #fefce8 0%, #f8fafc 35%, #ffffff 100%)"
            : "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 35%, #ffffff 100%)",
      }}
    >
      {/* Top Header Bar */}
      <div className="px-5 pt-4 pb-2 border-b border-slate-200/70 bg-white/85 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              ← ফিরে যান
            </button>
          ) : (
            <div />
          )}
          <SundarbanLogo size="sm" variant="badge" showTagline={false} />
        </div>
      </div>

      {/* Main Scrollable Content Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-3 pb-36 max-w-md mx-auto w-full space-y-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Role Pill & Title */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                role === "rider"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              }`}
            >
              {role === "rider" ? "🛺 চালক পার্টনার চুক্তি ও নিয়মাবলী" : "👤 যাত্রী সুরক্ষা ও ব্যবহারের শর্তাবলী"}
            </span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>PDF ডাউনলোড</span>
            </a>
          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
            {role === "rider"
              ? "সুন্দরবন চালক পার্টনার চুক্তি ও আইনি দায়মুক্তি"
              : "সুন্দরবন যাত্রী সুরক্ষা ও ব্যবহারের শর্তাবলী"}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {role === "rider"
              ? "সুন্দরবন রাইডার্স প্ল্যাটফর্মে পরিষেবা শুরু করার পূর্বে নিচের ১৪টি শর্ত মনোযোগ সহকারে সম্পূর্ণ নিচে স্ক্রোল করে পড়ুন এবং সম্মতি দিন।"
              : "সুন্দরবন রাইডার্সের মাধ্যমে নিরাপদ ও আনন্দদায়ক টোটো যাত্রা উপভোগ করতে নিচের ৬টি শর্তাবলী সম্পূর্ণ নিচে স্ক্রোল করে পড়ে সম্মতি দিন।"}
          </p>
        </div>

        {/* Scroll Progress Banner */}
        <div
          className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
            hasScrolledToBottom
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
              : "bg-amber-50 border-amber-300 text-amber-900 shadow-2xs"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                hasScrolledToBottom
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-slate-950"
              }`}
            >
              {hasScrolledToBottom ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-black">
                {hasScrolledToBottom
                  ? "✅ শর্তাবলী সম্পূর্ণ পড়া হয়েছে (টিক দিন)"
                  : `📜 মোট ${items.length}টি শর্ত সম্পূর্ণ নিচে স্ক্রোল করুন`}
              </div>
              <div className="text-[10px] opacity-80 font-medium">
                {hasScrolledToBottom
                  ? "নিচের বক্সে টিক দিয়ে সম্মত হয়ে সাবমিট করুন"
                  : "পুরো শর্তাবলী পড়ার আগে সম্মতি দেওয়া যাবে না"}
              </div>
            </div>
          </div>

          {!hasScrolledToBottom && (
            <button
              type="button"
              onClick={scrollToBottomExplicitly}
              className="text-[11px] font-black bg-amber-200/80 hover:bg-amber-300 text-amber-950 px-2.5 py-1.5 rounded-xl border border-amber-300/80 flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <span>নিচে যান</span>
              <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
            </button>
          )}
        </div>

        {/* Scroll warning alert if user tries to check prematurely */}
        {showScrollWarning && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>অনুগ্রহ করে সমস্ত শর্তাবলী পড়ার জন্য সম্পূর্ণ নিচে স্ক্রোল করুন!</span>
          </div>
        )}

        {/* Disclaimer Items List */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        role === "rider"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed font-normal pl-8">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Final Consent Box (Locked until bottom is reached) */}
        <div
          onClick={handleAgreementToggle}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none text-left ${
            !hasScrolledToBottom
              ? "bg-slate-100/80 border-slate-300 opacity-80"
              : isAgreed
              ? "bg-emerald-50/90 border-emerald-400 shadow-sm"
              : "bg-white border-slate-300 hover:border-slate-400 shadow-2xs"
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Custom Checkbox */}
            <div className="pt-0.5 shrink-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                  !hasScrolledToBottom
                    ? "bg-slate-200 border-2 border-slate-300 text-slate-400 cursor-not-allowed"
                    : isAgreed
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-500/30 shadow-xs"
                    : "border-2 border-slate-400 bg-white"
                }`}
              >
                {!hasScrolledToBottom ? (
                  <Lock className="w-3 h-3" />
                ) : isAgreed ? (
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                ) : null}
              </div>
            </div>

            {/* Declaration Text */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4
                  className={`text-xs font-black ${
                    !hasScrolledToBottom
                      ? "text-slate-500"
                      : isAgreed
                      ? "text-emerald-950"
                      : "text-slate-900"
                  }`}
                >
                  {role === "rider"
                    ? "আমি সমস্ত শর্তাবলি, নিয়মাবলী ও আইনি দায়মুক্তি পড়েছি এবং এতে পূর্ণ সম্মতি দিচ্ছি"
                    : "আমি সমস্ত শর্তাবলি ও নিয়মাবলী পড়েছি এবং এতে পূর্ণ সম্মতি দিচ্ছি"}
                </h4>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {!hasScrolledToBottom
                  ? "🔒 টিক দিতে সম্পূর্ণ নিচে স্ক্রোল করুন"
                  : isAgreed
                  ? "✅ সম্মতি নির্বাচিত হয়েছে, নিচের বাটনে চাপুন"
                  : "👉 এখানে ক্লিক করে টিক চিহ্ন দিন"}
              </p>
            </div>
          </div>
        </div>

        {/* PDF Link Reference & Note */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span>অফিসিয়াল ডকুমেন্ট: <strong className="font-bold">{pdfName}</strong></span>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-emerald-700 underline"
          >
            PDF খুলুন
          </a>
        </div>
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 shadow-xl z-30">
        <div className="max-w-md mx-auto space-y-2">
          <Button
            size="lg"
            disabled={!hasScrolledToBottom || !isAgreed}
            onClick={handleSubmit}
            className={`w-full h-13 rounded-2xl font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              hasScrolledToBottom && isAgreed
                ? role === "rider"
                  ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-400/30 active:scale-98"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-98"
                : "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
            }`}
          >
            {hasScrolledToBottom && isAgreed ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>আমি সম্পূর্ণ সম্মত ও গ্রহণ করলাম</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : !hasScrolledToBottom ? (
              <>
                <Lock className="w-4 h-4" />
                <span>সম্পূর্ণ নিচে স্ক্রোল করে পড়ুন</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>সম্মতি বক্সে টিক দিন</span>
              </>
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
  const pdfUrl = activeTab === "rider" ? "/rider-disclaimer.pdf" : "/customer-disclaimer.pdf";

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
                অফিসিয়াল ডিসক্লেইমার ও নিয়মাবলী
              </h2>
              <span className="text-[10px] text-slate-500 font-medium">
                সুন্দরবন রাইডার্স ব্যবহারের শর্তাবলী
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="p-3 bg-white border-b border-slate-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("passenger")}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
              activeTab === "passenger"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>👤 যাত্রী নির্দেশিকা (৬)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("rider")}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
              activeTab === "rider"
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>🛺 চালক চুক্তি (১৪)</span>
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              {activeTab === "passenger"
                ? "যাত্রীদের নিরাপত্তা ও সেবামূলক অধিকার (৬টি ধারা):"
                : "চালক পার্টনার হিসেবে দায়িত্ব ও দায়মুক্তি বিধিমালা (১৪টি ধারা):"}
            </span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>PDF</span>
            </a>
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
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Icon className="w-3.5 h-3.5" />
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
            className="w-full h-10 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
          >
            ঠিক আছে, বন্ধ করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
