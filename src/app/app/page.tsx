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
  AlertTriangle,
  Bell,
  Volume2,
  LogOut,
  RefreshCw,
  ArrowRight,
  Upload,
  FileText,
  CreditCard,
  Camera,
  Trash2,
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
  KeyRound,
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
import {
  DisclaimerScreen,
  DisclaimerViewerModal,
  hasUserAcceptedDisclaimer,
  setUserAcceptedDisclaimer,
} from "@/components/mobile/disclaimer-screen";

interface MobileSession {
  phone: string;
  role: "rider" | "passenger";
  driverId?: string;
  driverName?: string;
  totoNumber?: string;
  uniqueId?: string;
  isApproved?: boolean;
  passengerName?: string;
}

// Helper function to compress and encode document files client-side
const processDocumentFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

function MobileAppPageContent() {
  // App Phase: 'splash' | 'permissions' | 'select_role' | 'otp_login' | 'kyc_form' | 'kyc_pending' | 'rider_home' | 'passenger_home'
  const [phase, setPhase] = useState<string>("splash");
  const [role, setRole] = useState<"rider" | "passenger">("rider");
  const [session, setSession] = useState<MobileSession | null>(null);
  const [bottomNavTab, setBottomNavTab] = useState<MobileNavTab>("home");
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [showDisclaimerViewer, setShowDisclaimerViewer] = useState(false);
  const [pendingAuthResult, setPendingAuthResult] = useState<{
    role: "rider" | "passenger";
    phone: string;
    is_registered?: boolean;
    is_approved?: boolean;
    driver?: any;
    customer?: any;
  } | null>(null);

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
  const [kycAadharNumber, setKycAadharNumber] = useState("");
  const [kycTotoNumber, setKycTotoNumber] = useState("");
  const [kycLicenseNumber, setKycLicenseNumber] = useState("");

  // 1. Aadhaar Card (Top - Mandatory)
  const [kycAadharDoc, setKycAadharDoc] = useState("");
  const [kycAadharName, setKycAadharName] = useState("");
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const aadharFileInputRef = useRef<HTMLInputElement>(null);

  // 2. Toto Rosit / Receipt (Mandatory)
  const [kycReceiptDoc, setKycReceiptDoc] = useState("");
  const [kycReceiptName, setKycReceiptName] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  // 3. Driving Licence (Optional)
  const [kycLicenseDoc, setKycLicenseDoc] = useState("");
  const [kycLicenseName, setKycLicenseName] = useState("");
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const licenseFileInputRef = useRef<HTMLInputElement>(null);

  const handleAadharFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAadhar(true);
      const dataUrl = await processDocumentFile(file);
      setKycAadharDoc(dataUrl);
      setKycAadharName(file.name);

      // Upload to ImgBB directly from browser or via /api/upload
      try {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "9629d00aad1613f9bb2f05c5a3a0dd40";
        const formData = new FormData();
        formData.append("image", file);
        formData.append("name", `aadhar_${file.name}`);

        let uploadedUrl: string | null = null;
        try {
          const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData,
          });
          const directJson = await directRes.json();
          if (directJson.success && directJson.data?.url) {
            uploadedUrl = directJson.data.url;
          }
        } catch {}

        if (!uploadedUrl) {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const json = await res.json();
          if (json.success && json.url && !json.fallback) {
            uploadedUrl = json.url;
          }
        }

        if (uploadedUrl) {
          setKycAadharDoc(uploadedUrl);
          toast.success("আধার কার্ড সফলভাবে আপলোড হয়েছে!");
        } else {
          toast.success("আধার কার্ড সফলভাবে সংযুক্ত হয়েছে!");
        }
      } catch {
        toast.success("আধার কার্ড সফলভাবে সংযুক্ত হয়েছে!");
      }
    } catch {
      toast.error("ফাইল প্রসেস করতে ত্রুটি হয়েছে");
    } finally {
      setUploadingAadhar(false);
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingReceipt(true);
      const dataUrl = await processDocumentFile(file);
      setKycReceiptDoc(dataUrl);
      setKycReceiptName(file.name);

      // Upload to ImgBB directly from browser or via /api/upload
      try {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "9629d00aad1613f9bb2f05c5a3a0dd40";
        const formData = new FormData();
        formData.append("image", file);
        formData.append("name", `toto_receipt_${file.name}`);

        let uploadedUrl: string | null = null;
        try {
          const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData,
          });
          const directJson = await directRes.json();
          if (directJson.success && directJson.data?.url) {
            uploadedUrl = directJson.data.url;
          }
        } catch {}

        if (!uploadedUrl) {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const json = await res.json();
          if (json.success && json.url && !json.fallback) {
            uploadedUrl = json.url;
          }
        }

        if (uploadedUrl) {
          setKycReceiptDoc(uploadedUrl);
          toast.success("টোটো রসিদ সফলভাবে আপলোড হয়েছে!");
        } else {
          toast.success("টোটো রসিদ সফলভাবে সংযুক্ত হয়েছে!");
        }
      } catch {
        toast.success("টোটো রসিদ সফলভাবে সংযুক্ত হয়েছে!");
      }
    } catch {
      toast.error("ফাইল প্রসেস করতে ত্রুটি হয়েছে");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleLicenseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLicense(true);
      const dataUrl = await processDocumentFile(file);
      setKycLicenseDoc(dataUrl);
      setKycLicenseName(file.name);

      // Upload to ImgBB directly from browser or via /api/upload
      try {
        const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "9629d00aad1613f9bb2f05c5a3a0dd40";
        const formData = new FormData();
        formData.append("image", file);
        formData.append("name", `license_${file.name}`);

        let uploadedUrl: string | null = null;
        try {
          const directRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData,
          });
          const directJson = await directRes.json();
          if (directJson.success && directJson.data?.url) {
            uploadedUrl = directJson.data.url;
          }
        } catch {}

        if (!uploadedUrl) {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const json = await res.json();
          if (json.success && json.url && !json.fallback) {
            uploadedUrl = json.url;
          }
        }

        if (uploadedUrl) {
          setKycLicenseDoc(uploadedUrl);
          toast.success("ড্রাইভিং লাইসেন্স সফলভাবে আপলোড হয়েছে!");
        } else {
          toast.success("ড্রাইভিং লাইসেন্স সংযুক্ত হয়েছে (ঐচ্ছিক)!");
        }
      } catch {
        toast.success("ড্রাইভিং লাইসেন্স সংযুক্ত হয়েছে (ঐচ্ছিক)!");
      }
    } catch {
      toast.error("ফাইল প্রসেস করতে ত্রুটি হয়েছে");
    } finally {
      setUploadingLicense(false);
    }
  };

  // Driver Active State
  const [isOnline, setIsOnline] = useState(true);
  const [incomingRide, setIncomingRide] = useState<any | null>(null);
  const [activeRide, setActiveRide] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sr_active_ride");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [alertCountdown, setAlertCountdown] = useState(30);

  // Passenger State
  const [pickupText, setPickupText] = useState("আপনার বর্তমান অবস্থান (Live GPS)");
  const [dropText, setDropText] = useState("");
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.8680, 88.1630]);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripFare, setTripFare] = useState(0);
  const [passengerCount, setPassengerCount] = useState(3);
  const [selectedTier, setSelectedTier] = useState<"standard" | "shared" | "reserved">("standard");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");
  const [showSosModal, setShowSosModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rideStep, setRideStep] = useState<"assigned" | "arriving" | "in_trip" | "arrived">("assigned");
  const [searchStatus, setSearchStatus] = useState<"searching" | "unaccepted" | "accepted">("searching");
  const [searchCountdown, setSearchCountdown] = useState(180); // 3 minutes search duration
  const [passengerBooking, setPassengerBooking] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sr_passenger_booking");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });
  const [activeBookingId, setActiveBookingId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("sr_active_booking_id");
      } catch {}
    }
    return null;
  });
  const [customerStrikes, setCustomerStrikes] = useState<number>(0);
  const [isCustomerBlocked, setIsCustomerBlocked] = useState<boolean>(false);
  const declinedBookingIdsRef = useRef<Set<string>>(new Set());
  const isAcceptingRef = useRef<string | null>(null);
  const [driverLiveCoords, setDriverLiveCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [showStartOtpModal, setShowStartOtpModal] = useState(false);
  const [startOtpInput, setStartOtpInput] = useState("");
  const [isVerifyingStartOtp, setIsVerifyingStartOtp] = useState(false);

  // Permissions state
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Customer Past Rides History State
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchCustomerHistory = useCallback(async () => {
    const phone = session?.phone || phoneInput;
    if (!phone) {
      setIsLoadingHistory(false);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/bookings?customer_phone=${phone}&history=true`);
      const data = await res.json();
      if (data?.bookings && Array.isArray(data.bookings)) {
        setCustomerHistory(data.bookings);
      }
    } catch (err) {
      console.warn("Failed to fetch customer history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [session?.phone, phoneInput]);

  const handleVerifyAndStartJourney = async () => {
    if (!activeRide) return;
    const cleanOtp = startOtpInput.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      toast.error("অনুগ্রহ করে ৪ ডিজিটের সঠিক ওটিপি দিন");
      return;
    }
    setIsVerifyingStartOtp(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          bookingId: activeRide.id,
          driverId: session?.driverId,
          otp: cleanOtp,
          startCoords: driverLiveCoords || (activeRide.pickupCoords || null),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "ভুল ওটিপি! অনুগ্রহ করে যাত্রীর থেকে সঠিক ওটিপি জেনে লিখুন।");
        setIsVerifyingStartOtp(false);
        return;
      }
      setActiveRide((prev: any) => (prev ? { ...prev, status: "on_trip" } : null));
      setShowStartOtpModal(false);
      setStartOtpInput("");
      playSuccessSound();
      toast.success("ওটিপি যাচাই সফল! যাত্রা শুরু হয়েছে। সাবধানে ড্রাইভ করুন।");
    } catch {
      toast.error("সার্ভার সংযোগ সমস্যা। আবার চেষ্টা করুন।");
    } finally {
      setIsVerifyingStartOtp(false);
    }
  };

  useEffect(() => {
    if (bottomNavTab === "trips" || (role === "passenger" && session?.phone)) {
      fetchCustomerHistory();
    }
  }, [bottomNavTab, role, session?.phone, fetchCustomerHistory]);

  const handleConfirmBooking = useCallback(async () => {
    if (isCustomerBlocked || customerStrikes >= 3) {
      toast.error("⚠️ ৩ বার বুকিং বাতিল করায় আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। অ্যাকাউন্ট সচল করতে হেল্পলাইনে (9593177885) যোগাযোগ করুন।");
      return;
    }
    if (!dropText || !dropText.trim()) {
      toast.error("অনুগ্রহ করে আপনার গন্তব্য (Drop Location) নির্বাচন করুন");
      return;
    }
    if (!session?.phone) {
      toast.error("টোটো বুক করতে দয়া করে আপনার হোয়াটসঅ্যাপ নম্বর দিয়ে লগইন করুন");
      setRole("passenger");
      setPhase("otp_login");
      return;
    }
    setPhase("passenger_searching");
    setSearchStatus("searching");
    setSearchCountdown(180);
    playRideAlertSound();
    toast.info("কাছাকাছি ৫ কিমির মধ্যে চালকদের অ্যালার্ট পাঠানো হচ্ছে...");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: session?.passengerName || "যাত্রী বন্ধু",
          customerPhone: session.phone,
          pickupLocation: pickupText,
          dropLocation: dropText,
          pickupCoords,
          dropCoords,
          estimatedFare: tripFare || 20,
          tripDistance,
          passengerCount: passengerCount || 3,
          rideTier: selectedTier || "standard",
          paymentMode: "cash",
        }),
      });
      const data = await res.json();
      if (!res.ok && data.error === "customer_blocked") {
        setIsCustomerBlocked(true);
        setCustomerStrikes(data.cancellation_count || 3);
        setPhase("passenger_home");
        toast.error(data.message || "৩ বার বাতিল করায় আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে।", { duration: 6000 });
        return;
      }
      if (data.booking && data.booking.id) {
        setActiveBookingId(data.booking.id);
      }
    } catch (err) {
      console.warn("[app] Failed to create live booking:", err);
    }
  }, [dropText, pickupText, pickupCoords, dropCoords, tripFare, tripDistance, passengerCount, selectedTier, session, isCustomerBlocked, customerStrikes]);

  // Memoized route handler to eliminate parent re-render loops
  const handleRouteSelected = useCallback((route: any) => {
    if (route.pickup) setPickupText(route.pickup);
    if (route.drop !== undefined) setDropText(route.drop);
    if (route.pickupCoords) setPickupCoords(route.pickupCoords);
    if (route.dropCoords) setDropCoords(route.dropCoords);
    if (route.distanceKm !== undefined) setTripDistance(route.distanceKm);
    if (route.estimatedFare !== undefined) setTripFare(route.estimatedFare);
    if (route.passengerCount !== undefined) setPassengerCount(route.passengerCount);
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
        // 3-minute timeout reached without acceptance!
        setSearchStatus("unaccepted");
        toast.error("দুঃখিত! বিগত ৩ মিনিটে কোনো চালক রাইড গ্রহণ করতে পারেননি।");
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
            if (b.pickup_location) setPickupText(b.pickup_location);
            if (b.drop_location) setDropText(b.drop_location);
            if (b.pickup_lat && b.pickup_lng) setPickupCoords([Number(b.pickup_lat), Number(b.pickup_lng)]);
            if (b.drop_lat && b.drop_lng) setDropCoords([Number(b.drop_lat), Number(b.drop_lng)]);
            if (b.estimated_fare) setTripFare(Number(b.estimated_fare));
            setPassengerBooking({
              id: b.booking_number || b.id.slice(0, 8),
              bookingNumber: b.booking_number,
              driverName: b.driver_name || "টোটো চালক",
              driverPhone: b.driver_phone || "",
              totoNumber: b.driver_unique_id || b.toto_number || "",
              uniqueId: b.driver_unique_id || b.toto_number || "",
              startOtp: b.start_otp,
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

  // Passenger Live Polling for Ride Progress (Driver heading to pickup -> Journey Started -> Completed)
  useEffect(() => {
    if (!passengerBooking && !activeBookingId) return;
    const bId = activeBookingId || passengerBooking?.id || passengerBooking?.bookingNumber;
    if (!bId) return;

    let isMounted = true;
    const pollRideStatus = async () => {
      try {
        const res = await fetch(`/api/bookings?id=${bId}`);
        const data = await res.json();
        const b = data.booking;
        if (!b || !isMounted) return;

        // Keep locations and coordinates synchronized
        if (b.pickup_location) setPickupText(b.pickup_location);
        if (b.drop_location) setDropText(b.drop_location);
        if (b.pickup_lat && b.pickup_lng) setPickupCoords([Number(b.pickup_lat), Number(b.pickup_lng)]);
        if (b.drop_lat && b.drop_lng) setDropCoords([Number(b.drop_lat), Number(b.drop_lng)]);

        // Keep startOtp up to date if returned
        if (b.start_otp) {
          setPassengerBooking((prev: any) => (prev ? { ...prev, startOtp: b.start_otp } : prev));
        }

        // When driver starts the trip:
        if (b.status === "in_progress") {
          setRideStep((prev) => {
            if (prev !== "in_trip") {
              playSuccessSound();
              toast.success("🛺 আপনার যাত্রা শুরু হয়েছে! শুভ ও নিরাপদ যাত্রা।");
            }
            return "in_trip";
          });
        } else if (b.status === "completed") {
          setRideStep("arrived");
          setPhase("passenger_trip_completed");
          playSuccessSound();
          toast.success("আপনার ট্রিপ সফলভাবে সম্পন্ন হয়েছে! ডিজিটাল রসিদ প্রস্তুত।");
        } else if (b.status === "cancelled") {
          setPassengerBooking(null);
          toast.error("রাইডটি বাতিল করা হয়েছে।");
        }
      } catch {}
    };

    pollRideStatus();
    const interval = setInterval(pollRideStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [passengerBooking, activeBookingId]);

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
          uniqueId: driver.unique_id || driver.toto_number,
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
        if (parsed.role === "passenger") {
          const p = parsed.phone?.replace(/\D/g, "").slice(-10);
          if (p && p.length === 10) {
            setSession(parsed);
            setRole("passenger");
          } else {
            localStorage.removeItem("sr_mobile_session");
          }
        } else {
          setSession(parsed);
          setRole(parsed.role);
        }
      } catch {
        // fallback
      }
    }
  }, []);

  // -------------------------------------------------------------
  // PERSIST ACTIVE RIDES & BOOKINGS IN LOCALSTORAGE
  // -------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeRide) {
      localStorage.setItem("sr_active_ride", JSON.stringify(activeRide));
    } else {
      localStorage.removeItem("sr_active_ride");
    }
  }, [activeRide]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (passengerBooking) {
      localStorage.setItem("sr_passenger_booking", JSON.stringify(passengerBooking));
    } else {
      localStorage.removeItem("sr_passenger_booking");
    }
  }, [passengerBooking]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeBookingId) {
      localStorage.setItem("sr_active_booking_id", activeBookingId);
    } else {
      localStorage.removeItem("sr_active_booking_id");
    }
  }, [activeBookingId]);

  // -------------------------------------------------------------
  // RESTORE ACTIVE RIDE STATE ON REFRESH / MOUNT (Rider & Passenger)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!session?.phone && !session?.driverId) return;

    let isMounted = true;

    // 1. For Driver (Rider): Check for active ride (assigned or in_progress)
    if (session.role === "rider") {
      const restoreDriverActiveRide = async () => {
        try {
          const query = session.driverId
            ? `driver_id=${session.driverId}&active=true`
            : `driver_phone=${session.phone}&active=true`;
          const res = await fetch(`/api/bookings?${query}`);
          const data = await res.json();
          if (!isMounted) return;

          if (data?.booking && (data.booking.status === "assigned" || data.booking.status === "in_progress")) {
            const b = data.booking;
            const restoredRide = {
              id: b.id,
              bookingNumber: b.booking_number,
              fare: b.estimated_fare || b.final_fare || 50,
              passengerName: b.customer_name || "যাত্রী",
              passengerPhone: b.customer_phone || "",
              pickup: b.pickup_location || "পিকআপ পয়েন্ট",
              drop: b.drop_location || "গন্তব্য",
              pickupCoords: b.pickup_lat && b.pickup_lng ? [Number(b.pickup_lat), Number(b.pickup_lng)] : [21.8760, 88.1920],
              dropCoords: b.drop_lat && b.drop_lng ? [Number(b.drop_lat), Number(b.drop_lng)] : [21.8680, 88.1630],
              status: b.status === "in_progress" ? "on_trip" : "heading_pickup",
            };
            setActiveRide(restoredRide);
            if (typeof window !== "undefined") {
              localStorage.setItem("sr_active_ride", JSON.stringify(restoredRide));
            }
            setIsOnline(true);
            setPhase("rider_home");
          } else if (data?.booking === null) {
            setActiveRide(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("sr_active_ride");
            }
          }
        } catch (err) {
          console.warn("[app] Failed to restore driver active ride:", err);
        }
      };

      restoreDriverActiveRide();
    }

    // 2. For Passenger: Check for active booking & cancellation strikes
    if (session.role === "passenger" && session.phone) {
      const restorePassengerActiveBooking = async () => {
        try {
          const res = await fetch(`/api/bookings?customer_phone=${session.phone}&active=true`);
          const data = await res.json();
          if (!isMounted) return;

          // Sync cancellation strikes and blocked status
          if (data?.customer) {
            const strikes = data.customer.cancellation_count || 0;
            const blocked = Boolean(data.customer.is_blocked || strikes >= 3);
            setCustomerStrikes(strikes);
            setIsCustomerBlocked(blocked);
          }

          if (data?.booking) {
            const b = data.booking;
            if (b.status === "pending") {
              setPickupText(b.pickup_location || "আপনার পিকআপ অবস্থান");
              setDropText(b.drop_location || "");
              if (b.pickup_lat && b.pickup_lng) setPickupCoords([Number(b.pickup_lat), Number(b.pickup_lng)]);
              if (b.drop_lat && b.drop_lng) setDropCoords([Number(b.drop_lat), Number(b.drop_lng)]);
              if (b.estimated_fare) setTripFare(Number(b.estimated_fare));
              setActiveBookingId(b.id);
              setSearchStatus("searching");
              setSearchCountdown(180);
              setPhase("passenger_searching");
              if (typeof window !== "undefined") {
                localStorage.setItem("sr_active_booking_id", b.id);
                localStorage.setItem("sr_search_status", "searching");
              }
            } else if (b.status === "assigned" || b.status === "in_progress") {
              setPickupText(b.pickup_location || "আপনার পিকআপ অবস্থান");
              setDropText(b.drop_location || "");
              if (b.pickup_lat && b.pickup_lng) setPickupCoords([Number(b.pickup_lat), Number(b.pickup_lng)]);
              if (b.drop_lat && b.drop_lng) setDropCoords([Number(b.drop_lat), Number(b.drop_lng)]);
              if (b.estimated_fare) setTripFare(Number(b.estimated_fare));
              const restoredPassenger = {
                id: b.booking_number || b.id.slice(0, 8),
                bookingNumber: b.booking_number,
                driverName: b.driver_name || "টোটো চালক",
                driverPhone: b.driver_phone || "",
                totoNumber: b.unique_id || b.toto_number || "SR-DRV",
                uniqueId: b.unique_id || b.toto_number || "SR-DRV",
                startOtp: b.start_otp,
              };
              setPassengerBooking(restoredPassenger);
              setActiveBookingId(b.id);
              setRideStep(b.status === "in_progress" ? "in_trip" : "assigned");
              setPhase("passenger_home");
              if (typeof window !== "undefined") {
                localStorage.setItem("sr_passenger_booking", JSON.stringify(restoredPassenger));
                localStorage.setItem("sr_active_booking_id", b.id);
                localStorage.removeItem("sr_search_status");
              }
            }
          } else if (data?.booking === null) {
            setPassengerBooking(null);
            setActiveBookingId(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("sr_passenger_booking");
              localStorage.removeItem("sr_active_booking_id");
              localStorage.removeItem("sr_search_status");
            }
          }
        } catch (err) {
          console.warn("[app] Failed to restore passenger active booking:", err);
        }
      };

      restorePassengerActiveBooking();
    }

    return () => {
      isMounted = false;
    };
  }, [session?.phone, session?.role, session?.driverId]);

  // Strict Guard: Passenger must be logged in with a valid 10-digit WhatsApp phone
  useEffect(() => {
    if (phase === "passenger_home") {
      const p = session?.phone?.replace(/\D/g, "").slice(-10);
      if (!p || p.length !== 10) {
        setRole("passenger");
        setPhoneInput("");
        setOtpInput("");
        setOtpSent(false);
        setPhase("otp_login");
        toast.info("টোটো বুক করতে অনুগ্রহ করে আপনার হোয়াটসঅ্যাপ নম্বর দিয়ে লগইন করুন");
      }
    }
  }, [phase, session]);

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

  // Two-way online/offline status synchronization between App and WhatsApp/Database
  useEffect(() => {
    if (phase !== "rider_home" || (!session?.driverId && !session?.phone)) return;
    const phone = session?.phone || "";
    const driverId = session?.driverId || "";

    const syncDriverStatus = async () => {
      try {
        const query = driverId ? `id=${driverId}` : `phone=${phone}`;
        const res = await fetch(`/api/drivers?${query}`);
        const data = await res.json();
        const d = data.driver || (data.drivers && data.drivers[0]);
        if (d && typeof d.is_active === "boolean") {
          const serverIsOnline = Boolean(d.is_active && d.is_available);
          setIsOnline(serverIsOnline);
        }
      } catch {}
    };

    syncDriverStatus();
    const interval = setInterval(syncDriverStatus, 4000);
    return () => clearInterval(interval);
  }, [phase, session?.driverId, session?.phone]);

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
                fare: b.estimated_fare || 0,
                passengerName: b.customer_name || "যাত্রী",
                passengerRating: 5.0,
                passengerPhone: b.customer_phone || "",
                pickup: b.pickup_location || "পিকআপ লোকেশন",
                pickupDistance: "",
                drop: b.drop_location || "গন্তব্য",
                tripDistance: b.trip_distance_km ? `${b.trip_distance_km} কিমি ট্রিপ` : "",
                pickupCoords: b.pickup_lat && b.pickup_lng ? [Number(b.pickup_lat), Number(b.pickup_lng)] : (b.start_coords || [21.8760, 88.1920]),
                dropCoords: b.drop_lat && b.drop_lng ? [Number(b.drop_lat), Number(b.drop_lng)] : (b.end_coords || [21.8680, 88.1630]),
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
      const saved = typeof window !== "undefined" ? localStorage.getItem("sr_mobile_session") : null;
      let hasPhone = false;
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MobileSession;
          if (parsed.role === "passenger" && parsed.phone) {
            setSession(parsed);
            hasPhone = true;
          }
        } catch {}
      }
      if (hasPhone) {
        setPhase("passenger_home");
      } else {
        setPhoneInput("");
        setOtpInput("");
        setOtpSent(false);
        setPhase("otp_login");
      }
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

  // Handle Disclaimer Accepted Callback
  const handleDisclaimerAccepted = () => {
    const effectivePhone = (phoneInput || session?.phone || "").replace(/\D/g, "").slice(-10);
    setUserAcceptedDisclaimer(role, effectivePhone);
    playSuccessSound();
    toast.success("শর্তাবলী সফলভাবে গৃহীত হয়েছে!");

    if (role === "rider") {
      const isReg = pendingAuthResult ? pendingAuthResult.is_registered : session?.driverId;
      const isApp = pendingAuthResult ? pendingAuthResult.is_approved : session?.isApproved;

      if (!isReg) {
        setPhase("kyc_form");
        toast.info("অনুগ্রহ করে চালকের তথ্য ও ডকুমেন্ট সাবমিট করুন");
      } else if (isApp === false) {
        setPhase("kyc_pending");
      } else {
        setPhase("rider_home");
        toast.success("স্বাগতম চালক বন্ধু!");
      }
    } else {
      setPhase("passenger_home");
      toast.success(session?.passengerName ? `স্বাগতম ${session.passengerName}!` : "স্বাগতম যাত্রী বন্ধু!");
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
        const cleanPhone = (json.phone || phoneInput).replace(/\D/g, "").slice(-10);
        const alreadyAccepted = hasUserAcceptedDisclaimer(role, cleanPhone);

        if (role === "rider") {
          const isReg = Boolean(json.is_registered);
          const isApp = json.is_approved !== false;
          const newSession: MobileSession = {
            phone: cleanPhone,
            role: "rider",
            isApproved: isReg ? isApp : false,
            driverId: json.driver?.id,
            driverName: json.driver?.name,
            totoNumber: json.driver?.toto_number,
            uniqueId: json.driver?.unique_id || json.driver?.toto_number,
          };
          setSession(newSession);
          localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));

          // If already registered and already accepted disclaimer: bypass directly
          if (isReg && alreadyAccepted) {
            if (isApp) {
              setPhase("rider_home");
              toast.success("স্বাগতম চালক বন্ধু!");
            } else {
              setPhase("kyc_pending");
            }
          } else {
            // New driver or has not accepted rider disclaimer yet
            setPendingAuthResult({
              role: "rider",
              phone: cleanPhone,
              is_registered: isReg,
              is_approved: isApp,
              driver: json.driver,
            });
            setPhase("disclaimer");
            toast.info("অনুগ্রহ করে চালক পার্টনার শর্তাবলীতে সম্মতি জানান");
          }
        } else {
          // Passenger login with WhatsApp number
          const pName = json.customer?.name || "যাত্রী বন্ধু";
          const newSession: MobileSession = {
            phone: cleanPhone,
            role: "passenger",
            passengerName: pName,
          };
          setSession(newSession);
          localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));

          // If already registered / accepted disclaimer: bypass directly
          if (alreadyAccepted) {
            setPhase("passenger_home");
            toast.success(`স্বাগতম ${pName}!`);
          } else {
            // New passenger or has not accepted passenger disclaimer yet
            setPendingAuthResult({
              role: "passenger",
              phone: cleanPhone,
              customer: { name: pName, phone: cleanPhone },
            });
            setPhase("disclaimer");
            toast.info("অনুগ্রহ করে যাত্রী সুরক্ষা শর্তাবলীতে সম্মতি জানান");
          }
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

  // Handle KYC Submission (Aadhaar & Toto Rosit mandatory, Driving Licence optional)
  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectivePhone = phoneInput || session?.phone || "";
    if (!effectivePhone) {
      toast.error("মোবাইল নম্বর পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।");
      return;
    }
    if (!kycName.trim() || !kycAadharNumber.trim() || !kycTotoNumber.trim()) {
      toast.error("চালকের নাম, আধার নম্বর ও টোটো নম্বর প্রদান করুন");
      return;
    }
    if (!kycAadharDoc) {
      toast.error("অনুগ্রহ করে আপনার আধার কার্ডের ছবি আপলোড করুন");
      return;
    }
    if (!kycReceiptDoc) {
      toast.error("অনুগ্রহ করে আপনার টোটো রসিদের ছবি আপলোড করুন");
      return;
    }
    // Driving licence is optional

    try {
      setLoading(true);
      const res = await fetch("/api/riders/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: kycName.trim(),
          phone: effectivePhone,
          email: kycEmail.trim(),
          district: kycDistrict,
          block: kycBlock,
          aadhar_number: kycAadharNumber.trim(),
          toto_number: kycTotoNumber.trim().toUpperCase(),
          license_number: kycLicenseNumber.trim() || "",
          aadhar_doc: kycAadharDoc,
          toto_receipt_doc: kycReceiptDoc,
          license_doc: kycLicenseDoc || "",
          secondary_doc: kycReceiptDoc,
          secondary_doc_type: "toto_receipt",
        }),
      });

      const json = await res.json();
      if (json.success) {
        playSuccessSound();
        const newSession: MobileSession = {
          phone: effectivePhone,
          role: "rider",
          isApproved: false,
          driverName: kycName.trim(),
          totoNumber: kycTotoNumber.trim().toUpperCase(),
          uniqueId: `SR-${effectivePhone.replace(/\D/g, "").slice(-4)}`,
        };
        setSession(newSession);
        localStorage.setItem("sr_mobile_session", JSON.stringify(newSession));
        setPhase("kyc_pending");
        toast.success("আধার, টোটো রসিদ ও চালক তথ্য সফলভাবে জমা হয়েছে!");
      } else {
        toast.error(json.message || "রেজিস্ট্রেশন ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি, অনুগ্রহ করে পুনরায় চেষ্টা করুন");
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

  // Delete Driver Profile & Re-register
  const handleDeleteDriverAccount = async () => {
    const dPhone = session?.phone || phoneInput;
    const dId = session?.driverId;
    if (!dPhone && !dId) {
      toast.error("চালকের তথ্য পাওয়া যায়নি");
      return;
    }

    const confirmed = window.confirm(
      "আপনি কি নিশ্চিত যে আপনার চালক অ্যাকাউন্টটি মুছে ফেলতে চান?\n\nমুছে ফেললে আপনার পূর্বের সমস্ত চালক তথ্য রিসেট হয়ে যাবে এবং আপনি সম্পূর্ণ নতুনভাবে আধার ও টোটো নম্বর দিয়ে রেজিস্ট্রেশন করতে পারবেন।"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await fetch("/api/drivers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dId, phone: dPhone }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        playSuccessSound();
        toast.success("চালক প্রোফাইল মুছে ফেলা হয়েছে! এখন নতুনভাবে তথ্য পূরণ করে রেজিস্ট্রেশন করুন।");
        localStorage.removeItem("sr_mobile_session");
        setSession(null);
        setRole("rider");
        setKycName("");
        setKycTotoNumber("");
        setKycAadharNumber("");
        setKycLicenseNumber("");
        setKycAadharDoc("");
        setKycAadharName("");
        setKycReceiptDoc("");
        setKycReceiptName("");
        setKycLicenseDoc("");
        setKycLicenseName("");
        setPhase("kyc_form");
      } else {
        toast.error(data.error || "অ্যাকাউন্ট মুছে ফেলা ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setLoading(false);
    }
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
                if (parsed.phone) {
                  const savedSearch = localStorage.getItem("sr_search_status");
                  const savedBookingId = localStorage.getItem("sr_active_booking_id");
                  const savedPassengerBooking = localStorage.getItem("sr_passenger_booking");
                  if (savedSearch === "searching" && savedBookingId && !savedPassengerBooking) {
                    setPhase("passenger_searching");
                  } else {
                    setPhase("passenger_home");
                  }
                } else {
                  setPhase("select_role");
                }
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
                    if (hasUserAcceptedDisclaimer("rider", parsed.phone)) {
                      setPhase(parsed.isApproved === false ? "kyc_pending" : "rider_home");
                      return;
                    } else {
                      setPhase("disclaimer");
                      return;
                    }
                  }
                } catch {}
              }
              setPhoneInput("");
              setOtpInput("");
              setOtpSent(false);
              setPhase("otp_login");
            } else {
              setRole("passenger");
              const saved = typeof window !== "undefined" ? localStorage.getItem("sr_mobile_session") : null;
              if (saved) {
                try {
                  const parsed = JSON.parse(saved) as MobileSession;
                  if (parsed.role === "passenger" && parsed.phone) {
                    setSession(parsed);
                    if (hasUserAcceptedDisclaimer("passenger", parsed.phone)) {
                      setPhase("passenger_home");
                      return;
                    } else {
                      setPhase("disclaimer");
                      return;
                    }
                  }
                } catch {}
              }
              // Passenger must login with WhatsApp number so rider can contact them
              setPhoneInput("");
              setOtpInput("");
              setOtpSent(false);
              setPhase("otp_login");
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
        <div className="min-h-full flex-1 text-slate-900 flex flex-col justify-between select-none" style={{background: "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 40%, #ffffff 100%)"}}>
          {/* Top gradient hero area */}
          <div className="px-6 pt-5 space-y-6 max-w-md mx-auto w-full">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPhase("select_role")}
                className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs transition-all active:scale-95"
              >
                ← ফিরে যান
              </button>
              <SundarbanLogo size="sm" variant="badge" showTagline={false} /></div>

            <div>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  role === "rider"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-sky-100 text-sky-800 border border-sky-200"
                }`}
              >
                {role === "rider" ? "🛺 চালক পার্টনার লগইন" : "👤 যাত্রী লগইন • টোটো বুকিং"}
              </span>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
                WhatsApp নম্বর দিয়ে প্রবেশ
              </h2>
              <p className="text-slate-600 text-xs mt-1.5 font-medium leading-relaxed">
                {role === "passenger"
                  ? "🛺 টোটো বুক করার পর চালক দাদা যাতে সরাসরি আপনার সাথে ফোন অথবা হোয়াটসঅ্যাপে যোগাযোগ করে পিকআপ করতে পারেন, তার জন্য হোয়াটসঅ্যাপ নম্বরটি দিন।"
                  : "আপনার হোয়াটসঅ্যাপ নম্বরে কোনো সাধারণ এসএমএস চার্জ ছাড়াই সরাসরি সিকিউরিটি কোড পাঠানো হবে।"}
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-semibold">
                  {role === "passenger" ? "আপনার হোয়াটসঅ্যাপ মোবাইল নম্বর" : "হোয়াটসঅ্যাপ মোবাইল নম্বর"}
                </Label>
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

          <div className="pb-6 px-6 max-w-md mx-auto w-full">
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
  // VIEW: ROLE-BASED DISCLAIMER & TERMS SCREEN (Mandatory for New Users)
  // -------------------------------------------------------------
  if (phase === "disclaimer") {
    return (
      <MobileAppShell>
        <DisclaimerScreen
          role={role}
          phone={phoneInput || session?.phone}
          onAccept={handleDisclaimerAccepted}
          onBack={() => {
            setPhase("otp_login");
          }}
        />
      </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: DRIVER KYC ONBOARDING FORM (Light Theme)
  // -------------------------------------------------------------
  if (phase === "kyc_form") {
    return (
      <MobileAppShell>
        <div className="min-h-full text-slate-900 pb-12" style={{background: "linear-gradient(180deg, #fefce8 0%, #f8fafc 30%, #ffffff 100%)"}}>
        <div className="px-6 pt-5 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-bold bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              নতুন চালক নিবন্ধন
            </span>
            <span className="text-xs text-slate-600 font-mono font-semibold">+91 {phoneInput || session?.phone || ""}</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              চালক তথ্য ও ডকুমেন্ট সাবমিট
            </h2>
            <p className="text-slate-500 text-xs mt-1 font-medium leading-relaxed">
              যাচাইকরণের জন্য আধার কার্ড ও টোটো রসিদের ছবি আপলোড করুন। ড্রাইভিং লাইসেন্স থাকলে দিতে পারেন (ঐচ্ছিক)।
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
              <Label className="text-xs text-slate-700 font-semibold">ইমেইল ঠিকানা (ঐচ্ছিক / অনুমোদনপত্রের জন্য)</Label>
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

            {/* 1. Aadhaar Card Number (AT TOP) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                <span>১. আধার নম্বর (Aadhaar Number) *</span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">বাধ্যতামূলক</span>
              </Label>
              <Input
                placeholder="১২ ডিজিটের আধার নম্বর (যেমন: 1234 5678 9012)"
                value={kycAadharNumber}
                onChange={(e) => setKycAadharNumber(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 font-mono rounded-xl shadow-sm"
              />
            </div>

            {/* 2. Toto Registration Number */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                <span>২. টোটো রেজিস্ট্রেশন নম্বর (Toto Registration No) *</span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">বাধ্যতামূলক</span>
              </Label>
              <Input
                placeholder="যেমন: WB-96-T-8421"
                value={kycTotoNumber}
                onChange={(e) => setKycTotoNumber(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 font-mono rounded-xl uppercase shadow-sm"
              />
            </div>

            {/* 3. Driving Licence Number (OPTIONAL) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                <span>৩. ড্রাইভিং লাইসেন্স নম্বর (Driving Licence No)</span>
                <span className="text-[10px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-full">ঐচ্ছিক (Optional)</span>
              </Label>
              <Input
                placeholder="ড্রাইভিং লাইসেন্স নম্বর (যদি থাকে, যেমন: WB-01-2020-0012345)"
                value={kycLicenseNumber}
                onChange={(e) => setKycLicenseNumber(e.target.value)}
                className="h-12 bg-white border-slate-300 text-slate-900 font-mono rounded-xl shadow-sm uppercase"
              />
            </div>

            {/* Document Upload Section: Aadhaar (Top), Toto Rosit (Middle), Driving Licence (Optional Bottom) */}
            <div className="space-y-4 pt-2">
              <input
                ref={aadharFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleAadharFileChange}
              />
              <input
                ref={receiptFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleReceiptFileChange}
              />
              <input
                ref={licenseFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleLicenseFileChange}
              />

              {/* 1. Aadhaar Card Upload Card (TOP - Mandatory) */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                  <span>১. আধার কার্ডের ছবি (Aadhaar Card) *</span>
                  {kycAadharDoc ? (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> যুক্ত হয়েছে
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                      বাধ্যতামূলক
                    </span>
                  )}
                </Label>

                {kycAadharDoc ? (
                  <div className="p-3.5 rounded-2xl border-2 border-emerald-400 bg-emerald-50/40 shadow-sm space-y-3">
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-emerald-200">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-emerald-300 bg-slate-100 shrink-0 shadow-xs flex items-center justify-center">
                        {kycAadharDoc.startsWith("data:image") || kycAadharDoc.startsWith("http") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={kycAadharDoc} alt="Aadhar Preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-8 h-8 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {kycAadharName || "আধার কার্ড (সংযুক্ত)"}
                        </p>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          ✓ আধার কার্ডের প্রিভিউ প্রস্তুত
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs font-bold border-slate-300 text-slate-800 bg-white hover:bg-slate-100 rounded-xl gap-1.5 shadow-xs cursor-pointer"
                        disabled={uploadingAadhar}
                        onClick={() => aadharFileInputRef.current?.click()}
                      >
                        {uploadingAadhar ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />}
                        ছবি পরিবর্তন (Replace)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl gap-1.5 cursor-pointer"
                        onClick={() => {
                          setKycAadharDoc("");
                          setKycAadharName("");
                          if (aadharFileInputRef.current) aadharFileInputRef.current.value = "";
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        মুছে ফেলুন (Remove)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => aadharFileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer text-center space-y-2.5 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">আধার কার্ডের ছবি নির্বাচন করুন</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">আধার কার্ডের সামনের পরিষ্কার ছবি বা স্ক্যান কপি আপলোড করুন</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-xs font-bold rounded-xl border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-1.5 shadow-xs pointer-events-none"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      আধার ছবি সিলেক্ট করুন
                    </Button>
                  </div>
                )}
              </div>

              {/* 2. Toto Rosit / Receipt Upload Card (MIDDLE - Mandatory) */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                  <span>২. টোটো রসিদ / রেজিস্ট্রেশন ডকুমেন্ট (Toto Rosit / Receipt) *</span>
                  {kycReceiptDoc ? (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> যুক্ত হয়েছে
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                      বাধ্যতামূলক
                    </span>
                  )}
                </Label>

                {kycReceiptDoc ? (
                  <div className="p-3.5 rounded-2xl border-2 border-purple-400 bg-purple-50/40 shadow-sm space-y-3">
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-200">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-purple-300 bg-slate-100 shrink-0 shadow-xs flex items-center justify-center">
                        {kycReceiptDoc.startsWith("data:image") || kycReceiptDoc.startsWith("http") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={kycReceiptDoc} alt="Toto Receipt Preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-8 h-8 text-purple-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {kycReceiptName || "টোটো রসিদ (সংযুক্ত)"}
                        </p>
                        <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
                          ✓ রসিদের প্রিভিউ প্রস্তুত
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs font-bold border-slate-300 text-slate-800 bg-white hover:bg-slate-100 rounded-xl gap-1.5 shadow-xs cursor-pointer"
                        disabled={uploadingReceipt}
                        onClick={() => receiptFileInputRef.current?.click()}
                      >
                        {uploadingReceipt ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-purple-600" />}
                        ছবি পরিবর্তন (Replace)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl gap-1.5 cursor-pointer"
                        onClick={() => {
                          setKycReceiptDoc("");
                          setKycReceiptName("");
                          if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        মুছে ফেলুন (Remove)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => receiptFileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-purple-500 hover:bg-purple-50/20 transition-all cursor-pointer text-center space-y-2.5 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">টোটো রসিদের ছবি নির্বাচন করুন</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">টোটোর রসিদ বা রেজিস্ট্রেশন পেপারের ছবি সিলেক্ট করুন</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-xs font-bold rounded-xl border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 gap-1.5 shadow-xs pointer-events-none"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      টোটো রসিদ সিলেক্ট করুন
                    </Button>
                  </div>
                )}
              </div>

              {/* 3. Driving Licence Upload Card (BOTTOM - OPTIONAL) */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-slate-700 font-semibold flex items-center justify-between">
                  <span>৩. ড্রাইভিং লাইসেন্স (Driving Licence - ঐচ্ছিক / Optional)</span>
                  {kycLicenseDoc ? (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> যুক্ত হয়েছে
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                      ঐচ্ছিক (বাধ্যতামূলক নয়)
                    </span>
                  )}
                </Label>

                {kycLicenseDoc ? (
                  <div className="p-3.5 rounded-2xl border-2 border-blue-400 bg-blue-50/40 shadow-sm space-y-3">
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-blue-200">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-blue-300 bg-slate-100 shrink-0 shadow-xs flex items-center justify-center">
                        {kycLicenseDoc.startsWith("data:image") || kycLicenseDoc.startsWith("http") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={kycLicenseDoc} alt="License Preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-8 h-8 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {kycLicenseName || "ড্রাইভিং লাইসেন্স (ঐচ্ছিক)"}
                        </p>
                        <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                          ✓ লাইসেন্সের প্রিভিউ প্রস্তুত (ঐচ্ছিক)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs font-bold border-slate-300 text-slate-800 bg-white hover:bg-slate-100 rounded-xl gap-1.5 shadow-xs cursor-pointer"
                        disabled={uploadingLicense}
                        onClick={() => licenseFileInputRef.current?.click()}
                      >
                        {uploadingLicense ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-600" />}
                        ছবি পরিবর্তন (Replace)
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl gap-1.5 cursor-pointer"
                        onClick={() => {
                          setKycLicenseDoc("");
                          setKycLicenseName("");
                          if (licenseFileInputRef.current) licenseFileInputRef.current.value = "";
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        মুছে ফেলুন (Remove)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => licenseFileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer text-center space-y-2.5 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">ড্রাইভিং লাইসেন্সের ছবি (ঐচ্ছিক)</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">ড্রাইভিং লাইসেন্স থাকলে দিতে পারেন, না থাকলেও কোনো সমস্যা নেই</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 px-4 text-xs font-bold rounded-xl border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 gap-1.5 shadow-xs pointer-events-none"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      লাইসেন্স ছবি সিলেক্ট করুন (ঐচ্ছিক)
                    </Button>
                  </div>
                )}
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
    </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: KYC PENDING APPROVAL SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "kyc_pending") {
    return (
      <MobileAppShell>
        <div className="min-h-full text-slate-900 flex flex-col justify-between p-6 text-center" style={{background:"linear-gradient(180deg,#fefce8 0%,#f8fafc 50%,#f0fdf4 100%)"}}>
        <div className="pt-12 space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-amber-200/40 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 flex items-center justify-center text-amber-600 shadow-lg">
              <Clock className="w-11 h-11" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              আবেদন অনুমোদনের অপেক্ষায়
            </h2>
            <p className="text-slate-600 text-sm mt-2 max-w-xs mx-auto font-medium">
              নমস্কার {session?.driverName || "চালক বন্ধু"}! আপনার চালক আবেদন ও ডকুমেন্টস সফলভাবে জমা হয়েছে।
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left space-y-2 max-w-xs mx-auto text-xs shadow-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">ইউনিক আইডি / টোটো:</span>
              <span className="font-mono font-bold text-slate-900">{session?.uniqueId || session?.totoNumber || "SR-XXXX"}</span>
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
              className="w-full h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold bg-white text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              onClick={handleDeleteDriverAccount}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>আবেদন বাতিল ও চালক ডিলিট (পুনরায় রেজিস্ট্রেশন)</span>
            </Button>

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
    </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: RIDER HOME / DASHBOARD (Sundarban Riders Live Flow)
  // -------------------------------------------------------------
  if (phase === "rider_home") {
    return (
      <MobileAppShell
        topHeader={
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
            onOpenDisclaimers={() => setShowDisclaimerViewer(true)}
          />
        }
        bottomNav={
          <MobileBottomNav
            activeTab={bottomNavTab}
            onTabChange={(t) => {
              if (t === "safety") setShowSosModal(true);
              else setBottomNavTab(t);
            }}
            role="rider"
          />
        }
      >
        <div className="w-full min-h-full text-slate-900 flex flex-col relative select-none pb-28" style={{background:"linear-gradient(160deg, #f0fdf4 0%, #f8fafc 40%, #eff6ff 100%)"}}>
          {/* Driver Quick Sub-Header: Profile, Toto Number & Online Toggle */}
        <div className="sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between" style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:"1px solid rgba(226,232,240,0.6)",boxShadow:"0 1px 8px rgba(0,0,0,0.05)"}}>
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
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                🆔 {session?.uniqueId || session?.totoNumber || "SR-DRV"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Driver Logout Option */}
            <button
              type="button"
              onClick={handleLogout}
              title="লগআউট করুন"
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center gap-1 transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-[10px]">লগআউট</span>
            </button>

            {/* Online / Offline Toggle */}
            <button
              type="button"
              onClick={async () => {
                const nextOnline = !isOnline;
                setIsOnline(nextOnline);
                if (!isSoundMuted) playSuccessSound();
                toast.success(nextOnline ? "আপনি এখন অনলাইন আছেন 🟢" : "আপনি এখন অফলাইন আছেন 🔴");

                // Sync online/offline status with server and WhatsApp
                const driverId = session?.driverId;
                const phone = session?.phone;
                if (driverId || phone) {
                  try {
                    await fetch("/api/drivers", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: driverId,
                        phone: phone,
                        is_active: nextOnline,
                        is_available: nextOnline,
                      }),
                    });
                  } catch (err) {
                    console.error("Failed to sync driver online status:", err);
                  }
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                isOnline
                  ? "bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/20"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-red-500"}`} />
              <span>{isOnline ? "অনলাইন" : "অফলাইন"}</span>
            </button>
          </div>
        </div>

        {/* Radar & Status Area (When Idle) */}
        {!activeRide && (
          <div className="w-full p-4 space-y-4">
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
                      driverPhone: session?.phone || "",
                      totoNumber: session?.totoNumber || "",
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
                    passengerPhone: b.customer_phone || b.passengerPhone || "",
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
                    passengerPhone: b.customer_phone || b.passengerPhone || "",
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
          </div>
        )}

        {/* Active In-Progress Ride View */}
        {activeRide && (
          <div className="w-full p-4 pb-36 flex flex-col space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl flex items-center justify-between" style={{background:"rgba(240,253,244,0.9)",border:"1px solid rgba(167,243,208,0.8)",boxShadow:"0 4px 16px rgba(16,185,129,0.08), 0 1px 0 rgba(255,255,255,0.8) inset"}}>
                <div>
                  <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
                    {activeRide.status === "heading_pickup" ? "যাত্রীর কাছে যাচ্ছেন" : "যাত্রা চলমান 🛺"}
                  </span>
                  <h4 className="font-bold text-lg text-slate-900 mt-0.5">{activeRide.passengerName}</h4>
                  <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                    📱 +91 {activeRide.passengerPhone?.replace(/\D/g, "").slice(-10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${activeRide.passengerPhone}`}
                    className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white shadow-md active:scale-95 transition-all"
                    title="যাত্রীকে ফোন করুন"
                  >
                    <Phone className="w-5 h-5 fill-white" />
                  </a>
                  <a
                    href={`https://wa.me/91${activeRide.passengerPhone?.replace(/\D/g, "").slice(-10)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-md active:scale-95 transition-all"
                    title="যাত্রীকে হোয়াটসঅ্যাপে মেসেজ করুন"
                  >
                    <MessageCircle className="w-5 h-5 fill-white" />
                  </a>
                </div>
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
                <div className="space-y-2.5">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs">
                    <span className="font-extrabold text-amber-900 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>যাত্রী গাড়িতে উঠলে ৪ সংখ্যার ওটিপি নিন</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                      ওটিপি বাধ্যতামূলক
                    </span>
                  </div>

                  <SwipeToConfirm
                    key="slider_start_journey"
                    label="➡️ স্লাইড করে ওটিপি দিন ও যাত্রা শুরু করুন"
                    confirmedLabel="ওটিপি লিখুন..."
                    colorScheme="blue"
                    onConfirm={async () => {
                      setStartOtpInput("");
                      setShowStartOtpModal(true);
                    }}
                  />

                  <Button
                    type="button"
                    onClick={() => {
                      setStartOtpInput("");
                      setShowStartOtpModal(true);
                    }}
                    variant="outline"
                    className="w-full h-11 rounded-2xl border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    <span>🔐 সরাসরি ওটিপি (OTP) দিন</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                    <span className="font-extrabold text-emerald-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                      যাত্রা শুরু হয়েছে ও চলমান 🛺
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      গন্তব্যে যাচ্ছেন
                    </span>
                  </div>

                  <SwipeToConfirm
                    key="slider_complete_journey"
                    label="➡️ স্লাইড করে ট্রিপ সমাপ্ত করুন"
                    confirmedLabel="ট্রিপ সমাপ্ত হয়েছে ✓"
                    colorScheme="emerald"
                    onConfirm={async () => {
                      try {
                        const res = await fetch("/api/bookings", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "complete",
                            bookingId: activeRide.id,
                            driverId: session?.driverId,
                            endCoords: driverLiveCoords || null,
                          }),
                        });
                        const data = await res.json();
                        const finalFare = data.booking?.final_fare || activeRide.fare || 50;
                        const distText = data.booking?.actual_distance_km ? ` (দূরত্ব: ${data.booking.actual_distance_km} কিমি)` : "";
                        playSuccessSound();
                        toast.success(`ট্রিপ সফলভাবে সমাপ্ত!${distText} নগদ ₹${finalFare}.00 সংগ্রহ করুন।`);
                      } catch {
                        playSuccessSound();
                        toast.success(`ট্রিপ সফলভাবে সমাপ্ত!`);
                      }
                      setActiveRide(null);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* SUNDARBAN RIDERS INCOMING RIDE MODAL SHEET (Light Theme)     */}
        {/* ------------------------------------------------------------- */}
        {incomingRide && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end animate-in slide-in-from-bottom duration-300" style={{background:"rgba(15,23,42,0.55)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
            <div className="rounded-t-3xl p-6 space-y-5 border-t border-white/20 max-h-[90dvh] overflow-y-auto overscroll-contain pb-8" style={{background:"rgba(255,255,255,0.97)",boxShadow:"0 -8px 40px rgba(0,0,0,0.18), 0 -1px 0 rgba(255,255,255,0.6) inset"}}>
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

                      const currentBooking = data?.booking || incomingRide;
                      setActiveRide({
                        ...incomingRide,
                        pickup: currentBooking.pickup_location || incomingRide.pickup,
                        drop: currentBooking.drop_location || incomingRide.drop,
                        pickupCoords: currentBooking.pickup_lat && currentBooking.pickup_lng
                          ? [Number(currentBooking.pickup_lat), Number(currentBooking.pickup_lng)]
                          : incomingRide.pickupCoords,
                        dropCoords: currentBooking.drop_lat && currentBooking.drop_lng
                          ? [Number(currentBooking.drop_lat), Number(currentBooking.drop_lng)]
                          : incomingRide.dropCoords,
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

        {/* MODAL: EMERGENCY SOS SAFETY SHIELD */}
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

              {/* View Disclaimers & Guidelines Link */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSosModal(false);
                    setShowDisclaimerViewer(true);
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>📜</span>
                    <span>নীতিমালা ও ব্যবহারের শর্তাবলী (Disclaimers)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600" />
                </button>
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

        <DisclaimerViewerModal
          isOpen={showDisclaimerViewer}
          onClose={() => setShowDisclaimerViewer(false)}
          defaultRole="rider"
        />

        {/* DRIVER START JOURNEY OTP MODAL */}
        {showStartOtpModal && activeRide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }}
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">রাইড শুরুর ওটিপি (OTP)</h3>
                    <p className="text-[11px] text-slate-500 font-medium">যাত্রীর থেকে ৪ সংখ্যার কোডটি নিন</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStartOtpModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>🔒 ওটিপি ছাড়া যাত্রা শুরু করা অসম্ভব</span>
                  </p>
                  <p className="text-[11px] text-amber-800 font-normal">
                    যাত্রী টোটোতে ওঠার পর তাঁর মোবাইল অ্যাপ বা হোয়াটসঅ্যাপে দেখানো ৪ সংখ্যার ওটিপিটি এখানে লিখুন।
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    ৪ ডিজিটের ওটিপি লিখুন:
                  </label>
                  <input
                    type="tel"
                    maxLength={4}
                    autoFocus
                    value={startOtpInput}
                    onChange={(e) => setStartOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="• • • •"
                    className="w-full h-14 text-center text-2xl font-black font-mono tracking-widest rounded-2xl border-2 border-slate-200 focus:border-amber-500 focus:outline-none bg-slate-50 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowStartOtpModal(false)}
                  className="flex-1 h-12 rounded-2xl font-bold text-xs border-slate-200 text-slate-700"
                >
                  বাতিল
                </Button>
                <Button
                  type="button"
                  disabled={startOtpInput.length < 4 || isVerifyingStartOtp}
                  onClick={handleVerifyAndStartJourney}
                  className="flex-1 h-12 rounded-2xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isVerifyingStartOtp ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>যাচাই ও শুরু করুন</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        </div>
      </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PASSENGER SEARCHING / UBER-STYLE RADAR SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "passenger_searching") {
    return (
      <MobileAppShell>
        <div className="min-h-full text-slate-900 flex flex-col justify-between select-none" style={{background:"linear-gradient(160deg, #f0fdf4 0%, #f8fafc 40%, #eff6ff 100%)"}}>
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
                    আশেপাশের অনলাইন টোটো চালকদের কাছে আপনার অনুরোধ পাঠানো হচ্ছে (৩ মিনিট অপেক্ষা)।
                  </p>
                </div>
              </div>

              {/* Progress Countdown Bar (3 min / 180s) */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-1000 rounded-full"
                  style={{ width: `${(searchCountdown / 180) * 100}%` }}
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                      👥 {passengerCount} যাত্রী
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
                <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-1 font-medium">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">দূরত্ব: {tripDistance} কিমি</span>
                    <span className="text-sm font-black text-emerald-700">₹{tripFare}.০০ (আনুমানিক)</span>
                  </div>
                  <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200 leading-relaxed">
                    ⚠️ এটি আনুমানিক ভাড়া। পিকআপ ও ড্রপের সঠিক অবস্থান এবং রোডের দূরত্বের উপর ভিত্তি করে চূড়ান্ত ভাড়া সামান্য কম বা বেশি হতে পারে।
                  </p>
                </div>
              </div>

                            {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 font-bold shadow-xs cursor-pointer"
                  onClick={() => {
                    setShowCancelModal(true);
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
                    setSearchCountdown(180);
                    playRideAlertSound();
                    toast.info("পুনরায় ৩ মিনিটের জন্য চালক খোঁজা হচ্ছে...");

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
                  className="w-full h-11 rounded-xl text-xs text-slate-700 border-slate-300 font-semibold bg-white cursor-pointer"
                  onClick={() => {
                    setShowCancelModal(true);
                  }}
                >
                  ❌ বুকিং বাতিল করুন
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileAppShell>
    );
  }

  // -------------------------------------------------------------
  // VIEW: POST-TRIP DIGITAL RECEIPT, RATING & COMPLAINTS SCREEN
  // -------------------------------------------------------------
  if (phase === "passenger_trip_completed") {
    return (
      <TripCompletionReceipt
        tripId={passengerBooking?.id || activeBookingId || ""}
        customerName={session?.passengerName || "যাত্রী বন্ধু"}
        customerPhone={session?.phone || ""}
        driverName={passengerBooking?.driverName || "টোটো চালক"}
        driverPhone={passengerBooking?.driverPhone || ""}
        totoNumber={passengerBooking?.totoNumber || ""}
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
    <MobileAppShell
      topHeader={
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
          onOpenDisclaimers={() => setShowDisclaimerViewer(true)}
        />
      }
      bottomNav={
        <MobileBottomNav
          activeTab={bottomNavTab}
          onTabChange={(t) => {
            if (t === "safety") setShowSosModal(true);
            else setBottomNavTab(t);
          }}
          role="passenger"
        />
      }
    >
      <div className="min-h-full flex-1 text-slate-900 flex flex-col select-none" style={{background:"linear-gradient(180deg,#f0fdf4 0%,#f8fafc 50%,#ffffff 100%)"}}>
        {/* Main Booking Interface */}
        <div className="p-4 sm:p-5 space-y-4 pb-4">
        {bottomNavTab === "map" ? (
          <div className="space-y-4 pb-4">
            {/* Active ride mini-banner when on map tab */}
            {passengerBooking && (
              <button
                type="button"
                onClick={() => setBottomNavTab("home")}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping shrink-0" />
                  <span>🛺 আপনার রাইড চলমান • লাইভ ট্র্যাকিংয়ে ফিরে যান</span>
                </div>
                <span className="text-[11px] font-mono bg-white/20 px-2 py-0.5 rounded-md">
                  #{passengerBooking.bookingNumber || passengerBooking.id?.slice(0, 6)} →
                </span>
              </button>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">লাইভ ম্যাপ ও নিকটবর্তী চালক</h3>
                <p className="text-xs text-slate-500">সুন্দরবন অঞ্চলের লাইভ রোড ম্যাপ ও সক্রিয় টোটো</p>
              </div>
              <button
                type="button"
                onClick={() => setBottomNavTab("home")}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs cursor-pointer"
              >
                ← {passengerBooking ? "চলমান ট্র্যাকিং" : "রাইড বুকিং"}
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
          </div>
        ) : bottomNavTab === "trips" ? (
          <div className="space-y-4 pb-4">
            {/* Active ride mini-banner when on trips history tab */}
            {passengerBooking && (
              <button
                type="button"
                onClick={() => setBottomNavTab("home")}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold text-xs flex items-center justify-between shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping shrink-0" />
                  <span>🛺 আপনার রাইড চলমান • লাইভ ট্র্যাকিংয়ে ফিরে যান</span>
                </div>
                <span className="text-[11px] font-mono bg-white/20 px-2 py-0.5 rounded-md">
                  #{passengerBooking.bookingNumber || passengerBooking.id?.slice(0, 6)} →
                </span>
              </button>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">
                  আমার রাইড হিস্ট্রি {customerHistory.length > 0 && `(${customerHistory.length})`}
                </h3>
                <p className="text-xs text-slate-500">পূর্ববর্তী সম্পূর্ণ ট্রিপ ও ডিজিটাল রসিদ</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchCustomerHistory}
                  disabled={isLoadingHistory}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  title="হিস্ট্রি রিফ্রেশ করুন"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                  <span>রিফ্রেশ</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl border border-rose-200 shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                  title="লগআউট করুন"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>লগআউট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBottomNavTab("home")}
                  className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 shadow-xs cursor-pointer"
                >
                  ← {passengerBooking ? "চলমান ট্র্যাকিং" : "নতুন রাইড"}
                </button>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-500 font-semibold">হিস্ট্রি লোড হচ্ছে...</p>
              </div>
            ) : customerHistory.length === 0 ? (
              <div className="bg-white/95 rounded-3xl p-6 border border-slate-200 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
                  🛺
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">আপনার কোনো পূর্ববর্তী রাইড নেই</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    সুন্দরবন স্মার্ট টোটো দিয়ে আপনার প্রথম নিরাপদ যাত্রা শুরু করুন!
                  </p>
                </div>
                <Button
                  onClick={() => setBottomNavTab("home")}
                  className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  এখনই রাইড বুক করুন →
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {customerHistory.map((trip: any, idx: number) => {
                  const isCompleted = trip.status === "completed";
                  const isCancelled = trip.status === "cancelled";
                  const dateStr = trip.created_at
                    ? new Date(trip.created_at).toLocaleDateString("bn-BD", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "আজকের ট্রিপ";

                  return (
                    <div
                      key={trip.id || idx}
                      className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-2.5 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm">
                            🛺
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900">
                              #{trip.booking_number || trip.id?.slice(0, 8)}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-medium">{dateStr}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isCancelled
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isCompleted ? "সম্পূর্ণ ✓" : isCancelled ? "বাতিল ✕" : "চলমান 🟢"}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 text-slate-600">
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                          <p className="line-clamp-1">
                            পিকআপ: <strong className="text-slate-800">{trip.pickup_location || trip.pickup_name || "পিকআপ পয়েন্ট"}</strong>
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
                          <p className="line-clamp-1">
                            গন্তব্য: <strong className="text-slate-800">{trip.drop_location || trip.drop_name || "গন্তব্য পয়েন্ট"}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="font-black text-sm text-slate-900">
                          ₹{trip.final_fare || trip.estimated_fare || 20}.০০
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPickupText(trip.pickup_location);
                            setDropText(trip.drop_location);
                            setBottomNavTab("home");
                            toast.success("ট্রিপের তথ্য লোড হয়েছে! এবার কনফার্ম করুন");
                          }}
                          className="h-8 text-[11px] font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer"
                        >
                          🔄 পুনরায় বুক করুন
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {!passengerBooking && (
              <div className="space-y-3">
                {isCustomerBlocked || customerStrikes >= 3 ? (
                  <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 shadow-sm space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                        <span className="text-base">🚫</span>
                        <span>অ্যাকাউন্ট সাময়িকভাবে স্থগিত (Blocked)</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-red-200 text-red-900 px-2 py-0.5 rounded-md">
                        ৩/৩ বাতিল
                      </span>
                    </div>
                    <p className="text-xs text-red-700 font-medium leading-relaxed">
                      ৩ বার বুকিং বাতিল করায় আপনার নম্বরটি সাময়িকভাবে স্থগিত করা হয়েছে। নতুন কোনো রাইড বুক করা যাবে না।
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <a
                        href="tel:9593177885"
                        className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 fill-white" />
                        <span>📞 হেল্পলাইনে কল করুন (9593177885)</span>
                      </a>
                    </div>
                  </div>
                ) : customerStrikes > 0 ? (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold">
                        বাতিলকরণ সতর্কতা: ৩ বার বাতিল করলে অ্যাকাউন্ট ব্লক হবে
                      </span>
                    </div>
                    <span className="font-mono font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md shrink-0">
                      {customerStrikes}/3
                    </span>
                  </div>
                ) : null}

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">টোটো রাইড বুক করুন</h2>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">
                    পিকআপ স্বয়ংক্রিয় জিপিএস এবং ম্যাপে লাল পিন টেনে গন্তব্য নির্বাচন করুন।
                  </p>
                </div>
              </div>
            )}

            {passengerBooking ? (
              <LiveRideTrackingMap
                booking={{
                  id: passengerBooking.id,
                  driverName: passengerBooking.driverName || "টোটো চালক",
                  driverPhone: passengerBooking.driverPhone || "",
                  totoNumber: passengerBooking.uniqueId || passengerBooking.totoNumber || "",
                  startOtp: passengerBooking.startOtp || passengerBooking.start_otp || ((passengerBooking.bookingNumber || passengerBooking.id || "").replace(/\D/g, "").slice(-4) || "5821"),
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
          <div className="space-y-4 pb-2">
            <InteractiveBookingMap
              initialPickup={pickupText}
              initialDrop={dropText}
              onRouteSelected={handleRouteSelected}
              onConfirmBooking={handleConfirmBooking}
              isBlocked={isCustomerBlocked || customerStrikes >= 3}
            />
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

              {/* View Disclaimers & Guidelines Link */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSosModal(false);
                    setShowDisclaimerViewer(true);
                  }}
                  className="w-full p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>📜</span>
                    <span>নীতিমালা ও ব্যবহারের শর্তাবলী (Disclaimers)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600" />
                </button>
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
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 3-Strike Cancellation Policy Warning Card */}
            <div
              className={`p-3.5 rounded-2xl border space-y-1.5 ${
                customerStrikes >= 2
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ৩-বার বাতিলকরণ নীতি (3-Strike Rule)
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                    customerStrikes >= 2
                      ? "bg-red-200 text-red-800 border border-red-300"
                      : "bg-amber-200 text-amber-900 border border-amber-300"
                  }`}
                >
                  {customerStrikes}/3 বাতিল
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90 font-medium">
                পর পর ৩ বার বুকিং বাতিল করলে সুন্দরবন রাইডার্সে আপনার নম্বর সাময়িকভাবে স্থগিত (Blocked) করা হবে।
              </p>
              {customerStrikes === 2 && (
                <div className="text-[10px] font-bold text-red-700 bg-red-100/90 p-1.5 rounded-lg border border-red-200">
                  🚨 চূড়ান্ত সতর্কতা: এটি আপনার শেষ সুযোগ! এবার বাতিল করলে অ্যাকাউন্ট স্থগিত হবে।
                </div>
              )}
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
                    const bId = activeBookingId || passengerBooking?.id;
                    let newCancels = customerStrikes + 1;
                    let isBlocked = newCancels >= 3;

                    if (bId) {
                      try {
                        const apiUrl = "/api/bookings";
                        const res = await fetch(apiUrl, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "cancel",
                            bookingId: bId,
                            cancelReason: reason,
                          }),
                        });
                        const resData = await res.json();
                        if (resData.cancellation_count !== undefined) {
                          newCancels = resData.cancellation_count;
                        }
                        if (resData.is_blocked !== undefined) {
                          isBlocked = Boolean(resData.is_blocked || newCancels >= 3);
                        }
                      } catch {}
                    }

                    setCustomerStrikes(newCancels);
                    setIsCustomerBlocked(isBlocked);
                    setPassengerBooking(null);
                    setActiveBookingId(null);
                    setShowCancelModal(false);
                    setPhase("passenger_home");

                    if (isBlocked) {
                      toast.error(
                        `🚫 সতর্কবার্তা: ৩ বার বাতিল করায় আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে! (বাতিল: ${newCancels}/3)`,
                        { duration: 6000 }
                      );
                    } else {
                      toast.warning(
                        `⚠️ রাইড বাতিল করা হয়েছে (${reason})। বর্তমান স্ট্রাইক: ${newCancels}/3 (৩ বার বাতিল হলে অ্যাকাউন্ট স্থগিত হবে)।`,
                        { duration: 5000 }
                      );
                    }
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
              className="w-full text-xs text-slate-500 h-9 font-medium hover:bg-slate-100"
            >
              বাতিল করবেন না, রাইড চালিয়ে যান
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: IN-APP DISCLAIMERS & POLICIES VIEWER                   */}
      {/* ------------------------------------------------------------- */}
      <DisclaimerViewerModal
        isOpen={showDisclaimerViewer}
        onClose={() => setShowDisclaimerViewer(false)}
        defaultRole="passenger"
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
