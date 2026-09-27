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
  onOpenDisclaimers?: () => void;
}

export function MobileAppHeader({
  role,
  userName,
  isSoundMuted = false,
  onToggleSound,
  onSwitchRole,
  onSosClick,
  onLogout,
  onOpenDisclaimers,
}: MobileAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-3 py-2 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs flex items-center justify-between select-none gap-2">
      {/* Brand Circular Logo & App Title */}
      <div className="flex items-center gap-2 min-w-0 shrink">
        <SundarbanLogo size="sm" variant="icon" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-black text-sm tracking-tight text-slate-900 leading-none">
              SUNDARBAN
            </span>
            <span className="font-black text-sm tracking-tight text-emerald-600 leading-none">
              RIDERS
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] font-bold text-amber-600 leading-none truncate">
              অনলাইন স্মার্ট টোটো বুকিং
            </span>
            <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded-full border border-emerald-200/60 leading-none shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>২৪×৭</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Role Switcher Pill */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all active:scale-95 shrink-0"
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
            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shrink-0"
          >
            {isSoundMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </button>
        )}

        {/* In-App Disclaimers & Rules Button */}
        {onOpenDisclaimers && (
          <button
            type="button"
            onClick={onOpenDisclaimers}
            title="নিয়মাবলী ও নির্দেশিকা"
            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shrink-0 text-slate-700 text-xs"
          >
            📜
          </button>
        )}

        {/* SOS Emergency Button */}
        {onSosClick && (
          <button
            type="button"
            onClick={onSosClick}
            title="জরুরি SOS সুরক্ষা"
            className="h-7 px-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 flex items-center gap-1 transition-all active:scale-95 shrink-0 text-[10px] font-black"
          >
            <ShieldAlert className="w-3 h-3 text-red-600" />
            <span>SOS</span>
          </button>
        )}

        {/* Logout Button — Prominently styled and always visible */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="লগআউট করুন"
            className="h-7.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center gap-1 transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer font-bold text-[11px]"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>লগআউট</span>
          </button>
        )}
      </div>
    </header>
  );
}


