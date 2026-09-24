"use client";

import { useEffect, useState } from "react";
import { SundarbanLogo } from "./sundarban-logo";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";

interface AppSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

const LOADING_STATUS_MESSAGES = [
  "🛰️ স্যাটেলাইট জিপিএস সংযোগ সক্রিয় করা হচ্ছে...",
  "🛺 কাকদ্বীপ ও নামখানা অনুমোদিত টোটো নেটওয়ার্ক সিঙ্ক হচ্ছে...",
  "🛣️ ডায়মন্ড হারবার ও লক্ষ্মীকান্তপুর রোড নেভিগেশন ম্যাপ প্রস্তুত...",
  "⚡ সুন্দরবন রাইডার্স এনক্রিপশন ও সিকিউরিটি চেক সম্পন্ন...",
  "✓ স্বাগতম! অ্যাপ সফলভাবে প্রস্তুত হয়েছে...",
];

export function AppSplashScreen({
  onComplete,
  minDurationMs = 2000,
}: AppSplashScreenProps) {
  const [progress, setProgress] = useState(15);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const startTime = Date.now();

    // Progress animation interval
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const elapsed = Date.now() - startTime;
        const targetPercent = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
        const next = Math.max(prev + 4, targetPercent);

        if (next >= 100) {
          clearInterval(progressInterval);
          if (onComplete) {
            setTimeout(onComplete, 400);
          }
          return 100;
        }

        // Cycle through status messages
        const msgIdx = Math.min(
          LOADING_STATUS_MESSAGES.length - 1,
          Math.floor((next / 100) * LOADING_STATUS_MESSAGES.length)
        );
        setMessageIndex(msgIdx);

        return next;
      });
    }, 80);

    return () => clearInterval(progressInterval);
  }, [minDurationMs, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 select-none overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 text-white">
      {/* Ambient Radial Glowing Orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-teal-400/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Branding Tag */}
      <div className="pt-6 relative z-10 flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-emerald-300 shadow-md">
          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 animate-pulse" />
          <span>স্মার্ট ই-টোটো বুকিং নেটওয়ার্ক</span>
        </span>
      </div>

      {/* Center Hero: Glowing Brand Logo & Title */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto space-y-6 animate-in zoom-in-95 duration-500">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <SundarbanLogo
            size="splash"
            variant="icon"
            animated={true}
            className="transform hover:scale-105 transition-transform"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900/90 border border-emerald-500/50 text-[10px] font-black text-emerald-400 uppercase tracking-widest shadow-lg flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-spin-slow" />
            <span>24×7 LIVE</span>
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>SUNDARBAN</span>
            <span className="text-emerald-400">RIDERS</span>
          </h1>

          <p className="text-emerald-300 font-bold text-base tracking-tight">
            সুন্দরবন রাইডার্স
          </p>

          <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto pt-1">
            কাকদ্বীপ • নামখানা • ডায়মন্ড হারবার • লক্ষ্মীকান্তপুর অঞ্চল
          </p>
        </div>
      </div>

      {/* Bottom Progress Bar & Loading Status */}
      <div className="w-full max-w-xs pb-8 relative z-10 space-y-3.5">
        {/* Live Status Message */}
        <div className="text-center min-h-[24px]">
          <p className="text-xs font-semibold text-slate-300 animate-in fade-in duration-200">
            {LOADING_STATUS_MESSAGES[messageIndex]}
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/60 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-150 shadow-md shadow-emerald-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Bottom Security / Authenticity Pill */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>নিরাপদ ও অনুমোদিত</span>
          </span>
          <span className="font-mono text-slate-300 font-bold">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
