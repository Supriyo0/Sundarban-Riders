"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { Volume2, VolumeX, ShieldAlert, LogOut, ArrowRightLeft } from "lucide-react";

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
    <header
      className="sticky top-0 z-30 px-3.5 py-2.5 flex items-center justify-between select-none"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(226,232,240,0.7)",
        boxShadow: "0 1px 12px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset",
      }}
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-2">
        <SundarbanLogo size="sm" variant="full" showTagline={false} />
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1.5">
        {/* Role Switcher Pill */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
            style={{
              background: "rgba(241,245,249,0.9)",
              border: "1px solid rgba(203,213,225,0.8)",
              color: "#334155",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "rgba(241,245,249,0.9)",
              border: "1px solid rgba(203,213,225,0.8)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "rgba(254,242,242,0.9)",
              border: "1px solid rgba(252,165,165,0.6)",
              boxShadow: "0 1px 3px rgba(239,68,68,0.1)",
            }}
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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "rgba(241,245,249,0.9)",
              border: "1px solid rgba(203,213,225,0.8)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>
    </header>
  );
}

