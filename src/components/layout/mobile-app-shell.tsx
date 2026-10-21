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
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-slate-100 sm:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] sm:from-emerald-50/80 sm:via-slate-100 sm:to-teal-50/50 flex items-center justify-center sm:p-4 select-none overflow-hidden">
      {/* Background Decorative Ambient Radial Glows (Desktop view only) */}
      <div className="hidden sm:block absolute top-12 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-12 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Smartphone Chassis Container: Exactly 100dvh on mobile, framed on desktop */}
      <div className="w-full sm:max-w-[430px] h-[100dvh] max-h-[100dvh] sm:h-[880px] sm:max-h-[900px] bg-slate-50 relative sm:rounded-[48px] sm:shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:border-[8px] sm:border-slate-300 flex flex-col overflow-hidden ring-1 ring-slate-200">
        
        {/* Native Smartphone Status Bar with Dynamic Island (Shown on desktop framing) */}
        <div className="hidden sm:flex items-center justify-between px-6 pt-2.5 pb-1 bg-white/95 backdrop-blur-md z-40 border-b border-slate-100/60 shrink-0">
          {/* Status Left: Live Time */}
          <span className="text-[12px] font-black tracking-tight text-slate-800">
            {timeStr}
          </span>

          {/* Center: Dynamic Island Capsule Pill */}
          <div className="h-5 w-24 bg-slate-800 rounded-full flex items-center justify-center px-2 gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

        {/* Full-bleed Edge-to-Edge Screen Content (Map and views fill 100% of the screen under header and footer) */}
        <div className="absolute inset-0 z-0 flex flex-col overflow-hidden relative w-full h-full no-scrollbar">
          {children}
        </div>

        {/* Dedicated Floating Top Header (Floating Liquid Glass over Map) */}
        {topHeader && (
          <div className="absolute top-0 sm:top-7 left-0 right-0 z-40 w-full shrink-0">
            {topHeader}
          </div>
        )}

        {/* Floating Liquid Glass Mobile Bottom Navigation Bar (Floating over Map) */}
        {bottomNav && (
          <div
            className="absolute bottom-0 left-0 right-0 z-40 w-full pointer-events-none"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="pointer-events-auto w-full">
              {bottomNav}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
