/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Car,
  User,
  ShieldCheck,
  MapPin,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
  Volume2,
  LogOut,
  RefreshCw,
  ArrowRight,
  Upload,
  FileText,
  CreditCard,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Star,
  Zap,
  Share2,
  Copy,
  MessageCircle,
  X,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SwipeToConfirm } from "@/components/mobile/swipe-to-confirm";
import { playRideAlertSound, playSuccessSound } from "@/lib/mobile/sound";
import dynamic from "next/dynamic";
import { TripCompletionReceipt } from "@/components/mobile/trip-completion-receipt";
import { DriverRadarPanel } from "@/components/mobile/driver-radar-panel";

const InteractiveBookingMap = dynamic(
  () => import("@/components/mobile/interactive-booking-map").then((mod) => mod.InteractiveBookingMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-3xl bg-slate-100 border border-slate-200 animate-pulse flex flex-col items-center justify-center gap-2 text-slate-400">
        <div className="w-10 h-10 rounded-full bg-slate-200 animate-bounce flex items-center justify-center text-xl">🛺</div>
        <span className="text-xs font-bold text-slate-500">স্মার্ট বুকিং ম্যাপ প্রস্তুত হচ্ছে...</span>
      </div>
    ),
  }
);

const NearbyRidersRadarMap = dynamic(
  () => import("@/components/mobile/nearby-riders-radar-map").then((mod) => mod.NearbyRidersRadarMap),
  { ssr: false }
);

const LiveRideTrackingMap = dynamic(
  () => import("@/components/mobile/live-ride-tracking-map").then((mod) => mod.LiveRideTrackingMap),
  { ssr: false }
);

const DriverActiveTripMap = dynamic(
  () => import("@/components/mobile/driver-active-trip-map").then((mod) => mod.DriverActiveTripMap),
  { ssr: false }
);
import { SundarbanLogo } from "@/components/brand/sundarban-logo";
import { AppSplashScreen } from "@/components/brand/app-splash-screen";
import { MobileAppHeader } from "@/components/layout/mobile-app-header";
import { MobileBottomNav, MobileNavTab } from "@/components/layout/mobile-bottom-nav";
import { MobileAppShell } from "@/components/layout/mobile-app-shell";
import { OnboardingCarousel } from "@/components/mobile/onboarding-carousel";
import { AppErrorBoundary } from "@/components/mobile/app-error-boundary";

interface MobileSession {
  phone: string;
  role: "rider" | "passenger";
  driverId?: string;
  driverName?: string;
  totoNumber?: string;
  isApproved?: boolean;
  passengerName?: string;
}

