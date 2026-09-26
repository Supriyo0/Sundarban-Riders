"use client";

import React, { useState, useEffect } from "react";
import { Wifi, BatteryMedium, Signal } from "lucide-react";

interface MobileAppShellProps {
  children: React.ReactNode;
  topHeader?: React.ReactNode;
  bottomNav?: React.ReactNode;
}

export function MobileAppShell({ children, topHeader, bottomNav }: MobileAppShellProps) {
  const [timeStr, setTimeStr] = useState("09:41");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-slate-950/95 sm:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] sm:from-slate-900 sm:via-slate-950 sm:to-emerald-950/40 flex items-center justify-center sm:p-4 select-none overflow-hidden">
      {/* Background Decorative Ambient Radial Glows (Desktop view only) */}
      <div className="hidden sm:block absolute top-12 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-12 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Smartphone Chassis Container: Exactly 100dvh on mobile, framed on desktop */}
      <div className="w-full sm:max-w-[430px] h-[100dvh] max-h-[100dvh] sm:h-[880px] sm:max-h-[900px] bg-slate-50 relative sm:rounded-[48px] sm:shadow-[0_30px_90px_rgba(0,0,0,0.65)] sm:border-[8px] sm:border-slate-800/95 flex flex-col overflow-hidden ring-1 ring-white/10">
        
        {/* Native Smartphone Status Bar with Dynamic Island (Shown on desktop framing) */}
        <div className="hidden sm:flex items-center justify-between px-6 pt-2.5 pb-1 bg-white/95 backdrop-blur-md z-40 border-b border-slate-100/60 shrink-0">
          {/* Status Left: Live Time */}
          <span className="text-[12px] font-black tracking-tight text-slate-800">
            {timeStr}
          </span>

          {/* Center: Dynamic Island Capsule Pill */}
          <div className="h-5 w-24 bg-slate-950 rounded-full flex items-center justify-center px-2 gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-white tracking-widest uppercase">SR LIVE</span>
          </div>

          {/* Status Right: 5G, Wi-Fi, Battery Meter */}
          <div className="flex items-center gap-1.5 text-slate-700">
            <Signal className="w-3.5 h-3.5 text-slate-800" />
            <Wifi className="w-3.5 h-3.5 text-slate-800" />
            <div className="flex items-center">
              <BatteryMedium className="w-4 h-4 text-emerald-600 font-bold" />
            </div>
          </div>
        </div>

        {/* Dedicated Sticky Top Header (Pinned at the top across all screen sizes) */}
        {topHeader && (
          <div className="sticky top-0 z-40 w-full shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
            {topHeader}
          </div>
        )}

        {/* Scrollable Screen Content (The only element that scrolls) */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative w-full no-scrollbar overscroll-contain">
          {children}
        </div>

        {/* Docked Sticky Mobile Bottom Navigation Bar (Pinned at the bottom across all screen sizes) */}
        {bottomNav && (
          <div
            className="sticky bottom-0 z-40 w-full shrink-0 bg-white/95 border-t border-slate-200/80 backdrop-blur-xl"
            style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {bottomNav}
          </div>
        )}

        {/* Smartphone Home Indicator Bar (Shown on desktop framing) */}
        <div className="hidden sm:block shrink-0 py-1.5 bg-white/90 backdrop-blur-sm z-40 text-center border-t border-slate-100">
          <div className="w-32 h-1 bg-slate-300 hover:bg-slate-400 rounded-full mx-auto transition-colors" />
        </div>
      </div>
    </div>
  );
}
