"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, Star, MapPin, Car, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingCarouselProps {
  onSelectRole: (role: "passenger" | "rider") => void;
  onOpenAdminLogin?: () => void;
}

interface SlideItem {
  id: string;
  image: string;
  badge: string;
  title: string;
  titleBengali?: string;
  subtitle: string;
  type: "welcome" | "happy_journey" | "fast_ride" | "captain";
}

const SLIDES: SlideItem[] = [
  {
    id: "welcome",
    image: "/onboarding/welcome-sundarban.jpg",
    badge: "সুন্দরবন অনলাইন স্মার্ট বুকিং",
    title: "Welcome to Sundarban Rider Online Smart Toto Booking",
    titleBengali: "সময়ের সাথে, সুরক্ষার সাথে, আপনার পাশে...",
    subtitle: "Book your Toto anywhere across Sundarban with 1-tap live tracking.",
    type: "welcome",
  },
  {
    id: "happy-journey",
    image: "/onboarding/safe-happy-journey.jpg",
    badge: "🛺 Sundarban Online Smart Toto Booking",
    title: "Safe & Happy Journey",
    titleBengali: "নিরাপদ ও আনন্দময় যাত্রা",
    subtitle: "Book in 5 minutes • Reach anywhere",
    type: "happy_journey",
  },
  {
    id: "fast-ride",
    image: "/onboarding/safe-fast-ride.jpg",
    badge: "⚡ দ্রুত ও সহজ টোটো বুকিং",
    title: "Safe & Fast Ride",
    titleBengali: "নিরাপদ ও দ্রুত রাইড",
    subtitle: "Book in 5 minutes, reach anywhere across Sundarban",
    type: "fast_ride",
  },
  {
    id: "captain",
    image: "/onboarding/driver-captain.jpg",
    badge: "🛺 Sundarban Riders Captain",
    title: "যে কোনো সময় ও নানা রকম পরিষেবা",
    titleBengali: "বাইক, ডেলিভারি, অটো এবং ক্যাব",
    subtitle: "সুন্দরবনের প্রথম ভেরিফাইড চালক নেটওয়ার্কে যুক্ত হয়ে প্রতিদিন নিশ্চিত আয় করুন।",
    type: "captain",
  },
];

