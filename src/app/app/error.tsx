"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MobileAppError] Uncaught route error:", error);
  }, [error]);

  const handleHardRefresh = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("sr_mobile_session");
      } catch {}
      window.location.href = "/app";
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 select-none relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 50%, #f8fafc 100%)",
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
        }}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 mx-auto flex items-center justify-center shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900">
            সাময়িক সংযোগ সমস্যা
          </h3>
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            অ্যাপটি লোড হতে সমস্যা হয়েছে। নিচের বাটনে ট্যাপ করে পেজটি আবার চালু করুন।
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25"
          >
            <RefreshCw className="w-4 h-4" />
            <span>পুনরায় চেষ্টা করুন (Retry)</span>
          </Button>

          <button
            type="button"
            onClick={handleHardRefresh}
            className="w-full h-11 rounded-xl bg-white/80 hover:bg-white text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-200"
          >
            <Home className="w-4 h-4" />
            <span>অ্যাপ রিস্টার্ট করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
}

