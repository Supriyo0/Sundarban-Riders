"use client";

import React from "react";

interface SundarbanLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "splash";
  variant?: "full" | "icon" | "horizontal" | "badge";
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
    sm: { width: 36, height: 36, fontSize: "text-base", subSize: "text-[10px]" },
    md: { width: 48, height: 48, fontSize: "text-lg", subSize: "text-xs" },
    lg: { width: 64, height: 64, fontSize: "text-2xl", subSize: "text-sm" },
    xl: { width: 84, height: 84, fontSize: "text-3xl", subSize: "text-base" },
    splash: { width: 110, height: 110, fontSize: "text-3xl", subSize: "text-sm" },
  };

  const currentSize = iconSizes[size];

  // Emblem: Actual Official Logo Image in a 100% circular, polished badge
  const EmblemSvg = (
    <div
      className={`relative shrink-0 flex items-center justify-center ${animated ? "group" : ""}`}
      style={{ width: currentSize.width, height: currentSize.height }}
    >
      {/* Outer Glow Halo on splash or when animated */}
      {animated && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500/40 via-teal-400/30 to-amber-400/30 rounded-full blur-lg animate-pulse pointer-events-none" />
      )}

      {/* Circular Emblem Frame */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-white shadow-sm ring-2 ring-emerald-500/30 flex items-center justify-center">
        <img
          src="/sundarban-logo.png"
          alt="Sundarban Riders Logo"
          className="w-full h-full object-cover scale-[1.05] select-none rounded-full"
        />
      </div>
    </div>
  );

  if (variant === "icon") {
    return <div className={`inline-flex items-center ${className}`}>{EmblemSvg}</div>;
  }

  const isDark = theme === "dark";

  return (
    <div
      className={`inline-flex items-center gap-3 ${
        variant === "badge" ? "p-2 rounded-2xl bg-white/90 backdrop-blur-md shadow-sm border border-slate-200" : ""
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

        {/* Bengali Brand Subtitle */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`font-bold tracking-tight leading-tight ${currentSize.subSize} ${
              isDark ? "text-emerald-300" : "text-emerald-700"
            }`}
          >
            সুন্দরবন রাইডার্স
          </span>

          {showTagline && size !== "sm" && (
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                isDark
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              ই-টোটো ২৪×৭
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
