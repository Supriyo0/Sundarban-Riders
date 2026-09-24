"use client";

import React from "react";
import { Car, MapPin, History, Shield, User } from "lucide-react";

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
      label: role === "rider" ? "ডিউটি" : "রাইড",
      icon: Car,
    },
    {
      id: "map" as const,
      label: "লাইভ ম্যাপ",
      icon: MapPin,
    },
    {
      id: "trips" as const,
      label: "হিস্ট্রি",
      icon: History,
    },
    {
      id: "safety" as const,
      label: "সুরক্ষা",
      icon: Shield,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-4 py-2 select-none safe-bottom">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? "bg-emerald-50 text-emerald-700 font-extrabold shadow-2xs scale-102"
                  : "text-slate-600 hover:text-slate-800 font-medium hover:bg-slate-50"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? "scale-110 text-emerald-600 stroke-[2.5]" : "stroke-[1.8]"
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
