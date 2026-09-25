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
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 text-white select-none">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                সাময়িক সংযোগ ত্রুটি
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                পেজটি লোড হতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={this.handleReset}
                className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-400/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>পুনরায় চেষ্টা করুন (Retry)</span>
              </Button>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
