"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, ChevronRight, Sparkles, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingCarouselProps {
  onSelectRole: (role: "passenger" | "rider") => void;
}

interface SlideItem {
  id: string;
  image: string;
  badge: string;
  title: string;
  titleBengali?: string;
  subtitle: string;
  isActionPage?: boolean;
}

const SLIDES: SlideItem[] = [
  {
    id: "welcome",
    image: "/onboarding/welcome-sundarban.jpg",
    badge: "সুন্দরবন অনলাইন স্মার্ট বুকিং",
    title: "Welcome to Sundarban Riders",
    titleBengali: "সুন্দরবনের প্রথম অনলাইন স্মার্ট টোটো বুকিং",
    subtitle: "কাকদ্বীপ, নামখানা, ডায়মন্ড হারবার ও গঙ্গাসাগরে নিরাপদ, নির্ভরযোগ্য ও দ্রুত ই-টোটো যাতায়াত।",
    isActionPage: false,
  },
  {
    id: "happy-journey",
    image: "/onboarding/safe-happy-journey.jpg",
    badge: "🛡️ নিরাপদ ও আনন্দময় যাত্রা",
    title: "Safe & Happy Journey",
    titleBengali: "পরিবারের সবার জন্য সুরক্ষিত রাইড",
    subtitle: "ভেরিফাইড চালক, পরিষ্কার বৈদ্যুতিক টোটো এবং প্রতিটি রাইডে ২৪×৭ লাইভ রোড ও জিপিএস নিরাপত্তা।",
    isActionPage: false,
  },
  {
    id: "fast-ride",
    image: "/onboarding/safe-fast-ride.jpg",
    badge: "⚡ মাত্র ৫ মিনিটে দোরগোড়ায়",
    title: "Safe & Fast Ride",
    titleBengali: "ন্যায্য ভাড়ায় সরাসরি গন্তব্য",
    subtitle: "কোনো দরদাম ছাড়াই নির্ধারিত ভাড়ায় সরাসরি গন্তব্যে পৌঁছান। সহজে রাইড বুক করুন এক ক্লিকে।",
    isActionPage: false,
  },
  {
    id: "action-page",
    image: "/onboarding/sundarban-river-driver.jpg",
    badge: "🛺 সুন্দরবন রাইডার্সে স্বাগতম",
    title: "শুরু করুন আপনার যাত্রা",
    titleBengali: "যাত্রী বুকিং ও চালক পার্টনার",
    subtitle: "অনলাইনে এখনই টোটো বুক করুন অথবা সুন্দরবনের ভেরিফাইড চালক নেটওয়ার্কে যুক্ত হয়ে নিশ্চিত আয় করুন।",
    isActionPage: true,
  },
];

