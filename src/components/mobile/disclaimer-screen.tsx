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
import { toast } from "sonner";

export function triggerDownloadPdf(url: string, filename: string, e?: React.MouseEvent) {
  if (e) {
    e.stopPropagation();
  }
  try {
    toast.info("📄 PDF ডাউনলোড শুরু হচ্ছে...");
    const fullUrl =
      typeof window !== "undefined" && url.startsWith("/")
        ? window.location.origin + url
        : url;

    const link = document.createElement("a");
    link.href = fullUrl;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof window !== "undefined") {
      try {
        window.open(fullUrl, "_blank");
      } catch {}
    }
  } catch (err) {
    console.warn("PDF open error:", err);
    if (typeof window !== "undefined") {
      const fullUrl = url.startsWith("/") ? window.location.origin + url : url;
      window.open(fullUrl, "_blank");
    }
  }
}

export interface DisclaimerItem {
  id: string;
  title: string;
  enTitle: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

// ---------------------------------------------------------------------------
// PASSENGER DISCLAIMERS (6 Exact Sections from Official Passenger PDF)
// ---------------------------------------------------------------------------
export const PASSENGER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "p_platform_role",
    title: "#১ প্ল্যাটফর্মের ভূমিকা ও দায়মুক্তি",
    enTitle: "Platform Role & Disclaimer",
    description:
      "সুন্দরবন রাইডার্স কোনো সরাসরি পরিবহন পরিষেবা বা টোটো পরিচালনাকারী সংস্থা নয়; এটি একটি সম্পূর্ণ স্বতন্ত্র আইটি ও আইটিইএস (IT & ITeS) প্রযুক্তি প্ল্যাটফর্ম। তথ্যপ্রযুক্তি আইন (IT Act, 2000) অনুযায়ী আমরা কেবল স্বাধীন টোটো পাইলট এবং যাত্রীদের মধ্যে তথ্য ও ডিজিটাল যোগাযোগের মাধ্যম হিসেবে কাজ করি। রাইড চলাকালীন কোনো অনাকাঙ্ক্ষিত দুর্ঘটনা, আর্থিক ক্ষতি, শারীরিক আঘাত, জীবনহানি, ব্যক্তিগত সামগ্রী হারানো বা ট্রাফিক আইন লঙ্ঘনজনিত কোনো ঘটনার জন্য প্ল্যাটফর্ম বা এর পরিচালনাকারী কোনোভাবেই আইনি বা আর্থিকভাবে দায়ী থাকবে না। প্রতিটি যাত্রা সম্পূর্ণ স্বাধীন পাইলট ও যাত্রীর পারস্পরিক সমঝোতা ও নিজ দায়িত্বে পরিচালিত হবে।",
    icon: Scale,
    badge: "ভূমিকা ও দায়মুক্তি",
  },
  {
    id: "p_fare_extra_night",
    title: "#২ ভাড়া, অতিরিক্ত যাত্রী ও নাইট চার্জ সংক্রান্ত নিয়ম",
    enTitle: "Fare, Extra Passenger & Night Charge Policy",
    description:
      "দূরত্ব ও সময়ের ওপর ভিত্তি করে প্রদর্শিত স্থানীয় প্রচলিত আনুমানিক ভাড়ার হিসাব ভালোভাবে জেনে-বুঝে তবেই রাইড অনুরোধ পাঠাতে হবে। রাত্রিকালীন যাতায়াত বা প্রযোজ্য ক্ষেত্রে স্থানীয় নিয়ম অনুযায়ী প্রস্তাবিত চার্জ প্ল্যাটফর্মের হিসেবে প্রদর্শিত হতে পারে। আইন অনুযায়ী টোটোতে চালক ছাড়া সর্বোচ্চ ৪ জন যাত্রী যাতায়াত করতে পারবেন। প্ল্যাটফর্ম কোনো ভাড়া গ্রহণ করে না; রাইড শেষে যাত্রী ও স্বাধীন পাইলটের পারস্পরিক সম্মতিক্রমে যাবতীয় ভাড়া সরাসরি চালক/পাইলটকে নগদ (ক্যাশ) অথবা তাঁর নিজস্ব ডিজিটাল মাধ্যমে (UPI) পরিশোধ করতে হবে।",
    icon: CreditCard,
    badge: "ভাড়া ও চার্জ",
  },
  {
    id: "p_respect_conduct",
    title: "#৩ চালক ও টোটোর প্রতি সম্মান প্রদর্শন",
    enTitle: "Passenger Conduct",
    description:
      "স্থানীয় পরিশ্রমী স্বাধীন টোটো পাইলটদের সাথে পারস্পরিক সদাচরণ ও শালীনতা বজায় রাখা বাধ্যতামূলক। বাহনের কোনো অভ্যন্তরীণ বা বাহ্যিক ক্ষতিসাধন করা যাবে না; কোনো ক্ষয়ক্ষতি হলে তার সম্পূর্ণ দায়ভার সংশ্লিষ্ট যাত্রীর ওপর বর্তাবে। পাইলটকে কোনো অবস্থাতেই বিপজ্জনক গতিতে বাহন চালাতে, ট্রাফিক আইন অমান্য করতে কিংবা সরকারি নিয়ম লঙ্ঘন করে অতিরিক্ত যাত্রী বহনে বাধ্য করা যাবে না।",
    icon: HeartHandshake,
    badge: "আচরণ বিধি",
  },
  {
    id: "p_no_cancel_enroute",
    title: "#৪ যাত্রা কালীন বাতিল নিষেধ",
    enTitle: "Cancellation Policy",
    description:
      "স্বাধীন পাইলট পিকআপে পৌঁছানোর পূর্বে প্রয়োজনবোধে রাইড অনুরোধ বাতিল করা যেতে পারে। তবে একবার যাত্রা (Trip) শুরু হয়ে গেলে অ্যাপে তা আর বাতিল করা যাবে না। অনাকাঙ্ক্ষিত কোনো জরুরি কারণে মাঝপথে নামতে হলে, অতিক্রান্ত দূরত্বের ভিত্তিতে পাইলটকে পারস্পরিক সমঝোতায় ন্যায্য ভাড়া পরিশোধ করতে হবে এবং কেবল পাইলটের অ্যাপের মাধ্যমেই যাত্রা সফলভাবে সমাপ্ত হবে।",
    icon: Ban,
    badge: "বাতিল নীতি",
  },
  {
    id: "p_safety_sos",
    title: "#৫ জরুরি সুরক্ষা ও SOS অধিকার",
    enTitle: "Safety & SOS",
    description:
      "যাত্রাপথে যেকোনো অনাকাঙ্ক্ষিত জরুরি পরিস্থিতি বা নিরাপত্তা সংকটে অ্যাপের ভেতরে থাকা SOS বোতাম ব্যবহার করে সরাসরি জাতীয় জরুরি হেল্পলাইন (১১২), মহিলা হেল্পলাইন (১৮১/১০৯১) অথবা সুন্দরবন রাইডার্স সাপোর্ট হেল্পলাইনে তাৎক্ষণিক তথ্য বা সহায়তা চাওয়ার সম্পূর্ণ অধিকার যাত্রীর রয়েছে। প্ল্যাটফর্ম সরাসরি কোনো উদ্ধারকারী সংস্থা নয়, তবে সরকারি জরুরি ব্যবস্থার সাথে সংযোগ স্থাপনে প্রযুক্তিগত সহায়তা প্রদান করে।",
    icon: ShieldCheck,
    badge: "জরুরি সুরক্ষা",
  },
  {
    id: "p_accurate_location",
    title: "#৬ সঠিক লোকেশন ও যোগাযোগ",
    enTitle: "Location & Contact",
    description:
      "অ্যাপে অনুরোধ পাঠানোর সময় সঠিক পিকআপ পয়েন্ট ও সুনির্দিষ্ট গন্তব্যের তথ্য নির্বাচন করতে হবে। অনুরোধ গ্রহণের পর স্বাধীন পাইলটের সাথে সমন্বয় নিশ্চিত করতে যাত্রীর ফোন বা সক্রিয় হোয়াটসঅ্যাপ চালু রাখতে হবে। ভুল লোকেশন প্রদান বা ফোনে যোগাযোগ না করা গেলে স্বাধীন পাইলট অনুরোধটি বাতিল করার পূর্ণ অধিকার সংরক্ষণ করেন।",
    icon: UserCheck,
    badge: "যোগাযোগ নীতি",
  },
  {
    id: "p_fare_clarification",
    title: "#৭ ভাড়া নির্ধারণ ও লেনদেন সংক্রান্ত স্পষ্টীকরণ",
    enTitle: "Fare Disclaimer & Transactions",
    description:
      "সুন্দরবন রাইডার্স প্ল্যাটফর্ম কোনো নিজস্ব সরকারি বা বাধ্যতামূলক ভাড়ার মিটার পরিচালনা করে না। অ্যাপে প্রদর্শিত ভাড়া কেবল স্থানীয় প্রথা, আনুমানিক দূরত্ব এবং পাইলটদের প্রচলিত হারের ভিত্তিতে একটি নির্দেশক বা সম্ভাব্য হিসাব মাত্র। গন্তব্যে পৌঁছানোর পর সম্পূর্ণ ভাড়া যাত্রী সরাসরি স্বাধীন পাইলটকে প্রদান করবেন। ভাড়া সংক্রান্ত যেকোনো বিশেষ পরিস্থিতি বা মতানৈক্য সম্পূর্ণভাবে যাত্রী ও স্বাধীন পাইলটের মধ্যকার পারস্পরিক আলোচনার মাধ্যমে সমাধানযোগ্য; এতে প্ল্যাটফর্মের কোনো আর্থিক সংশ্লিষ্টতা বা দায়বদ্ধতা নেই।",
    icon: CreditCard,
    badge: "ভাড়া ডিসক্লেইমার",
  },
  {
    id: "p_intermediary_liability",
    title: "#৮ আইটি মধ্যস্থতাকারী (IT Intermediary) হিসেবে দায়বদ্ধতার সীমাবদ্ধতা",
    enTitle: "IT Intermediary & Liability",
    description:
      "তথ্যপ্রযুক্তি আইন (Information Technology Act, 2000)-এর বিধানানুযায়ী এই প্ল্যাটফর্মটি কেবল দুই স্বাধীন পক্ষের (যাত্রী ও স্বাধীন পাইলট) মধ্যে তথ্য ও যোগাযোগের প্রযুক্তিগত সুবিধা প্রদানকারী মধ্যস্থতাকারী (Intermediary) মাত্র। স্বাধীন পাইলটের ব্যক্তিগত আচরণ, বাহনের যান্ত্রিক বা শারীরিক ত্রুটি, বিলম্ব, পথিমধ্যে কোনো বিবাদ বা অনাকাঙ্ক্ষিত দুর্ঘটনার জন্য প্ল্যাটফর্ম বা কর্তৃপক্ষ কোনোভাবেই দায়বদ্ধ থাকবে না। যাত্রী ও স্বাধীন পাইলট উভয় পক্ষই সম্পূর্ণ নিজস্ব বিচার-বুদ্ধি ও স্বাধীন সম্মতিতে এই প্রযুক্তি মাধ্যম ব্যবহার করছেন।",
    icon: Scale,
    badge: "আইটি দায়বদ্ধতা",
  },
];

