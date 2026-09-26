"use client";

import React from "react";
import { Car, MapPin, History, Shield, Compass } from "lucide-react";

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
    {
      id: "home" as const,
      label: role === "rider" ? "ডিউটি" : "রাইড বুক",
      icon: Car,
      activeColor: "from-emerald-500/20 to-teal-500/10",
      textColor: "text-emerald-700",
      indicatorColor: "bg-emerald-600",
    },
    {
      id: "map" as const,
      label: "লাইভ ম্যাপ",
      icon: Compass,
      activeColor: "from-sky-500/20 to-blue-500/10",
      textColor: "text-sky-700",
      indicatorColor: "bg-sky-600",
    },
    {
      id: "trips" as const,
      label: "হিস্ট্রি",
      icon: History,
      activeColor: "from-purple-500/20 to-indigo-500/10",
      textColor: "text-purple-700",
      indicatorColor: "bg-purple-600",
    },
    {
      id: "safety" as const,
      label: "সুরক্ষা",
      icon: Shield,
      activeColor: "from-rose-500/20 to-red-500/10",
      textColor: "text-red-600",
      indicatorColor: "bg-red-600",
    },
  ];

  return (
    <nav className="w-full px-3 py-2 select-none">
      <div
        className="max-w-sm mx-auto rounded-3xl grid grid-cols-4 p-1.5 transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.92) 100%)",
          boxShadow:
            "0 10px 30px -5px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,1) inset",
          border: "1px solid rgba(226,232,240,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer active:scale-90 ${
                isActive
                  ? `bg-gradient-to-b ${tab.activeColor} shadow-xs border border-white/60 font-black`
                  : "hover:bg-slate-100/70 text-slate-400 hover:text-slate-600 font-semibold"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? `${tab.textColor} scale-110` : "text-slate-400"
                  }`}
                  style={{ strokeWidth: isActive ? 2.6 : 1.9 }}
                />
                {isActive && (
                  <span
                    className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${tab.indicatorColor} ring-2 ring-white animate-pulse`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight transition-colors ${
                  isActive ? `${tab.textColor} font-black` : "text-slate-500 font-medium"
                }`}
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
