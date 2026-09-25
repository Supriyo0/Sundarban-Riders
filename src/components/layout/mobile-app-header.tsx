"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { Volume2, VolumeX, ShieldAlert, LogOut, ArrowRightLeft, Radio } from "lucide-react";

interface MobileAppHeaderProps {
  role: "rider" | "passenger";
  userName?: string;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  onSwitchRole?: () => void;
  onSosClick?: () => void;
  onLogout?: () => void;
}

export function MobileAppHeader({
  role,
  userName,
  isSoundMuted = false,
  onToggleSound,
  onSwitchRole,
  onSosClick,
  onLogout,
}: MobileAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-3.5 py-2.5 bg-white/92 backdrop-blur-xl border-b border-slate-200/80 shadow-xs flex items-center justify-between select-none">
      {/* Brand Circular Logo & App Title */}
      <div className="flex items-center gap-2.5">
        <SundarbanLogo size="sm" variant="icon" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-tight text-slate-900 leading-none">
              SUNDARBAN
            </span>
            <span className="font-black text-sm tracking-tight text-emerald-600 leading-none">
              RIDERS
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-bold text-slate-500 leading-none">
              সুন্দরবন রাইডার্স
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>২৪×৭</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-1.5">
        {/* Role Switcher Pill */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200/90 text-slate-700 transition-all active:scale-95 shadow-2xs"
          >
            <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
            <span>{role === "rider" ? "🛺 চালক" : "👤 যাত্রী"}</span>
          </button>
        )}

        {/* Sound Toggle Button */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={isSoundMuted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন"}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/90 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
          >
            {isSoundMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </button>
        )}

        {/* SOS Emergency Button */}
        {onSosClick && (
          <button
            type="button"
            onClick={onSosClick}
            title="জরুরি SOS সুরক্ষা"
            className="h-8 px-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 flex items-center gap-1 transition-all active:scale-95 shadow-2xs text-[11px] font-black"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            <span>SOS</span>
          </button>
        )}

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="লগআউট / মোড পরিবর্তন"
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/90 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
          </button>
        )}
      </div>
    </header>
  );
}


