"use client";

import React from "react";
import { Car, MapPin, History, Shield } from "lucide-react";

export type MobileNavTab = "home" | "map" | "trips" | "safety";

interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onTabChange: (tab: MobileNavTab) => void;
  role: "rider" | "passenger";
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  role,
}: MobileBottomNavProps) {
  const tabs = [
    { id: "home" as const, label: role === "rider" ? "ডিউটি" : "রাইড", icon: Car, color: "emerald" },
    { id: "map" as const, label: "লাইভ ম্যাপ", icon: MapPin, color: "sky" },
    { id: "trips" as const, label: "হিস্ট্রি", icon: History, color: "violet" },
    { id: "safety" as const, label: "সুরক্ষা", icon: Shield, color: "red" },
  ];

  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    emerald: { bg: "rgba(16,185,129,0.13)", text: "#059669", glow: "rgba(16,185,129,0.22)" },
    sky:     { bg: "rgba(14,165,233,0.13)", text: "#0284c7", glow: "rgba(14,165,233,0.22)" },
    violet:  { bg: "rgba(139,92,246,0.13)", text: "#7c3aed", glow: "rgba(139,92,246,0.22)" },
    red:     { bg: "rgba(239,68,68,0.13)",  text: "#dc2626", glow: "rgba(239,68,68,0.22)"  },
  };

  return (
    <nav className="w-full px-3 py-1.5 select-none">
      <div
        className="max-w-sm mx-auto rounded-2xl grid grid-cols-4 p-1"
        style={{
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 2px 14px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9) inset",
          border: "1px solid rgba(226,232,240,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const colors = colorMap[tab.color];

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 active:scale-[0.93]"
              style={isActive ? { background: colors.bg, boxShadow: `0 0 10px ${colors.glow}` } : {}}
            >
              <div className="relative">
                <Icon
                  className="w-5 h-5 transition-all duration-200"
                  style={{ color: isActive ? colors.text : "#94a3b8", strokeWidth: isActive ? 2.5 : 1.8, transform: isActive ? "scale(1.1)" : "scale(1)" }}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: colors.text }} />
                )}
              </div>
              <span
                className="text-[9.5px] mt-1 font-bold tracking-tight"
                style={{ color: isActive ? colors.text : "#94a3b8" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

