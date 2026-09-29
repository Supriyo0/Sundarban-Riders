"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { ShieldAlert, ArrowRightLeft, Volume2, VolumeX, User } from "lucide-react";

interface MobileAppHeaderProps {
  role: "rider" | "passenger";
  userName?: string;
  userPhoto?: string;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  onSwitchRole?: () => void;
  onSosClick?: () => void;
  onOpenDisclaimers?: () => void;
  onOpenProfile?: () => void;
}

export function MobileAppHeader({
  role,
  userName,
  userPhoto,
  isSoundMuted = false,
  onToggleSound,
  onSwitchRole,
  onSosClick,
  onOpenDisclaimers,
  onOpenProfile,
}: MobileAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 px-3 sm:px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs flex items-center justify-between select-none">
      {/* Brand & User info */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <SundarbanLogo size="sm" variant="icon" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-tight text-slate-900 leading-none">
              SUNDARBAN
            </span>
            <span className="font-black text-sm tracking-tight text-emerald-600 leading-none">
              RIDERS
            </span>
          </div>
          {userName && (
            <span className="text-[11px] font-bold text-slate-600 truncate mt-0.5 leading-tight">
              {role === "rider" ? "🛺 " : "👤 "}{userName}
            </span>
          )}
        </div>
      </div>

      {/* Right Controls: Uber-style profile pill & controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Sound toggle (subtle) */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            title={isSoundMuted ? "সাউন্ড চালু করুন" : "সাউন্ড মিউট করুন"}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all active:scale-95 cursor-pointer"
          >
            {isSoundMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
        )}

        {/* Role Switcher */}
        {onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
            className="h-8 px-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
            <span>{role === "rider" ? "চালক" : "যাত্রী"}</span>
          </button>
        )}

        {/* Uber Profile Avatar Button */}
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            title="প্রোফাইল ও কেওয়াইসি (Profile & KYC)"
            className="w-8 h-8 rounded-full ring-2 ring-emerald-500/40 hover:ring-emerald-600 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-800 transition-transform active:scale-90 cursor-pointer overflow-hidden shadow-xs"
          >
            {userPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhoto} alt={userName || "Profile"} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black">
                {userName ? userName.slice(0, 1).toUpperCase() : role === "rider" ? "🛺" : "👤"}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
