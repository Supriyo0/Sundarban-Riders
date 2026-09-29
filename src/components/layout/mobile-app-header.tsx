"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { Volume2, VolumeX, ShieldAlert, ArrowRightLeft } from "lucide-react";

interface MobileAppHeaderProps {
  role: "rider" | "passenger";
  userName?: string;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  onSwitchRole?: () => void;
  onSosClick?: () => void;
  onOpenDisclaimers?: () => void;
}

export function MobileAppHeader({
  role,
  userName,
  isSoundMuted = false,
  onToggleSound,
  onSwitchRole,
  onSosClick,
  onOpenDisclaimers,
}: MobileAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 min-h-[58px] px-3 py-2 bg-white/98 backdrop-blur-xl border-b border-slate-200 shadow-xs flex items-center justify-between select-none gap-2">
      {/* Brand & User Title — flex-1 ensures it has ample width and NEVER hides */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SundarbanLogo size="sm" variant="icon" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-black text-sm tracking-tight text-slate-900 leading-none">
              SUNDARBAN
            </span>
            <span className="font-black text-sm tracking-tight text-emerald-600 leading-none">
              RIDERS
            </span>
            <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/80 leading-none shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>২৪×৭</span>
            </span>
          </div>

          <div className="flex items-center gap-1 mt-0.5 min-w-0">
            {userName ? (
              <span className="text-[11px] font-bold text-slate-700 truncate leading-tight max-w-[150px] sm:max-w-[220px]">
                {role === "rider" ? "🛺 " : "👤 "}{userName}
              </span>
            ) : (
              <span className="text-[9.5px] font-bold text-amber-600 truncate leading-tight">
                অনলাইন স্মার্ট টোটো বুকিং
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Action Controls — Ultra-compact to prevent stealing width from title */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Role Switcher Pill */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="flex items-center gap-1 h-7.5 px-2 rounded-lg text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 transition-all active:scale-95 shrink-0 shadow-2xs"
          >
            <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
            <span>{role === "rider" ? "চালক" : "যাত্রী"}</span>
          </button>
        )}

        {/* Sound Toggle Button */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={isSoundMuted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন"}
            className="h-7.5 w-7.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-2xs"
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
            className="h-7.5 w-7.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shrink-0 text-slate-700 text-xs shadow-2xs"
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
            className="h-7.5 px-2 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 transition-all active:scale-95 shrink-0 text-[10.5px] font-black shadow-xs cursor-pointer"
          >
            <ShieldAlert className="w-3 h-3 text-white" />
            <span>SOS</span>
          </button>
        )}
      </div>
    </header>
  );
}