// ---------------------------------------------------------------------------
// RIDER DISCLAIMERS (14 Exact Sections from Official Rider PDF)
// ---------------------------------------------------------------------------
export const RIDER_DISCLAIMERS: DisclaimerItem[] = [
  {
    id: "r_independent",
    title: "১. স্বাধীন পরিষেবা প্রদানকারী",
    enTitle: "Independent Service Provider",
    description:
      "আমি স্বেচ্ছায় এবং স্বজ্ঞানে \"সুন্দরবন রাইডার\" নামক আইটি ও আইটিইএস প্ল্যাটফর্মের সাথে একজন 'স্বাধীন ও স্বতন্ত্র টোটো চালক' (Independent Service Provider) হিসেবে যুক্ত হচ্ছি। আমি সুন্দরবন রাইডার প্ল্যাটফর্মের কোনো স্থায়ী, অস্থায়ী বা বেতনভুক্ত কর্মচারী নই এবং এই প্ল্যাটফর্ম আমাকে সরাসরি কোনো বেতন বা গাড়ি প্রদান করেন না। আমি স্বাধীনভাবে আমার টোটো চালাই।",
    icon: User,
    badge: "স্বাধীন চালক",
  },
  {
    id: "r_no_liability",
    title: "২. দায়বদ্ধতা বর্জন",
    enTitle: "No-Liability Disclaimer",
    description:
      "আমি সম্পূর্ণভাবে অবগত আছি যে, \"সুন্দরবন রাইডার\" কেবল একটি ডিজিটাল তথ্য আদান-প্রদানকারী মাধ্যম বা সেতু। আমার চালিত টোটো বা যাতায়াতের সময় রাস্তায় কোনো রকম দুর্ঘটনা, যাত্রীর শারীরিক আঘাত, জীবনহানি, যাত্রীর কোনো মালপত্র ও সম্পত্তির ক্ষয়ক্ষতি কিংবা টোটো ক্ষয়ক্ষতির হলে তার জন্য \"সুন্দরবন রাইডার\" প্ল্যাটফর্ম বা কর্তৃপক্ষ কোনোভাবেই দায়ী থাকবেন না। এই ধরনের যেকোনো ঘটনার বা ঝুঁকির সম্পূর্ণ আইনি ও আর্থিক দায় আমার নিজের।",
    icon: Scale,
    badge: "দায়মুক্তি",
  },
  {
    id: "r_flexibility",
    title: "৩. চালকের কাজের স্বাধীনতা ও নমনীয়তা",
    enTitle: "Rider's Freedom & Flexibility",
    description:
      "\"আমি (চালক) 'সুন্দরবন রাইডার' প্ল্যাটফর্মে কাজ করার জন্য সম্পূর্ণ স্বাধীন । প্ল্যাটফর্ম আমাকে কোনো নির্দিষ্ট সময়ে বা নির্দিষ্ট সময়সীমা (যেমন: নাইট শিফট বা ওভারটাইম) পর্যন্ত কাজ করতে বা রাইড নিতে বাধ্য করতে পারবে না। আমার দৈনন্দিন কাজের সময়, বিরতি এবং রুট সম্পূর্ণভাবে আমার নিজস্ব ইচ্ছার ওপর নির্ভর করবে।\"",
    icon: Sparkles,
    badge: "কাজের স্বাধীনতা",
  },
  {
    id: "r_leave_freedom",
    title: "৪. প্ল্যাটফর্ম ত্যাগ বা চুক্তি বাতিলের স্বাধীনতা",
    enTitle: "Freedom to Stay or Leave the Platform",
    description:
      "\"আমি যেকোনো সময় কোনো রকম পূর্ব নোটিশ বা জরিমানা ছাড়াই 'সুন্দরবন রাইডার' প্ল্যাটফর্ম ত্যাগ করতে বা অ্যাকাউন্ট মুছে ফেলতে পারি। প্ল্যাটফর্ম ত্যাগ করার কারণে কর্তৃপক্ষ আমার ওপর কোনো আইনি চাপ, আর্থিক জরিমানা বা জবরদস্তি করতে পারবে না।\"",
    icon: Ban,
    badge: "বাতিল স্বাধীনতা",
  },
  {
    id: "r_driver_safety",
    title: "৫. চালকের সুরক্ষা ও ন্যায্য অধিকার",
    enTitle: "Rider's Safety & Fair Rights",
    description:
      "\"যদি কোনো যাত্রীর আচরণ সন্দেহজনক মনে হয়, কিংবা গন্তব্যস্থল অত্যন্ত ঝুঁকিপূর্ণ, অনিরাপদ বা প্রতিকূল আবহাওয়া/পরিস্থিতির মধ্যে পড়ে, তবে চালক হিসেবে আমার সেই রাইডটি বর্জন বা বাতিল করার সম্পূর্ণ অধিকার থাকবে। এর জন্য প্ল্যাটফর্ম কর্তৃপক্ষ আমার আইডি ব্লক বা আমার ওপর কোনো শাস্তিমূলক ব্যবস্থা গ্রহণ করতে পারবে না।\"",
    icon: ShieldCheck,
    badge: "চালকের সুরক্ষা",
  },
  {
    id: "r_fair_earnings",
    title: "৬. ন্যায্য ভাড়া প্রাপ্তি",
    enTitle: "Right to Fair Earnings",
    description:
      "\"যাত্রীর কাছ থেকে নির্ধারিত বা পারস্পরিক সম্মত ভাড়ার পুরোটাই চালকের প্রাপ্য (প্ল্যাটফর্মের নির্ধারিত সামান্য প্রযুক্তি সহায়তা ফি বা Tech Fee ছাড়া)। কোনো রকম লুক্কায়িত কমিশন বা অযৌক্তিক উপায়ে চালকের ন্যায্য আয় থেকে অর্থ দাবি করতে পারবে না।\"",
    icon: CreditCard,
    badge: "ন্যায্য ভাড়া",
  },
  {
    id: "r_compliance",
    title: "৭. নিরাপত্তা ও আইন মান্য করা",
    enTitle: "Safety & Compliance",
    description:
      "আমি সর্বদা ভারতের সমস্ত প্রচলিত ট্রাফিক আইন, স্থানীয় প্রশাসন ও সরকারের সমস্ত নির্দেশিকা ও বিধিনিষেধ কঠোরভাবে মেনে চলব। কখনোই নেশাগ্রস্ত অবস্থায় গাড়ি চালাব না। নেশাগ্রস্ত অবস্থায় ধরা পড়লে প্ল্যাটফর্ম আমার চালক আইডি স্থায়ীভাবে ব্লক করবে এবং সমস্ত আইনি ও আর্থিক দায়-দায়িত্ব আমার ওপর বর্তাবে।",
    icon: AlertTriangle,
    badge: "আইন মান্যতা",
  },
  {
    id: "r_conduct",
    title: "৮. যাত্রী সংক্রান্ত আচরণ",
    enTitle: "Passenger Conduct",
    description:
      "আমি যাত্রীদের সাথে সর্বদা মার্জিত ও ভালো ব্যবহার করব। যাত্রীদের কাছ থেকে অযৌক্তিক বা অতিরিক্ত ভাড়া নেব না এবং প্ল্যাটফর্মের নির্ধারিত বা পারস্পরিক সম্মত নিয়ম মেনেই ভাড়া নেব।",
    icon: HeartHandshake,
    badge: "মর্যাদা বিধি",
  },
  {
    id: "r_platform_fee",
    title: "৯. প্রযুক্তিগত সহায়তা ফি",
    enTitle: "Platform Tech Fee",
    description:
      "এই প্ল্যাটফর্ম রাইডের ওপর কোনো কমিশন বা লাভের কোন অংশীদারি নেয় না। তবে অ্যাপ, সার্ভার ও প্ল্যাটফর্ম সচল রাখার জন্য আমি স্বেচ্ছায় নির্ধারিত প্রযুক্তিগত সহায়তা ফি (Tech Support Fee) প্রদানে সম্মত আছি।",
    icon: CreditCard,
    badge: "প্ল্যাটফর্ম ফি",
  },
  {
    id: "r_legal_cooperation",
    title: "১০. আইনি সুরক্ষা ও সহযোগিতার সম্মতি",
    enTitle: "Legal Protection & Co-operation Consent",
    description:
      "যদি আমার কোনো ভুলত্রুটি বা আইন লঙ্ঘনের কারণে পুলিশ-প্রশাসন বা কোনো আইনি জটিলতা তৈরি হয়, তবে তার জন্য “সুন্দরবন রাইডার” প্ল্যাটফর্ম কোনো আইনি ঝামেলা নেবে না। তাই আমি সমস্ত আইনি বা নিয়ম মেনে চলতে বাধ্য থাকব।",
    icon: Scale,
    badge: "আইনি সুরক্ষা",
  },
  {
    id: "r_privacy",
    title: "১১. যাত্রীর তথ্য সুরক্ষা ও দায়মুক্তি",
    enTitle: "Passenger Privacy & Liability",
    description:
      "\"রাইড বুকিং এবং যাতায়াত সফলভাবে সম্পন্ন করার উদ্দেশ্যে যাত্রীর মোবাইল নম্বর ও অন্যান্য প্রয়োজনীয় তথ্য চালকের সাথে শেয়ার করা হতে পারে। চালক এই কন্টাক্ট নম্বর বা তথ্য কেবল রাইডিং বা যাতায়াত সংক্রান্ত যোগাযোগের জন্যই ব্যবহার করবে। যদি চালক রাইডিং উদ্দেশ্যের বাইরে অন্য কোনো উদ্দেশ্যে যাত্রীর কন্টাক্ট নম্বর বা তথ্য ব্যবহার করেন, হয়রানি করেন বা অপব্যবহার করেন, তবে তার সম্পূর্ণ আইনি ও ব্যক্তিগত দায়দায়িত্ব কেবল ওই চালকের নিজের হবে।\"",
    icon: UserCheck,
    badge: "তথ্য সুরক্ষা",
  },
  {
    id: "r_cancel_policy",
    title: "১২. যাত্রা বাতিল ও ক্ষতিপূরণ নীতি",
    enTitle: "Cancellation Policy",
    description:
      "\"কোনো যাত্রী রাইড বুক করার পর যদি কোনো কারণে রাইড ক্যানসেল করেন, বা বাতিল করেন, তা এই পরিষেবার একটি স্বাভাবিক ও সাধারণ অংশ। কোনো যাত্রী ব্যক্তিগত কারণে, পরিকল্পনা পরিবর্তন বা অন্য যেকোনো কারণে বুকিং বাতিল করতে পারেন। এই ক্ষেত্রে কর্তৃপক্ষের কাছে কোনো ক্ষতিপূরণ, ভাড়া বা জরিমানা দাবি করা যাবে না। যাত্রীর সাথে কোনো দুর্ব্যবহার করতে পারবেন না।\"",
    icon: Ban,
    badge: "বাতিল ক্ষতিপূরণ",
  },
  {
    id: "r_driver_cancel",
    title: "১৩. চালক কর্তৃক বাতিল",
    enTitle: "Cancellation by Rider",
    description:
      "\"চালক কোনো জরুরি বা অনিবার্য কারণ ছাড়া বারবার রাইড বাতিল করলে প্ল্যাটফর্ম কর্তৃপক্ষ চালকের আইডির বিরুদ্ধে সতর্কতামূলক ব্যবস্থা বা সাময়িক স্থগিতাদেশ দিতে পারে।\"",
    icon: AlertTriangle,
    badge: "দায়িত্ব নীতি",
  },
  {
    id: "r_declaration",
    title: "১৪. ঘোষণা",
    enTitle: "Declaration",
    description:
      "ওপরে উল্লিখিত সমস্ত শর্ত ও নিয়মাবলী আমি নিজে পড়েছি / আমাকে পড়ে শোনানো হয়েছে এবং আমি সম্পূর্ণ বুঝে স্বেচ্ছায় এই প্ল্যাটফর্মে যুক্ত হচ্ছি। সেই সঙ্গে আমার দেওয়া সকল তথ্যের সত্যতা স্বীকার করছি, যদি পরবর্তীতে কোন তথ্য ভুল / মিথ্যা প্রমাণিত হয়, তাহলে প্ল্যাটফর্ম আমার আইডি বাতিল করতে পারবে। এর ফলে সৃষ্ট যাবতীয় আইনি জটিলতার সম্পূর্ণ দায়ভার আমি গ্রহণ করব।",
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
  const pdfName = role === "rider" ? "rider-disclaimer.pdf" : "customer-disclaimer.pdf";

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
    setHasScrolledToBottom(true);
    setShowScrollWarning(false);
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
              download={pdfName}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => triggerDownloadPdf(pdfUrl, pdfName, e)}
              className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 px-2.5 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs no-underline"
              title="অফিসিয়াল PDF ডাউনলোড করুন"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
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
              : "সুন্দরবন রাইডার্সের মাধ্যমে নিরাপদ ও আনন্দদায়ক টোটো যাত্রা উপভোগ করতে নিচের ৮টি শর্তাবলী সম্পূর্ণ নিচে স্ক্রোল করে পড়ে সম্মতি দিন।"}
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

        {/* Official Greeting from PDF */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <p className="text-xs font-black text-slate-900">
            {role === "rider" ? "প্রিয় চালক," : "প্রিয় গ্রাহক / যাত্রী বন্ধু,"}
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
            {role === "rider"
              ? '"সুন্দরবন রাইডার" (Information Technology & Information Technology Enabled Services Platform) প্ল্যাটফর্মে একজন স্বাধীন চালক (Independent Service Provider) হিসেবে যুক্ত হওয়ার আগে অনুগ্রহ করে নিচের নিয়ম ও শর্তগুলো পড়ে নিন : -'
              : '"সুন্দরবন রাইডার্স" (Information Technology & Information Technology Enabled Services Platform) পরিবারে আপনাকে জানাই আন্তরিক স্বাগতম ! আপনার প্রতিটি যাতায়াতকে নিরাপদ, সহজ ও স্বাচ্ছন্দ্যময় করে তুলতে আমাদের এই অনলাইন স্মার্ট টোটো বুকিং প্ল্যাটফর্ম প্রতিশ্রুতিবদ্ধ। তবে আপনার ও চালক বন্ধুদের সুরক্ষার স্বার্থে এবং রাইডটি সুন্দরভাবে পরিচালনা করার জন্য নিচের নিয়ম ও শর্তাবলিগুলো মনোযোগ সহকারে পড়ার এবং মেনে চলার অনুরোধ জানাচ্ছি।'}
          </p>
        </div>

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

        {/* PDF Final Consent / Sign-off */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <h4 className="text-xs font-black text-slate-900">
            {role === "rider" ? "কর্তৃপক্ষ — “ সুন্দরবন রাইডার ”" : "চূড়ান্ত সম্মতি ঘোষণা (Final Consent)"}
          </h4>
          <p className="text-[11px] text-slate-700 leading-relaxed font-normal">
            {role === "rider"
              ? "ওপরে উল্লিখিত সমস্ত শর্ত ও নিয়মাবলী চালক নিজে পড়েছেন / চালককে পড়ে শোনানো হয়েছে এবং সম্পূর্ণ বুঝে স্বেচ্ছায় এই প্ল্যাটফর্মে যুক্ত হয়েছেন।"
              : '"আমাদের এই অ্যাপ্লিকেশন ডাউনলোড, রেজিস্ট্রেশন বা প্রযুক্তি প্ল্যাটফর্ম ব্যবহার করার অর্থ হলো আপনি উপরের সমস্ত শর্তাবলি, আনুমানিক ভাড়া সংক্রান্ত নিয়ম ও আইনি দায়মুক্তির ডিসক্লেইমার সম্পূর্ণ পড়েছেন বা আপনাকে পড়ে শোনানো হয়েছে এবং আপনি স্বেচ্ছায় ও সজ্ঞানে এতে পূর্ণ সম্মতি জ্ঞাপন করছেন।"'}
          </p>
          <p className="text-[11px] font-black text-emerald-800 pt-1">
            {role === "rider" ? "কর্তৃপক্ষ • সুন্দরবন রাইডার" : "ধন্যবাদ • “ সুন্দরবন রাইডার্স “"}
          </p>
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
          <button
            type="button"
            onClick={(e) => triggerDownloadPdf(pdfUrl, pdfName, e)}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF ডাউনলোড</span>
          </button>
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
  const pdfName = activeTab === "rider" ? "rider-disclaimer.pdf" : "customer-disclaimer.pdf";

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
            <span>👤 যাত্রী নির্দেশিকা (৮)</span>
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
                ? "যাত্রীদের নিরাপত্তা ও সেবামূলক অধিকার (৮টি ধারা):"
                : "চালক পার্টনার হিসেবে দায়িত্ব ও দায়মুক্তি বিধিমালা (১৪টি ধারা):"}
            </span>
            <button
              type="button"
              onClick={(e) => triggerDownloadPdf(pdfUrl, pdfName, e)}
              className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>PDF ডাউনলোড</span>
            </button>
          </div>

          {/* PDF Official Greeting */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
            <p className="text-xs font-black text-slate-900">
              {activeTab === "rider" ? "প্রিয় চালক," : "প্রিয় গ্রাহক / যাত্রী বন্ধু,"}
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {activeTab === "rider"
                ? '"সুন্দরবন রাইডার" (Information Technology & Information Technology Enabled Services Platform) প্ল্যাটফর্মে একজন স্বাধীন চালক (Independent Service Provider) হিসেবে যুক্ত হওয়ার আগে অনুগ্রহ করে নিচের নিয়ম ও শর্তগুলো পড়ে নিন : -'
                : '"সুন্দরবন রাইডার্স" (Information Technology & Information Technology Enabled Services Platform) পরিবারে আপনাকে জানাই আন্তরিক স্বাগতম ! আপনার প্রতিটি যাতায়াতকে নিরাপদ, সহজ ও স্বাচ্ছন্দ্যময় করে তুলতে আমাদের এই অনলাইন স্মার্ট টোটো বুকিং প্ল্যাটফর্ম প্রতিশ্রুতিবদ্ধ।'}
            </p>
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

          {/* PDF Final Sign-off Card */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
            <h4 className="text-xs font-black text-slate-900">
              {activeTab === "rider" ? "কর্তৃপক্ষ — “ সুন্দরবন রাইডার ”" : "চূড়ান্ত সম্মতি ঘোষণা (Final Consent)"}
            </h4>
            <p className="text-[10.5px] text-slate-700 leading-relaxed">
              {activeTab === "rider"
                ? "ওপরে উল্লিখিত সমস্ত শর্ত ও নিয়মাবলী চালক নিজে পড়েছেন / চালককে পড়ে শোনানো হয়েছে এবং সম্পূর্ণ বুঝে স্বেচ্ছায় এই প্ল্যাটফর্মে যুক্ত হয়েছেন।"
                : '"আমাদের এই অ্যাপ্লিকেশন ডাউনলোড, রেজিস্ট্রেশন বা প্রযুক্তি প্ল্যাটফর্ম ব্যবহার করার অর্থ হলো আপনি উপরের সমস্ত শর্তাবলি, আনুমানিক ভাড়া সংক্রান্ত নিয়ম ও আইনি দায়মুক্তির ডিসক্লেইমার সম্পূর্ণ পড়েছেন বা আপনাকে পড়ে শোনানো হয়েছে এবং আপনি স্বেচ্ছায় ও সজ্ঞানে এতে পূর্ণ সম্মতি জ্ঞাপন করছেন।"'}
            </p>
            <p className="text-[10.5px] font-black text-emerald-800 pt-0.5">
              {activeTab === "rider" ? "কর্তৃপক্ষ • সুন্দরবন রাইডার" : "ধন্যবাদ • “ সুন্দরবন রাইডার্স “"}
            </p>
          </div>
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