export function OnboardingCarousel({ onSelectRole }: OnboardingCarouselProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Auto-advance slides every 7 seconds, unless on the last action page
  useEffect(() => {
    if (currentIdx === SLIDES.length - 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev < SLIDES.length - 1 ? prev + 1 : prev));
    }, 7000);
    return () => clearInterval(timer);
  }, [currentIdx]);

  const handleNext = () => {
    setCurrentIdx((prev) => (prev < SLIDES.length - 1 ? prev + 1 : prev));
  };

  const handleSkip = () => {
    setCurrentIdx(SLIDES.length - 1);
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
      // Swiped left -> next
      if (currentIdx < SLIDES.length - 1) {
        setCurrentIdx((prev) => prev + 1);
      }
    } else if (distance < -45) {
      // Swiped right -> prev
      if (currentIdx > 0) {
        setCurrentIdx((prev) => prev - 1);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const slide = SLIDES[currentIdx];
  const isLastSlide = currentIdx === SLIDES.length - 1;

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
              priority={idx === 0 || idx === 1}
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 448px"
            />
            {/* Subtle Gradient Overlays for Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-slate-950/90" />
          </div>
        ))}
      </div>

      {/* Top Centered Header Bar (Logo in middle, name & tagline below) */}
      <div className="relative z-20 pt-4 px-4 flex flex-col items-center justify-center text-center">
        {/* Top-Right: Skip or Page Counter */}
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {!isLastSlide ? (
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              Skip
            </button>
          ) : (
            <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-[11px] font-mono font-bold text-white shadow-sm">
              4 of 4
            </div>
          )}
        </div>

        {/* Brand in Center: Logo -> SUNDARBAN RIDERS -> অনলাইন স্মার্ট টোটো বুকিং */}
        <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-2 ring-amber-400 bg-white/95 p-0.5 flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.6)]">
            <img
              src="/sundarban-logo.png"
              alt="Sundarban Riders Logo"
              className="w-full h-full object-cover scale-110"
            />
          </div>
          <span className="text-xs sm:text-sm font-black tracking-widest text-white mt-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            SUNDARBAN RIDERS
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] mt-0.5">
            অনলাইন স্মার্ট টোটো বুকিং
          </span>
        </div>
      </div>

      {/* Middle Interactive Zone for subtle left/right arrows */}
      <div className="flex-1 flex items-center justify-between px-2 pointer-events-none">
        {currentIdx > 0 ? (
          <button
            type="button"
            onClick={() => setCurrentIdx((prev) => prev - 1)}
            className="pointer-events-auto p-2.5 rounded-full text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all cursor-pointer ml-1"
            aria-label="Previous slide"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        ) : (
          <div className="w-9" />
        )}

        {!isLastSlide ? (
          <button
            type="button"
            onClick={handleNext}
            className="pointer-events-auto p-2.5 rounded-full text-white/60 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all cursor-pointer mr-1"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Bottom Floating White Card */}
      <div className="relative z-20 px-4 pb-6 w-full">
        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIdx === idx
                  ? "w-8 bg-amber-400 shadow-md shadow-amber-400/50"
                  : "w-2 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Floating Card Frame (Compact & Sleek to give background room) */}
        <div
          className="rounded-3xl p-3.5 sm:p-4 text-center space-y-2 border border-white/50 shadow-2xl transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* Badge Tag */}
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
            <span>{slide.badge}</span>
          </div>

          {/* Titles & Headings */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {slide.title}
              </h2>
              {slide.titleBengali && (
                <span className="text-xs sm:text-sm font-extrabold text-emerald-800 leading-tight">
                  • {slide.titleBengali}
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-600 font-medium leading-tight max-w-xs mx-auto">
              {slide.subtitle}
            </p>
          </div>

          {/* DYNAMIC ACTION BUTTONS */}
          <div className="space-y-1.5 pt-0.5">
            {!isLastSlide ? (
              /* SLIDES 1, 2, 3: Informative walkthrough with Next -> Button */
              <div className="space-y-1.5">
                <Button
                  size="sm"
                  className="w-full h-10 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-400/25 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  onClick={handleNext}
                >
                  <span>পরবর্তী ধাপ (Next)</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                </Button>
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold">
                  <span>ধাপ {currentIdx + 1} / {SLIDES.length}</span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    সরাসরি বুকিংয়ে যান →
                  </button>
                </div>
              </div>
            ) : (
              /* SLIDE 4 (LAST PAGE): Action Screen -> Rider Login & Book Toto */
              <div className="space-y-1.5">
                {/* 1. Book Toto Button (Passenger Cab Booking) */}
                <button
                  type="button"
                  id="btn-book-toto-main"
                  onClick={() => onSelectRole("passenger")}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 text-slate-950 shadow-md shadow-amber-400/20 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-amber-300 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/95 shadow-2xs flex items-center justify-center text-lg shrink-0">
                      🛺
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-950 tracking-tight leading-tight">
                        টোটো বুক করুন (Book Toto)
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 block truncate">
                        যাত্রী মোড • ম্যাপে ৫ মিনিটে ক্যাব
                      </span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0 ml-2">
                    <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                  </div>
                </button>

                {/* 2. Rider Partner Login Button */}
                <button
                  type="button"
                  id="btn-rider-login-main"
                  onClick={() => onSelectRole("rider")}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-emerald-50/60 text-slate-900 shadow-2xs active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-emerald-500/40 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-base shrink-0 shadow-2xs">
                      👨‍✈️
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                        ক্যাপ্টেন / চালক লগইন (Rider Login)
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 block truncate">
                        উপার্জন শুরু করুন • চালক পার্টনার হাব
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                </button>
              </div>
            )}

            {/* Official Registration & Contact Details Mentioned in Little */}
            <div className="pt-1.5 border-t border-slate-200/80 text-center space-y-0.5 select-text">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9.5px] text-slate-600 font-semibold">
                <span className="flex items-center gap-0.5">
                  <span className="text-slate-400">Licence No :</span>
                  <span className="font-bold text-slate-800 font-mono">1554</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-0.5">
                  <span className="text-slate-400">Reg. No :</span>
                  <span className="font-bold text-slate-800 font-mono">WB-18-0208526</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9.5px] text-slate-600 font-semibold">
                <a
                  href="mailto:sr.rider122@gmail.com"
                  className="text-slate-700 hover:text-emerald-700 transition-colors flex items-center gap-0.5"
                >
                  <span className="text-slate-400">Email :</span>
                  <span className="font-medium underline decoration-slate-300">sr.rider122@gmail.com</span>
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="https://wa.me/918348122122"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 font-bold transition-colors flex items-center gap-0.5"
                >
                  <span className="text-slate-400">Help :</span>
                  <span className="font-mono text-emerald-800 font-bold">8348122122</span>
                  <span className="text-[8.5px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black">WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Terms and Privacy policy disclaimer */}
            <p className="text-[9px] text-slate-400 font-medium">
              By continuing you agree to Terms & Privacy Policy • Sundarban Riders
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
