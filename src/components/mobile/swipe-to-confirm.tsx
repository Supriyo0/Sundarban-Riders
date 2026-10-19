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
      track: "bg-emerald-50/90 border-emerald-200 shadow-inner",
      thumb: "bg-emerald-600 text-white shadow-md shadow-emerald-600/30",
      progress: "bg-emerald-200/70",
      textColor: "text-emerald-950 font-bold",
    },
    amber: {
      bg: "bg-amber-600",
      track: "bg-amber-50/90 border-amber-200 shadow-inner",
      thumb: "bg-amber-600 text-white shadow-md shadow-amber-600/30",
      progress: "bg-amber-200/70",
      textColor: "text-amber-950 font-bold",
    },
    blue: {
      bg: "bg-blue-50/90 border-blue-200 shadow-inner",
      track: "bg-blue-50/90 border-blue-200 shadow-inner",
      thumb: "bg-blue-600 text-white shadow-md shadow-blue-600/30",
      progress: "bg-blue-200/70",
      textColor: "text-blue-950 font-bold",
    },
  }[colorScheme];

  const triggerConfirm = useCallback(() => {
    if (disabled || isConfirmed) return;
    setIsDragging(false);
    setIsConfirmed(true);
    setDragProgress(1);
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([35, 20, 50]);
      }
    } catch {}
    playSuccessSound();
    onConfirm();
  }, [disabled, isConfirmed, onConfirm]);

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
      const progress = maxDrag > 0 ? clamped / maxDrag : 0;
      setDragProgress(progress);

      // 55% threshold for ultra-smooth effortless confirmation on mobile
      if (progress >= 0.55) {
        triggerConfirm();
      }
    },
    [isDragging, disabled, isConfirmed, triggerConfirm]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging || isConfirmed) return;
    setIsDragging(false);
    // Animate snap-back if not confirmed
    setDragProgress(0);
  }, [isDragging, isConfirmed]);

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
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
      className={`relative h-16 w-full select-none touch-none overflow-hidden rounded-full border p-1 transition-colors ${
        colors.track
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
    >
      {/* Background Fill Progress */}
      <div
        className={`absolute inset-y-0 left-0 ${isDragging ? "" : "transition-all duration-200"} ${colors.progress}`}
        style={{ width: `${dragProgress * 100}%` }}
      />

      {/* Label Text */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none px-12 text-center text-sm tracking-wide ${colors.textColor}`}>
        {isConfirmed ? (
          <span className="flex items-center gap-2 text-emerald-800 font-bold">
            <Check className="h-5 w-5 stroke-[3]" /> {confirmedLabel}
          </span>
        ) : (
          <span>{label}</span>
        )}
      </div>

      {/* Draggable Thumb with zero-latency 60fps tracking */}
      <div
        className={`absolute top-1 bottom-1 flex aspect-square items-center justify-center rounded-full shadow-md will-change-transform ${
          colors.thumb
        } ${isDragging ? "scale-105 shadow-xl transition-none" : "transition-transform duration-200"}`}
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