export function OnboardingCarousel({ onSelectRole, onOpenAdminLogin }: OnboardingCarouselProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto-advance slides every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      // Swiped left
      setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
    } else if (distance < -45) {
      // Swiped right
      setCurrentIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const slide = SLIDES[currentIdx];

  return (
    <div
      className="relative w-full h-[100dvh] max-w-md mx-auto overflow-hidden bg-slate-950 flex flex-col justify-between select-none shadow-2xl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image Carousel with Cross-Fade */}
      <div className="absolute inset-0 z-0">
        {SLIDES.map((s, idx) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              currentIdx === idx ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            style={{ transitionProperty: "opacity, transform" }}
          >
            <Image
              src={s.image}
              alt={s.title}
              fill
              priority={idx === 0}
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 448px"
            />
            {/* Subtle Gradient Overlays for Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-slate-950/90" />
          </div>
        ))}
      </div>

      {/* Top Floating Header Bar */}
      <div className="relative z-20 pt-4 px-4 flex items-center justify-between">
        {/* Brand Badge */}
        <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-400 bg-white flex items-center justify-center shrink-0 shadow-md">
            <img
              src="/sundarban-logo.png"
              alt="Sundarban Riders"
              className="w-full h-full object-cover scale-110"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-wider text-white leading-none">
              SUNDARBAN RIDERS
            </span>
            <span className="text-[10px] font-semibold text-amber-400 mt-0.5 leading-none">
              স্মার্ট টোটো বুকিং
            </span>
          </div>
        </div>

        {/* Slide Counter & Staff portal shortcut */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-[11px] font-mono font-bold text-white shadow-sm">
            {currentIdx + 1} of {SLIDES.length}
          </div>
          {onOpenAdminLogin && (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="text-[11px] font-semibold text-slate-300 hover:text-white bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 transition-all"
            >
              CRM/Admin
            </button>
          )}
        </div>
      </div>

      {/* Middle Interactive Zone */}
      <div className="flex-1 flex items-center justify-between px-2 pointer-events-none">
        <button
          type="button"
          onClick={() => setCurrentIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
          className="pointer-events-auto p-2 rounded-full text-white/50 hover:text-white hover:bg-black/30 transition-all opacity-0 hover:opacity-100"
          aria-label="Previous slide"
        >
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="pointer-events-auto p-2 rounded-full text-white/50 hover:text-white hover:bg-black/30 transition-all opacity-0 hover:opacity-100"
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Floating White Card (Exact Design from Screenshots) */}
      <div className="relative z-20 px-4 pb-6 w-full">
        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIdx === idx
                  ? "w-8 bg-amber-400 shadow-md shadow-amber-400/50"
                  : "w-2 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Floating Card Frame */}
        <div
          className="rounded-[28px] p-5 sm:p-6 text-center space-y-3.5 border border-white/40 shadow-2xl transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
          }}
        >
          {/* Badge Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            <span>{slide.badge}</span>
          </div>

          {/* Titles & Headings */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              {slide.title}
            </h2>
            {slide.titleBengali && (
              <h3 className="text-base sm:text-lg font-bold text-emerald-800 leading-snug">
                {slide.titleBengali}
              </h3>
            )}
            <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs mx-auto pt-0.5">
              {slide.subtitle}
            </p>
          </div>

          {/* DYNAMIC ACTION BUTTONS (Exact Match for Screenshots 1, 2, 3, 4) */}
          <div className="space-y-2.5 pt-1">
            {/* SLIDE 1: Welcome Slide (Next -> button + Quick Login Links) */}
            {slide.type === "welcome" && (
              <div className="space-y-2.5">
                <Button
                  size="lg"
                  className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-base shadow-lg shadow-amber-400/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  onClick={handleNext}
                >
                  <span>Next →</span>
                </Button>

                <div className="flex items-center justify-center gap-4 text-xs font-bold pt-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectRole("passenger")}
                    className="text-blue-700 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <span>🛺 যাত্রী বুকিং</span>
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => onSelectRole("rider")}
                    className="text-emerald-700 hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚡ চালক পার্টনার</span>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 2: Safe & Happy Journey (Customer Login [Blue] + Continue [Outline]) */}
            {slide.type === "happy_journey" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
                    onClick={() => onSelectRole("passenger")}
                  >
                    <span>Customer Login</span>
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-2 border-slate-300 text-slate-800 font-bold text-sm hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                    onClick={handleNext}
                  >
                    <span>Continue</span>
                  </Button>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onSelectRole("rider")}
                    className="text-[11px] font-bold text-emerald-800 hover:underline"
                  >
                    Are you a Toto Driver? Tap for Rider Login →
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 3: Safe & Fast Ride (Rider Login [Dark Green] + Customer Login [Gold]) */}
            {slide.type === "fast_ride" && (
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-[#14532d] hover:bg-[#0f3d20] text-white font-black text-sm shadow-md shadow-emerald-950/20 active:scale-95 transition-all cursor-pointer"
                  onClick={() => onSelectRole("rider")}
                >
                  <span>Rider Login</span>
                </Button>

                <Button
                  size="lg"
                  className="h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm shadow-md shadow-amber-400/30 active:scale-95 transition-all cursor-pointer"
                  onClick={() => onSelectRole("passenger")}
                >
                  <span>Customer Login</span>
                </Button>
              </div>
            )}

            {/* SLIDE 4: Rapido Captain Style Driver Onboarding */}
            {slide.type === "captain" && (
              <div className="space-y-2.5">
                <Button
                  size="lg"
                  className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-400/30 active:scale-95 transition-all cursor-pointer"
                  onClick={() => onSelectRole("rider")}
                >
                  <span>গাড়ি চালানো শুরু করুন</span>
                </Button>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 justify-center">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span>বা</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {/* Bottom Customer Ride Card */}
                <button
                  type="button"
                  onClick={() => onSelectRole("passenger")}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-all cursor-pointer text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">গ্রাহক?</span>
                    <span className="text-xs font-extrabold text-blue-700 flex items-center gap-1">
                      রাইড বুক করুন <ArrowRight className="w-3.5 h-3.5 inline" />
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center shrink-0 text-xl">
                    🛺
                  </div>
                </button>
              </div>
            )}

            {/* Terms and Privacy policy disclaimer */}
            <p className="text-[10px] text-slate-400 font-medium pt-1">
              By continuing you agree to Terms & Privacy Policy • Sundarban Riders
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
