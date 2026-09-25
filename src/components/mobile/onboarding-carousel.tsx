"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowRight, ChevronRight, Sparkles, User, ShieldCheck } from "lucide-react";
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
    image: "/onboarding/driver-captain.jpg",
    badge: "🛺 সুন্দরবন রাইডার্সে স্বাগতম",
    title: "শুরু করুন আপনার যাত্রা",
    titleBengali: "যাত্রী বুকিং ও চালক পার্টনার",
    subtitle: "অনলাইনে এখনই টোটো বুক করুন অথবা সুন্দরবনের ভেরিফাইড চালক নেটওয়ার্কে যুক্ত হয়ে নিশ্চিত আয় করুন।",
    isActionPage: true,
  },
];

export function OnboardingCarousel({ onSelectRole, onOpenAdminLogin }: OnboardingCarouselProps) {
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

      {/* Top Floating Header Bar */}
      <div className="relative z-20 pt-4 px-4 flex items-center justify-between">
        {/* Brand Badge */}
        <div className="flex items-center gap-2.5 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
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

        {/* Top-Right: Skip or Page Counter */}
        <div className="flex items-center gap-2">
          {!isLastSlide ? (
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              Skip
            </button>
          ) : (
            <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-[11px] font-mono font-bold text-white shadow-sm">
              4 of 4
            </div>
          )}
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

        {/* Floating Card Frame */}
        <div
          className="rounded-[28px] p-5 sm:p-6 text-center space-y-3.5 border border-white/40 shadow-2xl transition-all"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 20px 45px rgba(0,0,0,0.45)",
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

          {/* DYNAMIC ACTION BUTTONS */}
          <div className="space-y-2.5 pt-1">
            {!isLastSlide ? (
              /* SLIDES 1, 2, 3: Pure informative walkthrough with Next -> Button */
              <div className="space-y-2">
                <Button
                  size="lg"
                  className="w-full h-13 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-base shadow-lg shadow-amber-400/30 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  onClick={handleNext}
                >
                  <span>পরবর্তী ধাপ (Next)</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </Button>
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold pt-0.5">
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
              <div className="space-y-3">
                {/* 1. Book Toto Button (Passenger Cab Booking) */}
                <button
                  type="button"
                  id="btn-book-toto-main"
                  onClick={() => onSelectRole("passenger")}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 shadow-xl shadow-amber-400/35 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-amber-300 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/90 shadow-sm flex items-center justify-center text-2xl shrink-0">
                      🛺
                    </div>
                    <div>
                      <div className="text-base font-black text-slate-950 tracking-tight leading-snug flex items-center gap-1.5">
                        <span>টোটো বুক করুন (Book Toto)</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-800">
                        যাত্রী মোড • ম্যাপে ৫ মিনিটে ক্যাব
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0">
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </button>

                {/* 2. Rider Partner Login Button */}
                <button
                  type="button"
                  id="btn-rider-login-main"
                  onClick={() => onSelectRole("rider")}
                  className="w-full p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/25 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-slate-700 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
                      ⚡
                    </div>
                    <div>
                      <div className="text-sm font-black text-white tracking-tight leading-snug">
                        ক্যাপ্টেন / চালক লগইন (Rider Login)
                      </div>
                      <span className="text-[11px] font-medium text-emerald-400">
                        উপার্জন শুরু করুন • চালক পার্টনার হাব
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>

                {/* Staff / CRM Shortcut Link */}
                {onOpenAdminLogin && (
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={onOpenAdminLogin}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer py-1"
                    >
                      <span>অফিস স্টাফ বা অ্যাডমিন? CRM ড্যাশবোর্ড লগইন →</span>
                    </button>
                  </div>
                )}
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
