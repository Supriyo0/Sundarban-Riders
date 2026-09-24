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

  // SVG Emblem: Electric Toto with Tiger Speed Waves & Lightning Accents
  const EmblemSvg = (
    <div
      className={`relative flex items-center justify-center shrink-0 ${animated ? "group" : ""}`}
      style={{ width: currentSize.width, height: currentSize.height }}
    >
      {/* Outer Glow Halo on splash or when animated */}
      {animated && (
        <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/30 via-teal-400/20 to-amber-400/30 rounded-3xl blur-xl animate-pulse pointer-events-none" />
      )}

      {/* Main Hex/Squircle Shield */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-md select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          <linearGradient id="goldGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id="canopyGrad" x1="20" y1="25" x2="80" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#047857" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Squircle Badge Background */}
        <rect
          x="6"
          y="6"
          width="88"
          height="88"
          rx="26"
          fill="url(#shieldGrad)"
          stroke="#34d399"
          strokeWidth="2.5"
          filter="url(#badgeShadow)"
        />

        {/* Dynamic Speed Lines (Tiger Aura Stripes) in background */}
        <path
          d="M 16 35 L 32 35 M 12 50 L 36 50 M 18 65 L 30 65"
          stroke="#6ee7b7"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Modern Stylized Toto Silhouette */}
        {/* Canopy Roof */}
        <path
          d="M 36 28 C 36 25, 68 25, 76 34 L 80 48 L 34 48 Z"
          fill="url(#canopyGrad)"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        {/* Canopy Front Visor & Tiger Accent Stripe */}
        <path d="M 52 28 L 56 48" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 64 30 L 68 48" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

        {/* Toto Body Base */}
        <path
          d="M 32 48 L 82 48 C 84 48, 86 52, 85 58 L 81 68 C 80 71, 77 73, 74 73 L 34 73 C 31 73, 29 70, 30 67 L 32 48 Z"
          fill="#10b981"
          stroke="#064e3b"
          strokeWidth="2"
        />

        {/* Front Windshield */}
        <path
          d="M 69 34 L 79 46 L 66 46 Z"
          fill="#38bdf8"
          opacity="0.8"
        />

        {/* Wheels with Silver Hubs */}
        {/* Rear Wheel */}
        <circle cx="42" cy="74" r="10" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="42" cy="74" r="4.5" fill="#f8fafc" />
        {/* Front Wheel */}
        <circle cx="74" cy="74" r="10" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="74" cy="74" r="4.5" fill="#f8fafc" />

        {/* Electric Energy Lightning Bolt Emblem */}
        <path
          d="M 55 12 L 44 26 L 52 26 L 41 42 L 62 23 L 52 23 Z"
          fill="url(#goldGrad)"
          stroke="#ffffff"
          strokeWidth="1.5"
          filter="drop-shadow(0px 2px 4px rgba(245, 158, 11, 0.7))"
        />

        {/* Eco Green Energy Leaves/Dots */}
        <circle cx="22" cy="22" r="3" fill="#a7f3d0" />
        <circle cx="80" cy="20" r="2.5" fill="#fef08a" />
      </svg>
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
