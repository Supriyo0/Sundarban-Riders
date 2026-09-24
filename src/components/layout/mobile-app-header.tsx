"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { Volume2, VolumeX, ShieldAlert, User, LogOut, ArrowRightLeft } from "lucide-react";

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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs px-3.5 py-2.5 flex items-center justify-between select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-2">
        <SundarbanLogo size="sm" variant="full" showTagline={false} />
      </div>

      {/* Right Action Icons: Role Switcher, Sound, SOS, Profile */}
      <div className="flex items-center gap-1.5">
        {/* Role Switcher Pill */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-[11px] font-bold border border-slate-200 transition-all active:scale-95 shadow-2xs"
          >
            <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
            <span className="hidden sm:inline">মোড:</span>
            <span>{role === "rider" ? "🛺 চালক" : "👤 যাত্রী"}</span>
          </button>
        )}

        {/* Sound Toggle Button */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={isSoundMuted ? "শব্দ চালু করুন" : "শব্দ বন্ধ করুন"}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
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
            className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </button>
        )}

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="লগআউট করুন"
            className="w-8 h-8 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}
