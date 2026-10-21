"use client";

import { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, Zap, Navigation2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

interface AppSplashScreenProps {
  onComplete?: (detectedCoords?: [number, number]) => void;
  minDurationMs?: number;
}

export function AppSplashScreen({
  onComplete,
  minDurationMs = 2400,
}: AppSplashScreenProps) {
  const [progress, setProgress] = useState(12);
  const [statusMessage, setStatusMessage] = useState("🛰️ স্যাটেলাইট রোড নেটওয়ার্ক সংযোগ হচ্ছে...");
  const [locationFound, setLocationFound] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let detectedLocation: [number, number] | null = null;
    const startTime = Date.now();

    // 1. Proactively acquire pure hardware satellite GPS during splash screen
    const acquirePureGps = async () => {
      try {
        const isNative = Capacitor.isNativePlatform();
        if (isNative) {
          try {
            const perm = await Geolocation.checkPermissions();
            if (perm.location === "granted") {
              const pos = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 9000,
                maximumAge: 0,
              });
                if (pos?.coords?.latitude && pos?.coords?.longitude) {
                  const acc = pos.coords.accuracy || 10;
                  // Reject coarse cellular tower guesses (>1500m)
                  if (acc <= 1500) {
                    detectedLocation = [pos.coords.latitude, pos.coords.longitude];
                    try {
                      localStorage.setItem("sr_last_known_lat", pos.coords.latitude.toString());
                      localStorage.setItem("sr_last_known_lng", pos.coords.longitude.toString());
                    } catch {}
                    if (!isCancelled) {
                      setLocationFound(true);
                      setStatusMessage("✓ আপনার সঠিক লাইভ অবস্থান লক হয়েছে!");
                      setProgress(92);
                    }
                    return;
                  }
                }
              }
            } catch {}
          }

        // Web fallback high-accuracy GPS
        if (typeof window !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (isCancelled) return;
              const acc = pos.coords.accuracy || 10;
              if (acc <= 1500) {
                detectedLocation = [pos.coords.latitude, pos.coords.longitude];
                try {
                  localStorage.setItem("sr_last_known_lat", pos.coords.latitude.toString());
                  localStorage.setItem("sr_last_known_lng", pos.coords.longitude.toString());
                } catch {}
                setLocationFound(true);
                setStatusMessage("✓ আপনার সঠিক লাইভ অবস্থান লক হয়েছে!");
                setProgress(92);
              }
            },
            () => {},
            { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
          );
        }
      } catch {}
    };

    acquirePureGps();

    // 2. Smooth liquid progress timer
    const interval = setInterval(() => {
      setProgress((prev) => {
        const elapsed = Date.now() - startTime;
        let target = Math.min(88, Math.round((elapsed / minDurationMs) * 100));

        // If location was found or minDuration elapsed, complete
        if (elapsed >= minDurationMs) {
          target = 100;
        }

        const next = Math.min(100, Math.max(prev + 3, target));

        if (next < 30) {
          setStatusMessage("🛰️ স্যাটেলাইট রোড নেটওয়ার্ক সংযোগ হচ্ছে...");
        } else if (next < 70) {
          setStatusMessage("📍 সুন্দরবন অঞ্চলের লাইভ জিপিএস লোকেশন সনাক্ত হচ্ছে...");
        } else if (next < 95) {
          setStatusMessage(locationFound ? "✓ অবস্থান প্রস্তুত! সুন্দরবন রাইডার্সে স্বাগতম..." : "🛺 অনুমোদিত টোটো ও নিরাপদ রুট সিঙ্ক হচ্ছে...");
        } else {
          setStatusMessage("✓ স্বাগতম! অ্যাপ প্রস্তুত হচ্ছে...");
        }

        if (next >= 100) {
          clearInterval(interval);
          setIsFadingOut(true);
          setTimeout(() => {
            onComplete?.(detectedLocation || undefined);
          }, 350);
          return 100;
        }

        return next;
      });
    }, 60);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [minDurationMs, locationFound, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 select-none overflow-hidden transition-all duration-400 ease-out ${
        isFadingOut ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        background: "radial-gradient(circle at 50% 25%, #064e3b 0%, #06241e 40%, #03120f 85%, #020b09 100%)",
      }}
    >
      {/* Dynamic Animated Liquid Glass Ambient Lights */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-400/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-teal-300/20 rounded-full blur-[90px] pointer-events-none animate-pulse delay-1000" />
      <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[110px] pointer-events-none" />

      {/* Subtle Specular Mesh Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top Floating Glass Badge */}
      <div className="pt-6 relative z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] text-[11px] font-black text-emerald-300">
          <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400 animate-pulse" />
          <span className="tracking-wide">সুন্দরবন স্মার্ট ই-টোটো বুকিং</span>
        </div>
      </div>

      {/* Central Liquid Glass Hero Card */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto w-full max-w-sm px-4">
        {/* Floating Specular Ring with Glowing Brand Logo */}
        <div className="relative mb-6">
          {/* Outer Pulsing Radar Rings */}
          <div className="absolute inset-[-14px] rounded-full border border-emerald-400/30 animate-ping opacity-60 pointer-events-none" />
          <div className="absolute inset-[-28px] rounded-full border border-emerald-500/20 animate-pulse pointer-events-none" />

          {/* Liquid Glass Frosted Circle */}
          <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-white/[0.1] backdrop-blur-3xl border-2 border-white/40 shadow-[0_20px_50px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.6)] p-2 transition-transform duration-300 hover:scale-105">
            <div className="w-full h-full rounded-full overflow-hidden bg-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center relative">
              <img
                src="/sundarban-logo.png"
                alt="Sundarban Riders Logo"
                className="w-full h-full object-cover scale-[1.08] select-none"
              />
            </div>
          </div>

          {/* 24x7 Live Pill */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-[10px] font-black text-emerald-300 uppercase tracking-widest shadow-xl flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
            <Sparkles className="w-2.5 h-2.5 text-amber-400 animate-spin" />
            <span>24×7 লাইভ জিপিএস</span>
          </div>
        </div>

        {/* Brand Typography with Liquid Glass Frosted Backdrop */}
        <div className="w-full p-5 rounded-3xl bg-white/[0.06] backdrop-blur-3xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.3)] space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>SUNDARBAN</span>
            <span className="text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">RIDERS</span>
          </h1>

          <p className="text-amber-300 font-bold text-sm tracking-tight flex items-center justify-center gap-1.5">
            <span>অনলাইন স্মার্ট টোটো বুকিং নেটওয়ার্ক</span>
          </p>

          <p className="text-emerald-200/70 text-[11px] font-medium leading-relaxed pt-0.5">
            কাকদ্বীপ • নামখানা • ডায়মন্ড হারবার • লক্ষ্মীকান্তপুর
          </p>
        </div>
      </div>

      {/* Bottom Liquid Glass Progress Hub */}
      <div className="w-full max-w-xs pb-6 relative z-10 space-y-3">
        {/* Dynamic Status Message with Live Radar Icon */}
        <div className="text-center min-h-[30px] flex items-center justify-center">
          <p className="text-xs font-bold text-emerald-100/90 flex items-center justify-center gap-2 bg-black/25 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-xs">
            {locationFound ? (
              <Navigation2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span>{statusMessage}</span>
          </p>
        </div>

        {/* Liquid Glass Fluid Progress Bar */}
        <div className="relative w-full h-3 bg-white/[0.08] backdrop-blur-md rounded-full overflow-hidden border border-white/20 p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 rounded-full transition-all duration-150 shadow-[0_0_16px_rgba(52,211,153,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Bottom Trust Indicators */}
        <div className="flex items-center justify-between text-[11px] text-emerald-300/80 font-bold px-1.5">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>নিরাপদ ও অনুমোদিত</span>
          </span>
          <span className="font-mono text-white text-xs font-black">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
