"use client";

import React, { useState, useEffect } from "react";
import { MapPin, Navigation, ShieldCheck, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationDisclosureModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export function LocationDisclosureModal({
  isOpen,
  onAccept,
  onDismiss,
}: LocationDisclosureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl text-white relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          aria-label="Close disclosure"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Navigation className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
              Prominent Disclosure &amp; Consent
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              অবস্থান ব্যবহারের অনুমতি (Location Access)
            </h3>
          </div>
        </div>

        {/* Disclosure Body - Strictly aligned with Google Play Policy */}
        <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <p>
            <strong className="text-emerald-400">সুন্দরবন রাইডার্স (Sundarban Riders)</strong> আপনার ডিভাইসের লাইভ অবস্থান (GPS Location) সংগ্রহ করে যাতে:
          </p>
          <ul className="space-y-2 pl-2">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span><strong>নিকটস্থ টোটো সন্ধান:</strong> আপনার বর্তমান পিকআপ পয়েন্ট শনাক্ত করে নিকটবর্তী উপলব্ধ চালকদের কাছে রাইড রিকোয়েস্ট পাঠাতে।</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span><strong>সঠিক রোড রুট ও ভাড়া গণনা:</strong> আসল পাকা ও মেঠো রাস্তার দূরত্ব মেপে ন্যায্য মিটার ভাড়া নির্ধারণ করতে।</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <span><strong>লাইভ নেভিগেশন ও সুরক্ষা:</strong> অ্যাপ চালু থাকা অবস্থায় এবং চলমান ট্রিপের সময় চালক ও যাত্রীর সঠিক পথ প্রদর্শন করতে।</span>
            </li>
          </ul>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>আমরা আপনার অবস্থান কোনো বিজ্ঞাপনদাতা বা তৃতীয় পক্ষের কাছে বিক্রি করি না।</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={onAccept}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>সম্মতি ও অবস্থান চালু করুন (Agree &amp; Continue)</span>
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            onClick={onDismiss}
            className="w-full text-slate-400 hover:text-slate-200 text-xs py-2"
          >
            এখন নয় (Not Now)
          </Button>
        </div>
      </div>
    </div>
  );
}