function MobileAppPageContent() {
  // App Phase: 'splash' | 'permissions' | 'select_role' | 'otp_login' | 'kyc_form' | 'kyc_pending' | 'rider_home' | 'passenger_home'
  const [phase, setPhase] = useState<string>("splash");
  const [role, setRole] = useState<"rider" | "passenger">("rider");
  const [session, setSession] = useState<MobileSession | null>(null);
  const [bottomNavTab, setBottomNavTab] = useState<MobileNavTab>("home");
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // OTP Form State
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);
  const [loading, setLoading] = useState(false);

  // Driver KYC Form State
  const [kycName, setKycName] = useState("");
  const [kycEmail, setKycEmail] = useState("");
  const [kycDistrict, setKycDistrict] = useState("দক্ষিণ ২৪ পরগনা");
  const [kycBlock, setKycBlock] = useState("কাকদ্বীপ");
  const [kycTotoNumber, setKycTotoNumber] = useState("");
  const [kycAadharNumber, setKycAadharNumber] = useState("");
  const [kycAadharDoc, setKycAadharDoc] = useState("");
  const [kycSecondaryDoc, setKycSecondaryDoc] = useState("");
  const [kycSecondaryType, setKycSecondaryType] = useState("driving_license");

  // Driver Active State
  const [isOnline, setIsOnline] = useState(true);
  const [incomingRide, setIncomingRide] = useState<any | null>(null);
  const [activeRide, setActiveRide] = useState<any | null>(null);
  const [alertCountdown, setAlertCountdown] = useState(30);

  // Passenger State
  const [pickupText, setPickupText] = useState("আপনার বর্তমান অবস্থান (Live GPS)");
  const [dropText, setDropText] = useState("");
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.8680, 88.1630]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripFare, setTripFare] = useState(0);
  const [selectedTier, setSelectedTier] = useState<"standard" | "shared" | "reserved">("standard");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [showSosModal, setShowSosModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rideStep, setRideStep] = useState<"assigned" | "arriving" | "in_trip" | "arrived">("assigned");
  const [searchStatus, setSearchStatus] = useState<"searching" | "unaccepted" | "accepted">("searching");
  const [searchCountdown, setSearchCountdown] = useState(300); // 5 minutes search duration
  const [passengerBooking, setPassengerBooking] = useState<any | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const declinedBookingIdsRef = useRef<Set<string>>(new Set());
  const isAcceptingRef = useRef<string | null>(null);
  const [driverLiveCoords, setDriverLiveCoords] = useState<[number, number]>([21.8760, 88.1920]);

  // Permissions state
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Memoized route handler to eliminate parent re-render loops
  const handleRouteSelected = useCallback((route: any) => {
    if (route.pickup) setPickupText(route.pickup);
    if (route.drop !== undefined) setDropText(route.drop);
    if (route.pickupCoords) setPickupCoords(route.pickupCoords);
    if (route.dropCoords) setDropCoords(route.dropCoords);
    if (route.distanceKm !== undefined) setTripDistance(route.distanceKm);
    if (route.estimatedFare !== undefined) setTripFare(route.estimatedFare);
    if (route.rideTier) setSelectedTier(route.rideTier);
    if (route.paymentMode) setPaymentMode(route.paymentMode);
  }, []);

  // Enforce pristine Light Theme for mobile app
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mode = "light";
    }
  }, []);

  // Passenger Radar Search Countdown Effect (5 minutes timeout for nearby driver accept)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === "passenger_searching" && searchStatus === "searching") {
      if (searchCountdown > 0) {
        timer = setTimeout(() => {
          setSearchCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        // 5-minute timeout reached without acceptance!
        setSearchStatus("unaccepted");
        toast.error("দুঃখিত! বিগত ৫ মিনিটে কোনো চালক রাইড গ্রহণ করতে পারেননি।");
      }
    }
    return () => clearTimeout(timer);
  }, [phase, searchStatus, searchCountdown]);

  // Passenger Live Polling: Check if any driver accepted the ride (from App or WhatsApp)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (phase === "passenger_searching" && searchStatus === "searching" && activeBookingId) {
      const checkBookingAcceptance = async () => {
        try {
          const res = await fetch(`/api/bookings?id=${activeBookingId}`);
          const data = await res.json();
          if (data.booking && (data.booking.status === "assigned" || data.booking.status === "in_progress")) {
            const b = data.booking;
            setPassengerBooking({
              id: b.booking_number || b.id.slice(0, 8),
              driverName: b.driver_name || "রাজেশ মন্ডল",
              driverPhone: b.driver_phone || "9593177885",
              totoNumber: b.toto_number || "WB-96-T-8421",
            });
            setPhase("passenger_home");
            playSuccessSound();
            toast.success("চালক রাইড গ্রহণ করেছেন!");
          }
        } catch {}
      };

      checkBookingAcceptance();
      pollInterval = setInterval(checkBookingAcceptance, 2000);
    }

    return () => clearInterval(pollInterval);
  }, [phase, searchStatus, activeBookingId]);

  // Auto-poll driver approval status when in kyc_pending
  const [checkingApproval, setCheckingApproval] = useState(false);

  const checkDriverApprovalStatus = async (isManual = false) => {
    if (!session?.phone && !phoneInput) return;
    const phone = session?.phone || phoneInput;
    try {
      if (isManual) setCheckingApproval(true);
      const res = await fetch(`/api/drivers?phone=${phone}`);
      const data = await res.json();
      const driver = data.driver || (data.drivers && data.drivers.find((d: { phone: string; [key: string]: unknown }) => d.phone.includes(phone.replace(/\D/g, ""))));
      if (driver && driver.is_approved) {
        const approvedSession: MobileSession = {
          ...session,
          phone,
          role: "rider",
          isApproved: true,
          driverId: driver.id,
          driverName: driver.name,
          totoNumber: driver.toto_number,
        };
        setSession(approvedSession);
        localStorage.setItem("sr_mobile_session", JSON.stringify(approvedSession));
        playSuccessSound();
        toast.success("🎉 অভিনন্দন! আপনার চালক একাউন্টটি অনুমোদিত হয়েছে!");
        setPhase("rider_home");
      } else if (isManual) {
        toast.info("⏳ আপনার ডকুমেন্টস এখনো পর্যালোচনায় রয়েছে। অ্যাডমিন শীঘ্রই অনুমোদন করবেন।");
      }
    } catch {
      if (isManual) toast.error("স্ট্যাটাস যাচাই করতে সমস্যা হয়েছে");
    } finally {
      if (isManual) setCheckingApproval(false);
    }
  };

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (phase === "kyc_pending") {
      checkDriverApprovalStatus();
      pollInterval = setInterval(() => checkDriverApprovalStatus(), 5000);
    }
    return () => clearInterval(pollInterval);
  }, [phase, session?.phone, phoneInput]);

  // 1. Session Persistence Check on Load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const perms = localStorage.getItem("sr_permissions_granted");
    if (perms) {
      setPermissionsGranted(true);
    }

    const saved = localStorage.getItem("sr_mobile_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MobileSession;
        setSession(parsed);
        setRole(parsed.role);
      } catch {
        // fallback
      }
    }
  }, []);

  // OTP Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  // Incoming Ride Countdown Timer & Audio
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (incomingRide) {
      playRideAlertSound();
      const soundInterval = setInterval(() => {
        playRideAlertSound();
      }, 5000);

      interval = setInterval(() => {
        setAlertCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            clearInterval(soundInterval);
            setIncomingRide(null);
            toast.error("রাইডের সময়সীমা শেষ হয়েছে");
            return 30;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
        clearInterval(soundInterval);
      };
    }
  }, [incomingRide]);

  
  // Proactively watch and broadcast driver live GPS to server
  useEffect(() => {
    let watchId: number;
    if (typeof window !== "undefined" && navigator.geolocation && role === "rider" && isOnline) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setDriverLiveCoords([latitude, longitude]);
          if (session?.driverId || session?.phone) {
            try {
              await fetch("/api/drivers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: session?.driverId,
                  phone: session?.phone,
                  latitude,
                  longitude,
                  is_active: isOnline,
                }),
              });
            } catch {}
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [role, isOnline, session?.driverId, session?.phone]);

  // Real-Time Incoming Ride Polling & Synchronization for Online Drivers
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (phase === "rider_home" && isOnline && !activeRide) {
      const checkPendingBookings = async () => {
        try {
          // If already displaying an incoming ride popup, check if someone else accepted it!
          if (incomingRide) {
            const res = await fetch(`/api/bookings?id=${incomingRide.id}`);
            const data = await res.json();
            if (data.booking && data.booking.status !== "pending") {
              const myDriverId = session?.driverId;
              const myPhone = session?.phone?.replace(/\D/g, "").slice(-10);
              const isAcceptedByMe =
                (myDriverId && data.booking.driver_id === myDriverId) ||
                (myPhone && data.booking.driver_phone?.includes(myPhone));

              if (data.booking.status === "cancelled") {
                declinedBookingIdsRef.current.add(incomingRide.id);
                setIncomingRide(null);
                toast.info("যাত্রী রাইড বাতিল করেছেন।");
              } else if (!isAcceptedByMe) {
                setIncomingRide(null);
                toast.info("এই রাইডটি অন্য একজন চালক গ্রহণ করেছেন।");
              }
            }
            return;
          }

          // Otherwise check for newly posted pending bookings
          const res = await fetch("/api/bookings?status=pending");
          const data = await res.json();
          if (data.booking && data.booking.status === "pending") {
            const b = data.booking;
            if (!declinedBookingIdsRef.current.has(b.id)) {
              setAlertCountdown(30);
              setIncomingRide({
                id: b.id,
                bookingNumber: b.booking_number,
                fare: b.estimated_fare || 50,
                passengerName: b.customer_name || "যাত্রী",
                passengerRating: 5.0,
                passengerPhone: b.customer_phone || "918348122122",
                pickup: b.pickup_location || "পিকআপ পয়েন্ট",
                pickupDistance: "১.২ কিমি দূরে",
                drop: b.drop_location || "গন্তব্য",
                tripDistance: "৪.৫ কিমি ট্রিপ",
                pickupCoords: b.pickup_lat && b.pickup_lng ? [Number(b.pickup_lat), Number(b.pickup_lng)] : [21.8760, 88.1920],
                dropCoords: b.drop_lat && b.drop_lng ? [Number(b.drop_lat), Number(b.drop_lng)] : [21.8680, 88.1630],
              });
            }
          }
        } catch {
          // Ignore transient network errors
        }
      };

      // Check immediately and then every 2.5 seconds
      checkPendingBookings();
      pollInterval = setInterval(checkPendingBookings, incomingRide ? 1000 : 2500);
    }

    return () => clearInterval(pollInterval);
  }, [phase, isOnline, incomingRide, activeRide]);

  // Poll active ride for real-time cancellation by customer
  useEffect(() => {
    let activeRidePollInterval: NodeJS.Timeout;
    if (phase === "rider_home" && activeRide?.id) {
      const checkActiveRideStatus = async () => {
        try {
          const res = await fetch(`/api/bookings?id=${activeRide.id}`);
          const data = await res.json();
          if (data.booking && data.booking.status === "cancelled") {
            setActiveRide(null);
            toast.error("যাত্রী রাইড বাতিল করেছেন। পরবর্তী রাইডের জন্য অপেক্ষা করুন।");
          }
        } catch {}
      };
      activeRidePollInterval = setInterval(checkActiveRideStatus, 3000);
    }
    return () => clearInterval(activeRidePollInterval);
  }, [phase, activeRide]);

  // Proactively fetch customer real-time GPS location on app load
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPickupCoords([latitude, longitude]);
          fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`)
            .then((r) => r.json())
            .then((d) => {
              if (d && d.name) setPickupText(d.name);
            })
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  }, []);

  // Handle Permissions
  const handleGrantPermissions = () => {
    localStorage.setItem("sr_permissions_granted", "true");
    setPermissionsGranted(true);

    // Explicitly prompt the browser for GPS location permission on user gesture
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPickupCoords([latitude, longitude]);
          // Resolve initial address
          fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`)
            .then((r) => r.json())
            .then((d) => {
              if (d && d.name) setPickupText(d.name);
            })
            .catch(() => {});
        },
        (err) => {
          console.warn("Geolocation permission error or ignored:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    playSuccessSound();
    toast.success("সকল অনুমতি সফলভাবে প্রদান করা হয়েছে!");
    if (role === "rider") {
      setPhase("otp_login");
    } else {
      setPhase("passenger_home");
    }
  };

  // Handle Send WhatsApp OTP
  const handleSendOtp = async () => {
    if (!phoneInput || phoneInput.length < 10) {
      toast.error("১০ সংখ্যার সঠিক মোবাইল নম্বর লিখুন");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, role }),
      });
      const json = await res.json();
      if (json.success) {
        setOtpSent(true);
        setOtpTimer(60);
        toast.success(json.message || "WhatsApp-এ OTP পাঠানো হয়েছে!");
        if (json.debugOtp) {
          toast.info(`টেস্ট OTP: ${json.debugOtp}`);
        }
      } else {
        toast.error(json.message || "OTP পাঠানো ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length < 4) {
      toast.error("সঠিক ৪ সংখ্যার OTP লিখুন");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, otp: otpInput, role }),
      });
      const json = await res.json();

      if (json.success) {
        playSuccessSound();
        if (role === "rider") {
          if (!json.is_registered) {
            // New driver needs KYC
            setPhase("kyc_form");
            toast.info("অনুগ্রহ করে চালকের তথ্য ও ডকুমেন্ট সাবমিট করুন");
          } else if (json.is_approved === false) {
            // Pending approval
            const newSession: MobileSession = {
              phone: json.phone || phoneInput,
              role: "rider",
              isApproved: false,
              driverName: json.driver?.name,
              totoNumber: json.driver?.toto_number,
            };
            setSession(newSession);
            localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));
            setPhase("kyc_pending");
          } else {
            // Approved driver
            const newSession: MobileSession = {
              phone: json.phone || phoneInput,
              role: "rider",
              isApproved: true,
              driverId: json.driver?.id,
              driverName: json.driver?.name,
              totoNumber: json.driver?.toto_number,
            };
            setSession(newSession);
            localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));
            setPhase("rider_home");
            toast.success("স্বাগতম চালক বন্ধু!");
          }
        } else {
          // Passenger login
          const newSession: MobileSession = {
            phone: json.customer?.phone || phoneInput,
            role: "passenger",
            passengerName: json.customer?.name || "সুন্দরবন যাত্রী",
          };
          setSession(newSession);
          localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));
          setPhase("passenger_home");
          toast.success("স্বাগতম যাত্রী বন্ধু!");
        }
      } else {
        toast.error(json.message || "ভুল OTP কোড");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setLoading(false);
    }
  };

  // Handle KYC Submission
  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycName || !kycTotoNumber || !kycAadharNumber) {
      toast.error("সকল বাধ্যতামূলক তথ্য প্রদান করুন");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/riders/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: kycName,
          phone: phoneInput,
          email: kycEmail,
          district: kycDistrict,
          block: kycBlock,
          toto_number: kycTotoNumber.toUpperCase(),
          aadhar_number: kycAadharNumber,
          aadhar_doc: kycAadharDoc || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop",
          secondary_doc: kycSecondaryDoc || "https://images.unsplash.com/photo-1554415707-9e4c019feab4?w=600&auto=format&fit=crop",
          secondary_doc_type: kycSecondaryType,
        }),
      });

      const json = await res.json();
      if (json.success) {
        playSuccessSound();
        const newSession: MobileSession = {
          phone: phoneInput,
          role: "rider",
          isApproved: false,
          driverName: kycName,
          totoNumber: kycTotoNumber.toUpperCase(),
        };
        setSession(newSession);
        localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));
        setPhase("kyc_pending");
        toast.success("ডকুমেন্টস সফলভাবে জমা হয়েছে!");
      } else {
        toast.error(json.message || "রেজিস্ট্রেশন ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setLoading(false);
    }
  };

  // Logout / Switch Mode
  const handleLogout = () => {
    localStorage.removeItem("sr_mobile_session");
    setSession(null);
    setIncomingRide(null);
    setActiveRide(null);
    setPassengerBooking(null);
    setPhase("select_role");
    toast.info("লগআউট সম্পন্ন হয়েছে। মোড নির্বাচন করুন।");
  };

  // Switch to opposite role directly
  const handleSwitchRole = () => {
    const nextRole = role === "rider" ? "passenger" : "rider";
    setRole(nextRole);
    setPhoneInput("");
    setOtpInput("");
    setOtpSent(false);
    setPhase("otp_login");
    toast.info(`মোড পরিবর্তন: ${nextRole === "rider" ? "চালক মোড" : "যাত্রী মোড"}`);
  };

  // -------------------------------------------------------------
  // VIEW: SPLASH / LOADING SCREEN (World-Class Dynamic Branding)
  // -------------------------------------------------------------
  if (phase === "splash") {
    return (
      <AppSplashScreen
        minDurationMs={1800}
        onComplete={() => {
          if (typeof window === "undefined") return;
          const saved = localStorage.getItem("sr_mobile_session");
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as MobileSession;
              setSession(parsed);
              setRole(parsed.role);
              if (parsed.role === "rider") {
                setPhase(parsed.isApproved === false ? "kyc_pending" : "rider_home");
              } else {
                setPhase("passenger_home");
              }
              return;
            } catch {
              // fallback
            }
          }
          setPhase("select_role");
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW: ONBOARDING CAROUSEL / ROLE SELECTION (Exact User Designs)
  // -------------------------------------------------------------
  if (phase === "select_role") {
    return (
      <MobileAppShell>
        <OnboardingCarousel
          onSelectRole={(selectedRole) => {
            setRole(selectedRole);
            if (selectedRole === "rider") {
              const saved = typeof window !== "undefined" ? localStorage.getItem("sr_mobile_session") : null;
              if (saved) {
                try {
                  const parsed = JSON.parse(saved) as MobileSession;
                  if (parsed.role === "rider" && parsed.driverId) {
                    setSession(parsed);
                    setPhase(parsed.isApproved === false ? "kyc_pending" : "rider_home");
                    return;
                  }
                } catch {}
              }
              setPhase("otp_login");
            } else {
              setRole("passenger");
              // Directly launch customer cab booking flow seamlessly
              setPhase("passenger_home");
            }
          }}
          onOpenAdminLogin={() => {
            window.location.href = "/dashboard";
          }}
        />
      </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PERMISSIONS ONBOARDING SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "permissions") {
    return (
      <MobileAppShell>
        <div className="min-h-full flex-1 bg-slate-50 text-slate-900 flex flex-col justify-between p-5 select-none">
          <div className="pt-3 space-y-5 max-w-md mx-auto w-full">
            <div className="flex items-center justify-between">
              <SundarbanLogo size="sm" variant="full" />
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                অনুমতি কনফিগারেশন
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                অ্যাপের প্রয়োজনীয় অনুমতি
              </h2>
              <p className="text-slate-500 text-xs mt-1 font-medium leading-relaxed">
                সুন্দরবনের সঠিক লাইভ রুট ট্র্যাকিং ও দ্রুত স্মার্ট টোটো বুকিং পেতে নিচের সেবাগুলো চালু রাখা আবশ্যক:
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0 border border-blue-100">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">জিপিএস লোকেশন (GPS)</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium leading-snug">
                    নিকটস্থ ৫ কিমির মধ্যে সক্রিয় চালক খোঁজা ও আসল সড়কের লাইভ রুট দেখার জন্য।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0 border border-purple-100">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">পুশ নোটিফিকেশন</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium leading-snug">
                    অ্যাপ ব্যাকগ্রাউন্ডে থাকলেও নতুন রাইড ও বুকিং নিশ্চিতকরণের তাৎক্ষণিক অ্যালার্ট।
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0 border border-amber-100">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">অডিও ও ভাইব্রেশন</h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium leading-snug">
                    রাইড আসার সময় এবং স্ট্যাটাস পরিবর্তনের সময় স্পষ্ট অডিও অ্যালার্ট বাজবে।
                  </p>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm shadow-md active:scale-95 transition-all mt-4 cursor-pointer"
              onClick={handleGrantPermissions}
            >
              সব অনুমতি দিন ও এগিয়ে যান →
            </Button>
          </div>
        </div>
      </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: WHATSAPP OTP LOGIN SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "otp_login") {
    return (
      <MobileAppShell>
        <div className="min-h-full flex-1 bg-slate-50 text-slate-900 flex flex-col justify-between p-6 select-none">
          <div className="pt-4 space-y-6 max-w-md mx-auto w-full">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPhase("select_role")}
                className="text-xs text-slate-500 hover:text-slate-900 font-bold flex items-center gap-1 p-1 -ml-1 rounded-lg transition-colors"
              >
                ← ভূমিকা পরিবর্তন
              </button>
              <SundarbanLogo size="sm" variant="badge" showTagline={false} />
            </div>

            <div>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  role === "rider"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-sky-100 text-sky-800 border border-sky-200"
                }`}
              >
                {role === "rider" ? "🛺 চালক পার্টনার লগইন" : "👤 যাত্রী লগইন"}
              </span>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
                WhatsApp OTP দিয়ে প্রবেশ
              </h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">
                আপনার হোয়াটসঅ্যাপ নম্বরে কোনো সাধারণ এসএমএস চার্জ ছাড়াই সরাসরি সিকিউরিটি কোড পাঠানো হবে।
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs text-slate-700 font-semibold">হোয়াটসঅ্যাপ মোবাইল নম্বর</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                    +91
                  </span>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    value={phoneInput}
                    disabled={otpSent}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-14 pl-14 bg-white border-slate-300 text-slate-900 text-lg font-bold rounded-2xl tracking-wider shadow-sm focus:border-emerald-500"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2 pt-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-700 font-semibold">৪ সংখ্যার OTP কোড</Label>
                    <span className="text-xs text-emerald-600 font-mono font-bold">
                      {otpTimer > 0 ? `পুনরায় পাঠাতে: ${otpTimer}s` : ""}
                    </span>
                  </div>
                  <Input
                    type="text"
                    maxLength={4}
                    placeholder="• • • •"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="h-16 text-center text-2xl font-black tracking-[1em] bg-white border-2 border-emerald-500 text-emerald-700 rounded-2xl shadow-sm"
                  />

                  {otpTimer === 0 && (
                    <button
                      onClick={handleSendOtp}
                      className="text-xs text-emerald-600 font-bold hover:underline pt-1 block"
                    >
                      পুনরায় WhatsApp-এ OTP পাঠান
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pb-4">
            {!otpSent ? (
              <Button
                size="lg"
                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20"
                onClick={handleSendOtp}
                disabled={loading || phoneInput.length < 10}
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  "WhatsApp-এ OTP পাঠান"
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20"
                onClick={handleVerifyOtp}
                disabled={loading || otpInput.length < 4}
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  "ভেরিফাই করুন ও প্রবেশ করুন"
                )}
              </Button>
            )}
          </div>
        </div>
      </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: DRIVER KYC ONBOARDING FORM (Light Theme)
  // -------------------------------------------------------------
  if (phase === "kyc_form") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 pb-12 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-bold bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              নতুন চালক নিবন্ধন
            </span>
            <span className="text-xs text-slate-600 font-mono font-semibold">+91 {phoneInput}</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              চালক তথ্য ও ডকুমেন্ট সাবমিট
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium">
              যাচাইকরণের জন্য সঠিক তথ্য ও আধার কার্ডের পরিষ্কার ছবি সংযুক্ত করুন।
            </p>
          </div>

          <form onSubmit={handleKycSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">পূর্ণ নাম *</Label>
              <Input
                placeholder="যেমন: রাজেশ মন্ডল"
                value={kycName}
                onChange={(e) => setKycName(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 rounded-xl shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">ইমেইল ঠিকানা (অনুমোদনপত্রের জন্য)</Label>
              <Input
                type="email"
                placeholder="example@gmail.com"
                value={kycEmail}
                onChange={(e) => setKycEmail(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 rounded-xl shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-semibold">জেলা *</Label>
                <Input
                  value={kycDistrict}
                  onChange={(e) => setKycDistrict(e.target.value)}
                  className="h-12 bg-white border-slate-300 text-slate-900 rounded-xl shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-semibold">ব্লক *</Label>
                <Input
                  value={kycBlock}
                  onChange={(e) => setKycBlock(e.target.value)}
                  className="h-12 bg-white border-slate-300 text-slate-900 rounded-xl shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">টোটো রেজিস্ট্রেশন নম্বর *</Label>
              <Input
                placeholder="যেমন: WB-96-T-8421"
                value={kycTotoNumber}
                onChange={(e) => setKycTotoNumber(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 font-mono rounded-xl uppercase shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold">আধার কার্ড নম্বর (১২ সংখ্যা) *</Label>
              <Input
                placeholder="XXXX XXXX XXXX"
                maxLength={12}
                value={kycAadharNumber}
                onChange={(e) => setKycAadharNumber(e.target.value.replace(/\D/g, ""))}
                className="h-12 bg-white border-slate-300 text-slate-900 font-mono rounded-xl shadow-sm"
              />
            </div>

            {/* Document Upload Simulation */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">আধার কার্ড ছবি *</h5>
                    <p className="text-[10px] text-slate-500 font-medium">সামনে ও পেছনের স্পষ্ট ছবি</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-300 font-semibold"
                  onClick={() => {
                    setKycAadharDoc("https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop");
                    toast.success("আধার কার্ড সফলভাবে সংযুক্ত হয়েছে");
                  }}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {kycAadharDoc ? "যুক্ত হয়েছে ✓" : "আপলোড"}
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">২য় ডকুমেন্ট (লাইসেন্স/ভোটার) *</h5>
                    <p className="text-[10px] text-slate-500 font-medium">ড্রাইভিং লাইসেন্স বা ভোটার আইডি</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-300 font-semibold"
                  onClick={() => {
                    setKycSecondaryDoc("https://images.unsplash.com/photo-1554415707-9e4c019feab4?w=600&auto=format&fit=crop");
                    toast.success("২য় ডকুমেন্ট সফলভাবে সংযুক্ত হয়েছে");
                  }}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {kycSecondaryDoc ? "যুক্ত হয়েছে ✓" : "আপলোড"}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20 mt-4"
              disabled={loading}
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "আবেদন সাবমিট করুন"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: KYC PENDING APPROVAL SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "kyc_pending") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-6 text-center">
        <div className="pt-16 space-y-6">
          <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600 mx-auto animate-pulse shadow-md">
            <Clock className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              আবেদন অনুমোদনের অপেক্ষায়
            </h2>
            <p className="text-slate-600 text-sm mt-2 max-w-xs mx-auto font-medium">
              নমস্কার {session?.driverName || "চালক বন্ধু"}! আপনার চালক আবেদন ও আধার ডকুমেন্টস সফলভাবে জমা হয়েছে।
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left space-y-2 max-w-xs mx-auto text-xs shadow-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">টোটো নম্বর:</span>
              <span className="font-mono font-bold text-slate-900">{session?.totoNumber || "WB-96-T-XXXX"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">স্ট্যাটাস:</span>
              <span className="text-amber-600 font-bold">ভেরিফিকেশন চলছে</span>
            </div>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-medium">
              অ্যাডমিন অনুমোদন করার সাথে সাথে আপনি WhatsApp ও ইমেইলে কনফার্মেশন পাবেন এবং এই স্ক্রিন স্বয়ংক্রিয়ভাবে খুলে যাবে।
            </p>
          </div>
        </div>

        <div className="space-y-3 pb-4 max-w-xs mx-auto w-full">
          <Button
            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => checkDriverApprovalStatus(true)}
            disabled={checkingApproval}
          >
            <RefreshCw className={`w-4 h-4 ${checkingApproval ? "animate-spin" : ""}`} />
            <span>{checkingApproval ? "যাচাই করা হচ্ছে..." : "🔄 স্ট্যাটাস রিফ্রেশ করুন"}</span>
          </Button>

          <a
            href="https://wa.me/919593177885?text=নমস্কার%20অ্যাডমিন,%20আমি%20সুন্দরবন%20রাইডার্সে%20চালক%20হিসেবে%20ডকুমেন্টস%20জমা%20দিয়েছি।%20দয়া%20করে%20আমার%20অ্যাকাউন্টটি%20অনুমোদন%20করুন।"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center justify-center gap-2 transition-all text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span>হোয়াটসঅ্যাপ হেল্পলাইনে মেসেজ করুন</span>
          </a>

          <a
            href="/riders"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] font-bold text-slate-500 hover:text-slate-800 underline pt-1"
          >
            অ্যাডমিন? চালক অনুমোদন প্যানেলে যান →
          </a>

          <div className="pt-2 space-y-2">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-slate-300 text-slate-700 font-semibold bg-white text-xs cursor-pointer"
              onClick={handleSwitchRole}
            >
              👤 যাত্রী হিসেবে টোটো বুক করতে চান?
            </Button>

            <Button
              variant="ghost"
              className="w-full text-xs text-slate-500 hover:text-red-600"
              onClick={handleLogout}
            >
              লগআউট করুন
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: RIDER HOME / DASHBOARD (Sundarban Riders Live Flow)
  // -------------------------------------------------------------
  if (phase === "rider_home") {
    return (
      <div className="min-h-screen text-slate-900 flex flex-col justify-between relative overflow-hidden select-none" style={{background:"linear-gradient(160deg, #f0fdf4 0%, #f8fafc 40%, #eff6ff 100%)"}}>
        {/* Modern App Header */}
        <MobileAppHeader
          role="rider"
          userName={session?.driverName || "চালকের ড্যাশবোর্ড"}
          isSoundMuted={isSoundMuted}
          onToggleSound={() => {
            setIsSoundMuted(!isSoundMuted);
            toast.info(!isSoundMuted ? "সাউন্ড মিউট করা হয়েছে 🔇" : "সাউন্ড সক্রিয় করা হয়েছে 🔔");
          }}
          onSwitchRole={handleSwitchRole}
          onSosClick={() => setShowSosModal(true)}
          onLogout={handleLogout}
        />

        {/* Driver Quick Sub-Header: Profile, Toto Number & Online Toggle */}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{background:"rgba(255,255,255,0.88)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:"1px solid rgba(226,232,240,0.6)",boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-lg shadow-2xs">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs text-slate-900">{session?.driverName || "টোটো চালক দাদা"}</span>
                <span className="flex items-center text-[9px] text-amber-700 font-bold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                  ★ 5.0
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">{session?.totoNumber || "WB-96-T-8421"}</span>
            </div>
          </div>

          {/* Online / Offline Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsOnline(!isOnline);
              if (!isSoundMuted) playSuccessSound();
              toast.success(!isOnline ? "আপনি এখন অনলাইন আছেন 🟢" : "আপনি এখন অফলাইন আছেন 🔴");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
              isOnline
                ? "bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-red-500"}`} />
            <span>{isOnline ? "অনলাইন (ডিউটি)" : "অফলাইন"}</span>
          </button>
        </div>

        {/* Radar & Status Area (When Idle) */}
        {!activeRide && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-44">
            <DriverRadarPanel
              driverSession={session}
              isOnline={isOnline}
              initialTab={bottomNavTab === "trips" ? "trips" : "radar"}
              onAcceptRide={async (b) => {
                try {
                  const res = await fetch("/api/bookings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "accept",
                      bookingId: b.id || b.booking_number,
                      driverId: session?.driverId || "",
                      driverName: session?.driverName || "সুন্দরবন চালক",
                      driverPhone: session?.phone || "9593177885",
                      totoNumber: session?.totoNumber || "WB-96-T-8421",
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok && data.error === "booking_already_taken") {
                    setIncomingRide(null);
                    toast.error("দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে।");
                    return;
                  }

                  setActiveRide({
                    id: b.id,
                    bookingNumber: b.booking_number,
                    fare: b.estimated_fare || b.fare || 50,
                    passengerName: b.customer_name || b.passengerName || "যাত্রী",
                    passengerPhone: b.customer_phone || b.passengerPhone || "918348122122",
                    pickup: b.pickup_location || b.pickup || "পিকআপ পয়েন্ট",
                    drop: b.drop_location || b.drop || "গন্তব্য",
                    pickupCoords: b.pickup_lat && b.pickup_lng ? [Number(b.pickup_lat), Number(b.pickup_lng)] : (b.pickupCoords || [21.8760, 88.1920]),
                    dropCoords: b.drop_lat && b.drop_lng ? [Number(b.drop_lat), Number(b.drop_lng)] : (b.dropCoords || [21.8680, 88.1630]),
                    status: "heading_pickup",
                  });
                  setIncomingRide(null);
                  playSuccessSound();
                  toast.success("রাইড গ্রহণ করা হয়েছে! যাত্রীর পিকআপ অবস্থানে যান।");
                } catch {
                  setActiveRide({
                    id: b.id,
                    bookingNumber: b.booking_number,
                    fare: b.estimated_fare || b.fare || 50,
                    passengerName: b.customer_name || b.passengerName || "যাত্রী",
                    passengerPhone: b.customer_phone || b.passengerPhone || "918348122122",
                    pickup: b.pickup_location || b.pickup || "পিকআপ পয়েন্ট",
                    drop: b.drop_location || b.drop || "গন্তব্য",
                    pickupCoords: b.pickup_lat && b.pickup_lng ? [Number(b.pickup_lat), Number(b.pickup_lng)] : (b.pickupCoords || [21.8760, 88.1920]),
                    dropCoords: b.drop_lat && b.drop_lng ? [Number(b.drop_lat), Number(b.drop_lng)] : (b.dropCoords || [21.8680, 88.1630]),
                    status: "heading_pickup",
                  });
                  setIncomingRide(null);
                  toast.success("রাইড গ্রহণ করা হয়েছে!");
                }
              }}
            />

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">আজকের ট্রিপ</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">৬ টি</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">সংগৃহীত নগদ</span>
                <div className="text-2xl font-black text-emerald-600 mt-0.5">₹৩৬০.০০</div>
              </div>
            </div>
          </div>
        )}

        {/* Active In-Progress Ride View */}
        {activeRide && (
          <div className="flex-1 p-4 pb-48 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl flex items-center justify-between" style={{background:"rgba(240,253,244,0.9)",border:"1px solid rgba(167,243,208,0.8)",boxShadow:"0 4px 16px rgba(16,185,129,0.08), 0 1px 0 rgba(255,255,255,0.8) inset"}}>
                <div>
                  <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
                    {activeRide.status === "heading_pickup" ? "যাত্রীর কাছে যাচ্ছেন" : "যাত্রা চলমান 🛺"}
                  </span>
                  <h4 className="font-bold text-lg text-slate-900 mt-0.5">{activeRide.passengerName}</h4>
                </div>
                <a
                  href={`tel:${activeRide.passengerPhone}`}
                  className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md active:scale-95"
                >
                  <Phone className="w-5 h-5 fill-white" />
                </a>
              </div>

              {/* Destination Road Map with 2 Options: Inbuilt Map vs Google Map */}
              <DriverActiveTripMap
                pickup={activeRide.pickup}
                drop={activeRide.drop}
                pickupCoords={activeRide.pickupCoords || [21.8760, 88.1920]}
                dropCoords={activeRide.dropCoords || [21.8680, 88.1630]}
                driverCoords={driverLiveCoords || [21.8770, 88.1930]}
                status={activeRide.status === "heading_pickup" ? "heading_pickup" : "on_trip"}
              />

              {/* Route Summary Details Card */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">পিকআপ লোকেশন</span>
                    <p className="text-sm font-bold text-slate-900">{activeRide.pickup}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">গন্তব্য (Drop)</span>
                    <p className="text-sm font-bold text-slate-900">{activeRide.drop}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Swipe actions based on ride progress */}
            <div className="space-y-3 pb-4">
              {activeRide.status === "heading_pickup" ? (
                <SwipeToConfirm
                  label="➡️ স্লাইড করে যাত্রা শুরু করুন"
                  confirmedLabel="যাত্রা শুরু হয়েছে 🛺"
                  colorScheme="blue"
                  onConfirm={async () => {
                    try {
                      await fetch("/api/bookings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "start",
                          bookingId: activeRide.id,
                          driverId: session?.driverId,
                        }),
                      });
                    } catch {}
                    setActiveRide({ ...activeRide, status: "on_trip" });
                    playSuccessSound();
                    toast.success("যাত্রা শুরু হয়েছে! সাবধানে ড্রাইভ করুন।");
                  }}
                />
              ) : (
                <SwipeToConfirm
                  label="➡️ স্লাইড করে ট্রিপ সমাপ্ত করুন"
                  confirmedLabel="ট্রিপ সমাপ্ত হয়েছে ✓"
                  colorScheme="emerald"
                  onConfirm={async () => {
                    const fare = activeRide.fare || 50;
                    try {
                      await fetch("/api/bookings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "complete",
                          bookingId: activeRide.id,
                          driverId: session?.driverId,
                        }),
                      });
                    } catch {}
                    playSuccessSound();
                    toast.success(`ট্রিপ সফলভাবে সমাপ্ত! নগদ ₹${fare}.00 সংগ্রহ করুন।`);
                    setActiveRide(null);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUNDARBAN RIDERS INCOMING RIDE MODAL SHEET (Light Theme)     */}
        {/* ------------------------------------------------------------- */}
        {incomingRide && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end animate-in slide-in-from-bottom duration-300" style={{background:"rgba(15,23,42,0.55)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
            <div className="rounded-t-3xl p-6 space-y-5 border-t border-white/20" style={{background:"rgba(255,255,255,0.97)",boxShadow:"0 -8px 40px rgba(0,0,0,0.18), 0 -1px 0 rgba(255,255,255,0.6) inset"}}>
              {/* Header with Circular Countdown & Fare */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    নতুন রাইড অনুরোধ!
                  </span>
                  <div className="text-3xl font-black text-slate-900 mt-0.5">
                    ₹{incomingRide.fare}.00 <span className="text-xs text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full ml-1">নগদ ভাড়া</span>
                  </div>
                </div>

                {/* 30s Countdown Ring */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" className="text-slate-100" fill="transparent" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-emerald-600 transition-all duration-1000"
                      fill="transparent"
                      strokeDasharray={150}
                      strokeDashoffset={150 - (150 * alertCountdown) / 30}
                    />
                  </svg>
                  <span className="absolute font-black text-sm text-slate-900">{alertCountdown}s</span>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    👤
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{incomingRide.passengerName}</h4>
                    <span className="flex items-center text-xs text-amber-600 font-bold">
                      <Star className="w-3 h-3 fill-amber-500 mr-1" /> {incomingRide.passengerRating}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-mono font-bold">#{incomingRide.id}</span>
              </div>

              {/* Route Preview */}
              <div className="space-y-3 text-xs bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-start gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">পিকআপ: {incomingRide.pickupDistance}</span>
                    <p className="font-bold text-sm text-slate-900">{incomingRide.pickup}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-3.5 h-3.5 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">গন্তব্য: {incomingRide.tripDistance}</span>
                    <p className="font-bold text-sm text-slate-900">{incomingRide.drop}</p>
                  </div>
                </div>
              </div>

              {/* Swipe to Accept Button */}
              <div className="space-y-3 pt-2">
                <SwipeToConfirm
                  label="➡️ স্লাইড করে রাইড গ্রহণ করুন"
                  confirmedLabel="রাইড গ্রহণ সফল! ✓"
                  colorScheme="emerald"
                  onConfirm={async () => {
                    try {
                      const res = await fetch("/api/bookings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "accept",
                          bookingId: incomingRide.id,
                          driverId: session?.driverId || "",
                          driverName: session?.driverName || "রাজেশ মন্ডল",
                          driverPhone: session?.phone || "9593177885",
                          totoNumber: session?.totoNumber || "WB-96-T-8421",
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok && data.error === "booking_already_taken") {
                        setIncomingRide(null);
                        toast.error("দুঃখিত! এই রাইডটি ইতিমধ্যে অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে।");
                        return;
                      }

                      setActiveRide({
                        ...incomingRide,
                        status: "heading_pickup",
                      });
                      setIncomingRide(null);
                      playSuccessSound();
                      toast.success("রাইড গ্রহণ করা হয়েছে! যাত্রীর অবস্থানে যান।");
                    } catch {
                      setActiveRide({
                        ...incomingRide,
                        status: "heading_pickup",
                      });
                      setIncomingRide(null);
                      toast.success("রাইড গ্রহণ করা হয়েছে!");
                    }
                  }}
                />

                <Button
                  variant="ghost"
                  className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-10 font-bold"
                  onClick={() => {
                    if (incomingRide?.id) {
                      declinedBookingIdsRef.current.add(incomingRide.id);
                    }
                    setIncomingRide(null);
                    toast.info("রাইড প্রত্যাখ্যান করা হয়েছে");
                  }}
                >
                  প্রত্যাখ্যান করুন (Decline)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation Dock for Rider */}
        <MobileBottomNav
          activeTab={bottomNavTab}
          onTabChange={(t) => {
            if (t === "safety") setShowSosModal(true);
            else setBottomNavTab(t);
          }}
          role="rider"
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PASSENGER SEARCHING / UBER-STYLE RADAR SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "passenger_searching") {
    return (
      <div className="min-h-screen text-slate-900 flex flex-col justify-between select-none" style={{background:"linear-gradient(160deg, #f0fdf4 0%, #f8fafc 40%, #eff6ff 100%)"}}>
        {/* Radar Header */}
        <div className="p-4 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPhase("passenger_home");
                setSearchStatus("searching");
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              ← ফিরে যান
            </button>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {searchStatus === "searching" ? "চালক অনুসন্ধান চলছে..." : "অনুসন্ধান ফলাফল"}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ৫ কিমি রেডিয়াসে লাইভ রাডার
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              searchStatus === "searching"
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {searchStatus === "searching"
              ? `অপেক্ষার সময়: ${Math.floor(searchCountdown / 60)}:${(searchCountdown % 60).toString().padStart(2, "0")}`
              : "অপেক্ষারত"}
          </span>
        </div>

        {/* Live Radar Map Area with Nearby Totos */}
        <div className="flex-1 p-4 flex flex-col space-y-4 pb-44">
          <div className="h-64 sm:h-72 w-full rounded-3xl overflow-hidden shadow-sm">
            <NearbyRidersRadarMap
              pickupCoords={pickupCoords}
              dropCoords={dropCoords}
              pickupName={pickupText}
              dropName={dropText}
            />
          </div>

          {/* Bottom Card: Status + Trip Details */}
          {searchStatus === "searching" ? (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping" />
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg shadow-md">
                    🛺
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    কাছাকাছি ৫ কিমির মধ্যে চালক খোঁজা হচ্ছে...
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    আশেপাশের অনলাইন টোটো চালকদের কাছে আপনার অনুরোধ পাঠানো হচ্ছে (৫ মিনিট অপেক্ষা)।
                  </p>
                </div>
              </div>

              {/* Progress Countdown Bar (5 min / 300s) */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 rounded-full"
                  style={{ width: `${(searchCountdown / 300) * 100}%` }}
                />
              </div>

              {/* Trip Details Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                {/* Tier and Payment pill */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                      {selectedTier === "shared" ? "🛺⚡ শেয়ার্ড ইকোনমি" : selectedTier === "reserved" ? "🛺✨ স্পেশাল রিজার্ভ" : "🛺 স্ট্যান্ডার্ড টোটো"}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      {paymentMode === "upi" ? "📱 UPI" : "💵 নগদ"}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    ~{Math.round(tripDistance * 3.5 + 2)} মিনিট
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">পিকআপ:</span>
                    <span className="font-bold text-slate-800 ml-1">{pickupText}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">গন্তব্য:</span>
                    <span className="font-bold text-slate-800 ml-1">{dropText}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between font-medium">
                  <span className="text-slate-500">দূরত্ব: {tripDistance} কিমি</span>
                  <span className="text-sm font-black text-emerald-700">₹{tripFare}.০০ ভাড়া</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 font-bold shadow-xs"
                  onClick={() => {
                    setPhase("passenger_home");
                    toast.info("অনুসন্ধান বাতিল করা হয়েছে");
                  }}
                >
                  ❌ রিকোয়েস্ট বাতিল করুন
                </Button>
              </div>
              <div className="h-24 w-full shrink-0" aria-hidden="true" />
            </div>
          ) : (
            /* Rider Did Not Accept View (Shows trip details & Find Again) */
            <div className="bg-white rounded-3xl p-5 border-2 border-amber-300 shadow-xl space-y-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 text-xl">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    কোনো চালক রাইড গ্রহণ করতে পারেননি
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    আমরা আন্তরিকভাবে দুঃখিত! আপনার ৫ কিমির ভেতরের চালকরা এই মুহূর্তে অন্য ট্রিপে ব্যস্ত আছেন অথবা রিকোয়েস্টটি গ্রহণ করতে পারেননি।
                  </p>
                </div>
              </div>

              {/* Keep Trip Details Visible */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 text-xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
                  আপনার সংরক্ষিত ট্রিপের বিবরণ:
                </span>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">পিকআপ:</span>
                    <span className="font-bold text-slate-900 ml-1">{pickupText}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">গন্তব্য:</span>
                    <span className="font-bold text-slate-900 ml-1">{dropText}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between font-medium">
                  <span className="text-slate-600">দূরত্ব: {tripDistance} কিমি</span>
                  <span className="text-sm font-black text-slate-900">নগদ ভাড়া: ₹{tripFare}.00</span>
                </div>
              </div>

              {/* Action Buttons: Find Again vs Cancel vs Demo Accept */}
              <div className="space-y-2 pt-1">
                <Button
                  size="lg"
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                  onClick={async () => {
                    setSearchStatus("searching");
                    setSearchCountdown(300);
                    playRideAlertSound();
                    toast.info("পুনরায় ৫ মিনিটের জন্য চালক খোঁজা হচ্ছে...");

                    try {
                      const res = await fetch("/api/bookings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          customerName: session?.passengerName || "যাত্রী",
                          customerPhone: session?.phone || "918348122122",
                          pickupLocation: pickupText,
                          dropLocation: dropText,
                          pickupCoords,
                          dropCoords,
                          estimatedFare: tripFare,
                          tripDistance,
                        }),
                      });
                      const data = await res.json();
                      if (data.booking && data.booking.id) {
                        setActiveBookingId(data.booking.id);
                      }
                    } catch {}
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>🔄 আবার খুঁজুন (Find Again)</span>
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl text-xs text-slate-700 border-slate-300 font-semibold bg-white"
                  onClick={() => {
                    setPhase("passenger_home");
                    setSearchStatus("searching");
                    toast.info("বুকিং উইন্ডোতে ফিরে গেছেন");
                  }}
                >
                  ❌ বুকিং বাতিল করুন
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: POST-TRIP DIGITAL RECEIPT, RATING & COMPLAINTS SCREEN
  // -------------------------------------------------------------
  if (phase === "passenger_trip_completed") {
    return (
      <TripCompletionReceipt
        tripId="SR-9412"
        customerName={session?.passengerName || "যাত্রী বন্ধু"}
        customerPhone={session?.phone || "9876543210"}
        driverName={passengerBooking?.driverName || "রাজেশ মন্ডল"}
        driverPhone={passengerBooking?.driverPhone || "9593177885"}
        totoNumber={passengerBooking?.totoNumber || "WB-96-T-8421"}
        pickup={pickupText}
        drop={dropText}
        distanceKm={tripDistance}
        fare={tripFare}
        onBookAnother={() => {
          setPassengerBooking(null);
          setPhase("passenger_home");
          toast.success("নতুন ট্রিপ বুক করার জন্য প্রস্তুত!");
        }}
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW: PASSENGER HOME / BOOKING SCREEN (Light Theme with Interactive Google Map)
  // -------------------------------------------------------------
  return (
    <MobileAppShell>
      <div className="min-h-full flex-1 text-slate-900 flex flex-col justify-between select-none bg-slate-50">
      {/* Modern App Header */}
      <MobileAppHeader
        role="passenger"
        userName={session?.passengerName || "যাত্রী বন্ধু"}
        isSoundMuted={isSoundMuted}
        onToggleSound={() => {
          setIsSoundMuted(!isSoundMuted);
          toast.info(!isSoundMuted ? "সাউন্ড মিউট করা হয়েছে 🔇" : "সাউন্ড সক্রিয় করা হয়েছে 🔔");
        }}
        onSwitchRole={handleSwitchRole}
        onSosClick={() => setShowSosModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Booking Interface */}
      <div className="flex-1 p-4 sm:p-6 space-y-4 pb-48">
        {bottomNavTab === "map" && !passengerBooking ? (
          <div className="space-y-4 pb-32">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">লাইভ ম্যাপ ও নিকটবর্তী চালক</h3>
                <p className="text-xs text-slate-500">সুন্দরবন অঞ্চলের লাইভ রোড ম্যাপ ও সক্রিয় টোটো</p>
              </div>
              <button
                type="button"
                onClick={() => setBottomNavTab("home")}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs"
              >
                ← রাইড বুকিং
              </button>
            </div>
            <div className="h-[420px] w-full rounded-3xl overflow-hidden shadow-md">
              <NearbyRidersRadarMap
                pickupCoords={pickupCoords}
                dropCoords={dropCoords}
                pickupName={pickupText}
                dropName={dropText}
              />
            </div>
            <div className="h-28 w-full" aria-hidden="true" />
          </div>
        ) : bottomNavTab === "trips" && !passengerBooking ? (
          <div className="space-y-4 pb-32">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">আমার রাইড হিস্ট্রি</h3>
                <p className="text-xs text-slate-500">পূর্ববর্তী সম্পূর্ণ ট্রিপ ও ডিজিটাল রসিদ</p>
              </div>
              <button
                type="button"
                onClick={() => setBottomNavTab("home")}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs"
              >
                ← রাইড বুকিং
              </button>
            </div>
            {/* History Summary Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
                    🛺
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">সুন্দরবন টোটো রাইড</h4>
                    <span className="text-[10px] text-slate-400">আজকের ট্রিপ • সম্পূর্ণ</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                  সম্পূর্ণ ✓
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-slate-600">
                <p>📍 পিকআপ: <strong className="text-slate-800">{pickupText}</strong></p>
                <p>🏁 গন্তব্য: <strong className="text-slate-800">{dropText}</strong></p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">দূরত্ব: {tripDistance} কিমি</span>
                <span className="font-black text-sm text-slate-900">₹{tripFare}.০০ (নগদ)</span>
              </div>
            </div>
            <div className="h-28 w-full" aria-hidden="true" />
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">টোটো রাইড বুক করুন</h2>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">
                পিকআপ স্বয়ংক্রিয় জিপিএস এবং ম্যাপে লাল পিন টেনে গন্তব্য নির্বাচন করুন।
              </p>
            </div>

            {passengerBooking ? (
              <LiveRideTrackingMap
            booking={{
              id: passengerBooking.id,
              driverName: passengerBooking.driverName || "রাজেশ মন্ডল",
              driverPhone: passengerBooking.driverPhone || "9593177885",
              totoNumber: passengerBooking.totoNumber || "WB-96-T-8421",
            }}
            pickupCoords={pickupCoords}
            dropCoords={dropCoords}
            pickupText={pickupText}
            dropText={dropText}
            tripDistance={tripDistance}
            tripFare={tripFare}
            selectedTier={selectedTier}
            paymentMode={paymentMode}
            rideStep={rideStep}
            onStepChange={setRideStep}
            onFinishTrip={() => {
              setPhase("passenger_trip_completed");
              playSuccessSound();
              toast.success("ট্রিপ সফলভাবে সমাপ্ত হয়েছে! ডিজিটাল রসিদ প্রস্তুত।");
            }}
            onCancelClick={() => setShowCancelModal(true)}
            onSosClick={() => setShowSosModal(true)}
          />
        ) : (
          <div className="space-y-4">
            <InteractiveBookingMap
              initialPickup={pickupText}
              initialDrop={dropText}
              onRouteSelected={handleRouteSelected}
            />

            {/* Book Button - Placed directly in the flow! */}
            <div className="pt-2">
              <Button
                size="lg"
                disabled={!dropText || !dropText.trim()}
                className={`w-full h-14 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                  dropText && dropText.trim()
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                    : "bg-slate-200 text-slate-500 border border-slate-300 shadow-none cursor-not-allowed"
                }`}
                onClick={async () => {
                  if (!dropText || !dropText.trim()) {
                    toast.error("অনুগ্রহ করে আপনার গন্তব্য (Drop Location) নির্বাচন করুন");
                    return;
                  }
                  setPhase("passenger_searching");
                  setSearchStatus("searching");
                  setSearchCountdown(300);
                  playRideAlertSound();
                  toast.info("কাছাকাছি ৫ কিমির মধ্যে চালকদের অ্যালার্ট পাঠানো হচ্ছে...");

                  try {
                    const res = await fetch("/api/bookings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        customerName: session?.passengerName || "যাত্রী",
                        customerPhone: session?.phone || "918348122122",
                        pickupLocation: pickupText,
                        dropLocation: dropText,
                        pickupCoords,
                        dropCoords,
                        estimatedFare: tripFare,
                        tripDistance,
                        rideTier: selectedTier,
                        paymentMode,
                      }),
                    });
                    const data = await res.json();
                    if (data.booking && data.booking.id) {
                      setActiveBookingId(data.booking.id);
                    }
                  } catch (err) {
                    console.warn("[app] Failed to create live booking:", err);
                  }
                }}
              >
                {dropText && dropText.trim() ? (
                  <span>🛺 টোটো রাইড কনফার্ম করুন (₹{tripFare}.০০)</span>
                ) : (
                  <span>📍 অনুগ্রহ করে গন্তব্য নির্বাচন করুন</span>
                )}
              </Button>
            </div>

            {/* Dedicated safe area bottom spacer so Book Button & Payment row are NEVER obscured by the navbar */}
            <div className="h-32 w-full shrink-0" aria-hidden="true" />
          </div>
        )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EMERGENCY SOS SAFETY SHIELD                             */}
      {/* ------------------------------------------------------------- */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-red-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-base text-slate-900">জরুরি সুরক্ষা ও হেল্পলাইন</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              যেকোনো জরুরি পরিস্থিতিতে অবিলম্বে নিচের সরকারি ও সুন্দরবন রাইডার্স নম্বরে কল করুন:
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <a
                href="tel:112"
                className="p-3.5 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-between shadow-md active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 fill-white" />
                  <span>জাতীয় জরুরি নম্বর (পুলিশ/দমকল)</span>
                </div>
                <span className="font-mono text-sm">১১২</span>
              </a>

              <a
                href="tel:1091"
                className="p-3.5 rounded-2xl bg-purple-600 text-white font-bold flex items-center justify-between shadow-md active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 fill-white" />
                  <span>মহিলা সুরক্ষা হেল্পলাইন</span>
                </div>
                <span className="font-mono text-sm">১০৯১</span>
              </a>

              <a
                href="tel:102"
                className="p-3.5 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-between shadow-md active:scale-98 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 fill-white" />
                  <span>অ্যাম্বুলেন্স জরুরি পরিষেবা</span>
                </div>
                <span className="font-mono text-sm">১০২</span>
              </a>
            </div>

            <Button
              onClick={() => setShowSosModal(false)}
              variant="outline"
              className="w-full h-11 rounded-2xl text-xs font-bold border-slate-300 text-slate-700 mt-2"
            >
              বন্ধ করুন
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CANCEL RIDE CONFIRMATION                                */}
      {/* ------------------------------------------------------------- */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">রাইড বাতিলের কারণ</h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              রাইডটি বাতিল করার জন্য একটি কারণ নির্বাচন করুন:
            </p>

            <div className="space-y-2">
              {[
                "চালক অনেক দূরে অবস্থান করছেন",
                "ভুল পিকআপ বা গন্তব্য নির্বাচন করেছি",
                "দেরি হচ্ছে, অন্য যানবাহনে যাচ্ছি",
                "পরিকল্পনা পরিবর্তন হয়েছে",
              ].map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={async () => {
                    if (activeBookingId || passengerBooking?.id) {
                      try {
                        const apiUrl = "/api/bookings";
                        await fetch(apiUrl, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "cancel",
                            bookingId: activeBookingId || passengerBooking?.id,
                            cancelReason: reason,
                          }),
                        });
                      } catch {}
                    }
                    setPassengerBooking(null);
                    setActiveBookingId(null);
                    setShowCancelModal(false);
                    toast.info(`রাইড বাতিল করা হয়েছে: ${reason}`);
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 text-left text-xs font-semibold text-slate-800 transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>

            <Button
              onClick={() => setShowCancelModal(false)}
              variant="ghost"
              className="w-full text-xs text-slate-500 h-9 font-medium"
            >
              বাতিল করবেন না, রাইড চালিয়ে যান
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Dock for Passenger */}
      <MobileBottomNav
        activeTab={bottomNavTab}
        onTabChange={(t) => {
          if (t === "safety") setShowSosModal(true);
          else setBottomNavTab(t);
        }}
        role="passenger"
      />
      </div>
    </MobileAppShell>
  );
}

export default function MobileAppPage() {
  return (
    <AppErrorBoundary>
      <MobileAppPageContent />
    </AppErrorBoundary>
  );
}
