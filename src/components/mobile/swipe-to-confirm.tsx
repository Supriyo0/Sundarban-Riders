"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, Check } from "lucide-react";
import { playSuccessSound } from "@/lib/mobile/sound";

interface SwipeToConfirmProps {
  label: string;
  confirmedLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  colorScheme?: "emerald" | "amber" | "blue";
}

export function SwipeToConfirm({
  label,
  confirmedLabel = "সফল হয়েছে ✓",
  onConfirm,
  disabled = false,
  colorScheme = "emerald",
}: SwipeToConfirmProps) {
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const colors = {
    emerald: {
      bg: "bg-emerald-600",
      track: "bg-emerald-950/60 border-emerald-500/30",
      thumb: "bg-white text-emerald-700 shadow-emerald-900/50",
      progress: "bg-emerald-600/50",
    },
    amber: {
      bg: "bg-amber-600",
      track: "bg-amber-950/60 border-amber-500/30",
      thumb: "bg-white text-amber-700 shadow-amber-900/50",
      progress: "bg-amber-600/50",
    },
    blue: {
      bg: "bg-blue-600",
      track: "bg-blue-950/60 border-blue-500/30",
      thumb: "bg-white text-blue-700 shadow-blue-900/50",
      progress: "bg-blue-600/50",
    },
  }[colorScheme];

  const handleStart = (clientX: number) => {
    if (disabled || isConfirmed) return;
    setIsDragging(true);
    startXRef.current = clientX;
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || disabled || isConfirmed) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const maxDrag = rect.width - 60; // thumb width approx 60px
      const currentDelta = clientX - startXRef.current;

      const clamped = Math.max(0, Math.min(currentDelta, maxDrag));
      const progress = clamped / maxDrag;
      setDragProgress(progress);

      if (progress >= 0.85) {
        setIsDragging(false);
        setIsConfirmed(true);
        setDragProgress(1);
        playSuccessSound();
        onConfirm();
      }
    },
    [isDragging, disabled, isConfirmed, onConfirm]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging || isConfirmed) return;
    setIsDragging(false);
    // Animate snap-back if not confirmed
    setDragProgress(0);
  }, [isDragging, isConfirmed]);

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();

    if (isDragging) {
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div
      ref={containerRef}
      className={`relative h-16 w-full select-none overflow-hidden rounded-full border p-1 shadow-inner transition-colors ${
        colors.track
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
    >
      {/* Background Fill Progress */}
      <div
        className={`absolute inset-y-0 left-0 transition-all ${colors.progress}`}
        style={{ width: `${dragProgress * 100}%` }}
      />

      {/* Label Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12 text-center text-sm font-bold tracking-wide text-white drop-shadow">
        {isConfirmed ? (
          <span className="flex items-center gap-2 text-emerald-300">
            <Check className="h-5 w-5" /> {confirmedLabel}
          </span>
        ) : (
          <span className="opacity-90">{label}</span>
        )}
      </div>

      {/* Draggable Thumb */}
      <div
        className={`absolute top-1 bottom-1 flex aspect-square items-center justify-center rounded-full shadow-lg transition-transform ${
          colors.thumb
        } ${isDragging ? "scale-105" : ""}`}
        style={{
          transform: `translateX(${
            containerRef.current
              ? dragProgress * (containerRef.current.clientWidth - 68)
              : 0
          }px)`,
        }}
      >
        {isConfirmed ? (
          <Check className="h-6 w-6 stroke-[3]" />
        ) : (
          <ChevronRight className="h-6 w-6 stroke-[3] animate-pulse" />
        )}
      </div>
    </div>
  );
}
