"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("sr_mobile_session");
      } catch {}
      window.location.reload();
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 select-none relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 50%, #f8fafc 100%)" }}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 text-center space-y-4"
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.65) 100%)",
              backdropFilter: "blur(30px)",
              WebkitBackdropFilter: "blur(30px)",
              border: "1px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 24px 48px -12px rgba(16, 185, 129, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset",
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                সাময়িক সংযোগ ত্রুটি
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                পেজটি লোড হতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={this.handleReset}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় চেষ্টা করুন (Retry)</span>
              </Button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full h-11 rounded-xl bg-white/70 hover:bg-white text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-200"
              >
                <Home className="w-4 h-4" />
                <span>রিফ্রেশ ও হোম পেজ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
