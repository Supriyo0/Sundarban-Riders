"use client";

import React from "react";

interface SundarbanLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "splash";
  variant?: "full" | "icon" | "horizontal" | "badge" | "banner";
  theme?: "light" | "dark" | "glass";
  showTagline?: boolean;
  animated?: boolean;
  className?: string;
}

export function SundarbanLogo({
  size = "md",
  variant = "full",
  theme = "light",
  showTagline = true,
  animated = false,
  className = "",
}: SundarbanLogoProps) {
  // Dimensions based on size prop
  const iconSizes = {
    sm: { width: 38, height: 38, fontSize: "text-base", subSize: "text-[11px]" },
    md: { width: 50, height: 50, fontSize: "text-lg", subSize: "text-xs" },
    lg: { width: 68, height: 68, fontSize: "text-2xl", subSize: "text-sm" },
    xl: { width: 88, height: 88, fontSize: "text-3xl", subSize: "text-base" },
    splash: { width: 116, height: 116, fontSize: "text-3xl", subSize: "text-sm" },
  };

  const currentSize = iconSizes[size];

  // Emblem: 100% Circular Tiger Official Logo
  const EmblemSvg = (
    <div
      className={`relative shrink-0 flex items-center justify-center ${animated ? "group" : ""}`}
      style={{ width: currentSize.width, height: currentSize.height }}
    >
      {/* Outer Glow Halo on splash or when animated */}
      {animated && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-400/40 via-emerald-400/30 to-teal-400/30 rounded-full blur-lg animate-pulse pointer-events-none" />
      )}

      {/* Circular Emblem Frame */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-white shadow-md ring-2 ring-amber-400/70 flex items-center justify-center">
        <img
          src="/sundarban-logo.png"
          alt="Sundarban Riders Logo"
          className="w-full h-full object-cover scale-[1.02] select-none rounded-full"
        />
      </div>
    </div>
  );

  // Icon only
  if (variant === "icon") {
    return <div className={`inline-flex items-center ${className}`}>{EmblemSvg}</div>;
  }

  // Exact Official Dark Pill Banner matching User's Provided Image
  if (variant === "banner") {
    return (
      <div
        className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-slate-950/95 border border-slate-800 shadow-xl select-none ${className}`}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-amber-400 shrink-0 shadow-md flex items-center justify-center bg-white">
          <img
            src="/sundarban-logo.png"
            alt="Sundarban Riders Logo"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="flex flex-col text-left pr-2">
          <span className="font-black text-sm tracking-wide text-white uppercase leading-none">
            SUNDARBAN RIDERS
          </span>
          <span className="font-bold text-xs text-amber-400 mt-1 leading-none">
            অনলাইন স্মার্ট টোটো বুকিং
          </span>
        </div>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div
      className={`inline-flex items-center gap-3 ${
        variant === "badge"
          ? "p-2.5 rounded-2xl bg-white/95 backdrop-blur-md shadow-sm border border-slate-200"
          : ""
      } ${className}`}
    >
      {EmblemSvg}

      <div className="flex flex-col select-none text-left">
        {/* English Brand Name */}
        <div className="flex items-center gap-1.5">
          <span
            className={`font-black tracking-tight leading-none ${currentSize.fontSize} ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            SUNDARBAN
          </span>
          <span className="font-black tracking-tight text-emerald-600 leading-none">
            RIDERS
          </span>
        </div>

        {/* Bengali Brand Subtitle (Online Smart Toto Booking in Bengali) */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`font-bold tracking-tight leading-tight ${currentSize.subSize} ${
              isDark ? "text-amber-300" : "text-amber-600"
            }`}
          >
            অনলাইন স্মার্ট টোটো বুকিং
          </span>

          {showTagline && size !== "sm" && (
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                isDark
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              ২৪×৭
            </span>
          )}
        </div>

        {/* Secondary subtitle on splash / large view */}
        {showTagline && (size === "lg" || size === "xl" || size === "splash") && (
          <span className="text-[11px] font-semibold text-slate-400 mt-1">
            কাকদ্বীপ • নামখানা • ডায়মন্ড হারবার • দক্ষিণ ২৪ পরগনা
          </span>
        )}
      </div>
    </div>
  );
}
