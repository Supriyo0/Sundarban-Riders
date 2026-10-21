"use client";

import React from "react";
import { Car, History, Shield, User } from "lucide-react";

export type MobileNavTab = "home" | "trips" | "safety" | "profile" | "map";

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
      activeColor: "from-emerald-500/25 to-teal-500/10",
      textColor: "text-emerald-800",
      indicatorColor: "bg-emerald-600",
    },
    {
      id: "trips" as const,
      label: "হিস্ট্রি",
      icon: History,
      activeColor: "from-purple-500/25 to-indigo-500/10",
      textColor: "text-purple-800",
      indicatorColor: "bg-purple-600",
    },
    {
      id: "safety" as const,
      label: "সুরক্ষা",
      icon: Shield,
      activeColor: "from-rose-500/25 to-red-500/10",
      textColor: "text-red-700",
      indicatorColor: "bg-red-600",
    },
    {
      id: "profile" as const,
      label: "প্রোফাইল",
      icon: User,
      activeColor: "from-blue-500/25 to-indigo-500/10",
      textColor: "text-blue-800",
      indicatorColor: "bg-blue-600",
    },
  ];

  return (
    <nav className="w-full px-3 py-2 select-none">
      <div
        className="max-w-sm mx-auto rounded-3xl grid grid-cols-4 p-1.5 transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.58) 100%)",
          boxShadow:
            "0 20px 48px -10px rgba(0, 0, 0, 0.16), inset 0 2px 2px rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.90)",
          backdropFilter: "blur(36px) saturate(220%)",
          WebkitBackdropFilter: "blur(36px) saturate(220%)",
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
              onClick={() => {
                if (typeof window !== "undefined" && "vibrate" in navigator) {
                  try {
                    navigator.vibrate(12);
                  } catch {}
                }
                onTabChange(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 cursor-pointer active:scale-90 active:backdrop-blur-3xl ${
                isActive
                  ? `bg-gradient-to-b ${tab.activeColor} shadow-xs border border-white/80 font-black`
                  : "hover:bg-white/40 text-slate-500 hover:text-slate-800 font-semibold"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? `${tab.textColor} scale-110 drop-shadow-xs` : "text-slate-400"
                  }`}
                  style={{ strokeWidth: isActive ? 2.6 : 2.0 }}
                />
                {isActive && (
                  <span
                    className={`absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full ${tab.indicatorColor} ring-2 ring-white animate-pulse`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none transition-colors ${
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
