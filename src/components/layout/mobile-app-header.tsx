"use client";

import React from "react";
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { ShieldAlert, ArrowRightLeft, Volume2, VolumeX, User } from "lucide-react";

interface MobileAppHeaderProps {
  role: "rider" | "passenger";
  userName?: string;
  userPhoto?: string;
  isOnline?: boolean;
  onToggleOnline?: (online: boolean) => void;
  todayEarnings?: number;
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
  isOnline = true,
  onToggleOnline,
  todayEarnings,
  isSoundMuted = false,
  onToggleSound,
  onSwitchRole,
  onSosClick,
  onOpenDisclaimers,
  onOpenProfile,
}: MobileAppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-3 sm:px-4 py-2 select-none">
      <div
        className="relative h-14 px-3.5 rounded-3xl flex items-center justify-between transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.62) 100%)",
          backdropFilter: "blur(40px) saturate(210%)",
          WebkitBackdropFilter: "blur(40px) saturate(210%)",
          border: "1.5px solid rgba(255, 255, 255, 0.95)",
          boxShadow: "0 18px 40px -10px rgba(0, 0, 0, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -1px 1px rgba(255, 255, 255, 0.4)",
        }}
      >
        {/* Top subtle iridescent specular glass sheen */}
        <div className="absolute top-0 inset-x-4 h-3 bg-gradient-to-b from-white/80 via-white/20 to-transparent rounded-t-3xl pointer-events-none" />

        {/* Brand & User info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 z-10">
          <div className="w-8.5 h-8.5 rounded-full overflow-hidden shrink-0 ring-2 ring-emerald-500/30 shadow-xs flex items-center justify-center bg-white p-0.5 border border-white">
            <img
              src="/sundarban-logo.png"
              alt="Sundarban Riders Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-slate-900 leading-none">
                SUNDARBAN
              </span>
              <span className="font-black text-sm tracking-tight text-emerald-600 leading-none">
                RIDERS
              </span>
            </div>
            {userName && (
              <span className={`text-[11px] font-bold text-slate-600 truncate mt-0.5 leading-tight items-center gap-1 ${role === "rider" ? "hidden sm:flex" : "flex"}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{role === "rider" ? "🛺 " : "👤 "}{userName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: iOS Liquid Glass Pill Keys */}
        <div className="flex items-center gap-1.5 shrink-0 z-10">
          {/* Driver Online / Offline Toggle Pill */}
          {role === "rider" && onToggleOnline && (
            <button
              type="button"
              onClick={() => onToggleOnline(!isOnline)}
              className={`h-8 px-2.5 rounded-xl text-xs font-black transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isOnline
                  ? "bg-emerald-600 text-white shadow-emerald-600/30 ring-1 ring-emerald-500/30"
                  : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-red-500"}`} />
              <span className="truncate">{isOnline ? "অনলাইন" : "অফলাইন"}</span>
            </button>
          )}

          {/* Sound toggle (Hidden on mobile for rider to prevent crowding) */}
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              title={isSoundMuted ? "সাউন্ড চালু করুন" : "সাউন্ড মিউট করুন"}
              className={`w-8 h-8 rounded-xl bg-white/70 hover:bg-white/95 border border-white/80 shadow-xs items-center justify-center text-slate-600 transition-all active:scale-90 active:backdrop-blur-3xl cursor-pointer ${
                role === "rider" ? "hidden sm:flex" : "flex"
              }`}
            >
              {isSoundMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          )}

          {/* Role Switcher (Hidden on mobile for rider; rider switches from bottom nav / profile) */}
          {onSwitchRole && (
            <button
              type="button"
              onClick={onSwitchRole}
              title={role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "চালক মোডে স্যুইচ করুন"}
              className={`h-8 px-2.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-900 items-center gap-1 transition-all active:scale-90 cursor-pointer shadow-xs ${
                role === "rider" ? "hidden sm:flex" : "flex"
              }`}
            >
              <ArrowRightLeft className="w-3 h-3 text-emerald-700" />
              <span>{role === "rider" ? "চালক" : "যাত্রী"}</span>
            </button>
          )}

          {/* iOS Profile Avatar Button */}
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              title="প্রোফাইল ও কেওয়াইসি (Profile & KYC)"
              className="w-8.5 h-8.5 rounded-full ring-2 ring-emerald-500/40 hover:ring-emerald-500 bg-white/80 flex items-center justify-center text-emerald-800 transition-all active:scale-90 cursor-pointer overflow-hidden shadow-xs border border-white shrink-0"
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
      </div>
    </header>
  );
}
