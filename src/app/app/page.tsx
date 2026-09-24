"use client";

import { useState, useEffect, useRef } from "react";
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
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SwipeToConfirm } from "@/components/mobile/swipe-to-confirm";
import { playRideAlertSound, playSuccessSound } from "@/lib/mobile/sound";
import { InteractiveBookingMap } from "@/components/mobile/interactive-booking-map";
import { NearbyRidersRadarMap } from "@/components/mobile/nearby-riders-radar-map";
import { TripCompletionReceipt } from "@/components/mobile/trip-completion-receipt";

interface MobileSession {
  phone: string;
  role: "rider" | "passenger";
  driverId?: string;
  driverName?: string;
  totoNumber?: string;
  isApproved?: boolean;
  passengerName?: string;
}

export default function MobileAppPage() {
  // App Phase: 'splash' | 'permissions' | 'select_role' | 'otp_login' | 'kyc_form' | 'kyc_pending' | 'rider_home' | 'passenger_home'
  const [phase, setPhase] = useState<string>("splash");
  const [role, setRole] = useState<"rider" | "passenger">("rider");
  const [session, setSession] = useState<MobileSession | null>(null);

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
  const [pickupText, setPickupText] = useState("কাকদ্বীপ স্টেশন রোড");
  const [dropText, setDropText] = useState("লট ৮ ফেরিঘাট (হারউড পয়েন্ট)");
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([21.8760, 88.1920]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([21.8680, 88.1630]);
  const [tripDistance, setTripDistance] = useState(3.5);
  const [tripFare, setTripFare] = useState(55);
  const [searchStatus, setSearchStatus] = useState<"searching" | "unaccepted" | "accepted">("searching");
  const [searchCountdown, setSearchCountdown] = useState(300); // 5 minutes search duration
  const [passengerBooking, setPassengerBooking] = useState<any | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const declinedBookingIdsRef = useRef<Set<string>>(new Set());

  // Permissions state
  const [permissionsGranted, setPermissionsGranted] = useState(false);

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

  // 1. Session Persistence Check on Load
  useEffect(() => {
    const saved = localStorage.getItem("sr_mobile_session");
    const perms = localStorage.getItem("sr_permissions_granted");

    const timer = setTimeout(() => {
      if (perms) {
        setPermissionsGranted(true);
      }

      if (saved) {
        try {
          const parsed = JSON.parse(saved) as MobileSession;
          setSession(parsed);
          setRole(parsed.role);
          if (parsed.role === "rider") {
            if (parsed.isApproved === false) {
              setPhase("kyc_pending");
            } else {
              setPhase("rider_home");
            }
          } else {
            setPhase("passenger_home");
          }
          return;
        } catch {
          // fallback
        }
      }

      if (!perms) {
        setPhase("permissions");
      } else {
        setPhase("select_role");
      }
    }, 1200);

    return () => clearTimeout(timer);
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
              // Booking was took by another rider or cancelled! Popup immediately dismisses.
              setIncomingRide(null);
              toast.info("এই রাইডটি অন্য একজন চালক গ্রহণ করেছেন বা বাতিল হয়েছে।");
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
              });
            }
          }
        } catch {
          // Ignore transient network errors
        }
      };

      // Check immediately and then every 2.5 seconds
      checkPendingBookings();
      pollInterval = setInterval(checkPendingBookings, 2500);
    }

    return () => clearInterval(pollInterval);
  }, [phase, isOnline, incomingRide, activeRide]);

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
    setPhase("select_role");
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
  // VIEW: SPLASH SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "splash") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-white border border-emerald-200 flex items-center justify-center shadow-xl shadow-emerald-500/10">
            <Car className="w-12 h-12 text-emerald-600" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-500 animate-bounce" />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900">
          সুন্দরবন রাইডার
        </h1>
        <p className="text-emerald-700 text-xs font-bold uppercase tracking-widest mt-1">
          Smart Toto Mobility • 24x7
        </p>
        <div className="mt-12 flex items-center gap-2 text-slate-400 text-xs font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          <span>লোড হচ্ছে...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PERMISSIONS ONBOARDING SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "permissions") {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between p-6">
        <div className="pt-6 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              অ্যাপের প্রয়োজনীয় অনুমতি
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              উবার বা র‍্যাপিডোর মতো সঠিক পরিষেবা নিশ্চিত করতে নিচের অনুমতিগুলো গ্রহণ করা আবশ্যক:
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0 border border-blue-100">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">জিপিএস লোকেশন (GPS)</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  নিকটস্থ ৫ কিমির মধ্যে বুকিং প্রদান ও ম্যাপের লাইভ রুট নির্দেশনার জন্য।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0 border border-purple-100">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">পুশ নোটিফিকেশন</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  অ্যাপ ব্যাকগ্রাউন্ডে থাকলেও নতুন রাইড ও স্ট্যাটাসের তাৎক্ষণিক অ্যালার্ট পেতে।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0 border border-amber-100">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">অডিও ও ভাইব্রেশন</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  রাইড আসার সাথে সাথে উচ্চশব্দে রিংটোন বেজে ওঠা ও ভাইব্রেশন নিশ্চিত করতে।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-100">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">স্ক্রিন ওয়েক-লক</h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  মোবাইল স্লিপ বা লক থাকলেও নতুন বুকিং আসার সাথে সাথে স্ক্রিন অন হতে।
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pb-4">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20"
            onClick={handleGrantPermissions}
          >
            অনুমতি নিশ্চিত করুন ও এগিয়ে যান
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: ROLE SELECTOR SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "select_role") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-6">
        <div className="pt-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-md">
            <Car className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            সুন্দরবন রাইডারে স্বাগতম
          </h2>
          <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto font-medium">
            আপনি কীভাবে সুন্দরবন রাইডার ব্যবহার করতে চান?
          </p>

          <div className="mt-8 space-y-4">
            {/* Rider Card */}
            <button
              onClick={() => {
                setRole("rider");
                setPhase("otp_login");
              }}
              className="w-full p-5 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-500 text-left transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                  <Car className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">🛺 টোটো চালক (Rider)</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    রাইড গ্রহণ করুন, দৈনিক আয় বাড়ান ও স্মার্ট ড্রাইভার হন।
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-emerald-600 shrink-0" />
            </button>

            {/* Passenger Card */}
            <button
              onClick={() => {
                setRole("passenger");
                setPhase("otp_login");
              }}
              className="w-full p-5 rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-500 text-left transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">👤 সাধারণ যাত্রী (Passenger)</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    মাত্র ৫ মিনিটে টোটো বুকিং করুন ও নিরাপদ ভ্রমণ নিশ্চিত করুন।
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-blue-600 shrink-0" />
            </button>
          </div>
        </div>

        <div className="text-center pb-4 text-xs text-slate-400 font-medium">
          সুন্দরবন রাইডার • ২৪x৭ নিরাপদ পরিবহন
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: WHATSAPP OTP LOGIN SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "otp_login") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-6">
        <div className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPhase("select_role")}
              className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1"
            >
              ← ফিরে যান
            </button>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                role === "rider"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}
            >
              {role === "rider" ? "🛺 চালক লগইন" : "👤 যাত্রী লগইন"}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              WhatsApp OTP দিয়ে লগইন
            </h2>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              আপনার ফোন নম্বরে কোনো SMS চার্জ ছাড়াই সরাসরি হোয়াটসঅ্যাপে কোড যাবে।
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

        <div className="space-y-3 pb-4">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-slate-300 text-slate-700 font-semibold bg-white"
            onClick={handleSwitchRole}
          >
            👤 যাত্রী হিসেবে টোটো বুক করতে চান?
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs text-slate-500"
            onClick={handleLogout}
          >
            লগআউট করুন
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: RIDER HOME / DASHBOARD (Uber/Rapido Flow in Light Theme)
  // -------------------------------------------------------------
  if (phase === "rider_home") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between relative overflow-hidden select-none">
        {/* Header Bar */}
        <div className="p-4 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-black text-xl shadow-sm">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-slate-900">{session?.driverName || "চালকের ড্যাশবোর্ড"}</h3>
                <span className="flex items-center text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <Star className="w-2.5 h-2.5 fill-amber-500 mr-0.5" /> 5.0
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 font-semibold">{session?.totoNumber || "WB-96-T-8421"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switch to Passenger Mode */}
            <button
              onClick={handleSwitchRole}
              title="যাত্রী মোডে যান"
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1 hover:bg-blue-100 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">যাত্রী মোড</span>
            </button>

            {/* Online / Offline Toggle */}
            <button
              onClick={() => {
                setIsOnline(!isOnline);
                playSuccessSound();
                toast.success(!isOnline ? "আপনি এখন অনলাইন আছেন 🟢" : "আপনি এখন অফলাইন আছেন 🔴");
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                isOnline
                  ? "bg-emerald-600 text-white shadow-emerald-600/20"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-red-500"}`} />
              {isOnline ? "অনলাইন" : "অফলাইন"}
            </button>
          </div>
        </div>

        {/* Radar & Status Area (When Idle) */}
        {!incomingRide && !activeRide && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
            {isOnline ? (
              <div className="space-y-4">
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping" />
                  <div className="absolute inset-4 rounded-full bg-emerald-200/60 animate-pulse" />
                  <div className="w-20 h-20 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/10">
                    🛺
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">নতুন রাইডের খোঁজ চলছে...</h3>
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    📍 ৫ কিমি রেডিয়াসের মধ্যে যাত্রী বুকিং করলেই অ্যালার্ট পাবেন
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl mx-auto text-slate-400 shadow-sm">
                  ⚪
                </div>
                <h3 className="text-lg font-bold text-slate-700">আপনি অফলাইনে আছেন</h3>
                <p className="text-xs text-slate-500 max-w-xs font-medium">
                  রাইড গ্রহণ শুরু করতে উপরের 'অনলাইন' বোতামে চাপ দিন।
                </p>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
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
          <div className="flex-1 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-sm">
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

              {/* Route Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
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

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeRide.pickup)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 mt-2 hover:bg-blue-100 transition-colors"
                >
                  <Navigation className="w-4 h-4 text-blue-600" />
                  গুগল ম্যাপে দিকনির্দেশনা দেখুন
                </a>
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
        {/* UBER / RAPIDO STYLE INCOMING RIDE MODAL SHEET (Light Theme)  */}
        {/* ------------------------------------------------------------- */}
        {incomingRide && (
          <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex flex-col justify-end p-4 animate-in slide-in-from-bottom duration-300">
            <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl space-y-6">
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
                      if (!res.ok || data.error === "booking_already_taken") {
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
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PASSENGER SEARCHING / UBER-STYLE RADAR SCREEN (Light Theme)
  // -------------------------------------------------------------
  if (phase === "passenger_searching") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between select-none">
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
        <div className="flex-1 p-4 flex flex-col space-y-4">
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
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
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
                  <span className="text-sm font-black text-emerald-600">₹{tripFare}.00 নগদ ভাড়া</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 font-bold"
                  onClick={() => {
                    setPhase("passenger_home");
                    toast.info("অনুসন্ধান বাতিল করা হয়েছে");
                  }}
                >
                  ❌ রিকোয়েস্ট বাতিল
                </Button>

                <Button
                  size="sm"
                  className="h-11 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
                  onClick={() => {
                    // Test acceptance demo
                    setPassengerBooking({
                      id: "SR-9412",
                      driverName: "রাজেশ মন্ডল",
                      driverPhone: "9593177885",
                      totoNumber: "WB-96-T-8421",
                    });
                    setPhase("passenger_home");
                    playSuccessSound();
                    toast.success("চালক রাইড গ্রহণ করেছেন!");
                  }}
                >
                  ⚡ ডেমো: চালক গ্রহণ করল
                </Button>
              </div>
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

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-xs text-slate-700 border-slate-300 font-semibold bg-white"
                    onClick={() => {
                      setPhase("passenger_home");
                      setSearchStatus("searching");
                      toast.info("বুকিং উইন্ডোতে ফিরে গেছেন");
                    }}
                  >
                    ❌ বুকিং বাতিল করুন
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-xs text-blue-700 border-blue-200 font-bold bg-blue-50 hover:bg-blue-100"
                    onClick={() => {
                      setPassengerBooking({
                        id: "SR-9412",
                        driverName: "রাজেশ মন্ডল",
                        driverPhone: "9593177885",
                        totoNumber: "WB-96-T-8421",
                      });
                      setPhase("passenger_home");
                      playSuccessSound();
                      toast.success("চালক রাইড গ্রহণ করেছেন!");
                    }}
                  >
                    ⚡ চালক গ্রহণ ডেমো
                  </Button>
                </div>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between select-none">
      {/* Passenger Header */}
      <div className="p-4 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shadow-sm">
            👤
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">{session?.passengerName || "যাত্রী পোর্টাল"}</h3>
            <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              টোটো বুকিং ২৪x৭ প্রস্তুত
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Switch to Rider Mode */}
          <button
            onClick={handleSwitchRole}
            title="চালক মোডে যান"
            className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1 hover:bg-emerald-100 transition-colors"
          >
            <Car className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">চালক মোড</span>
          </button>

          <button
            onClick={handleLogout}
            title="লগআউট"
            className="p-2 text-slate-500 hover:text-slate-900"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Booking Interface */}
      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">টোটো রাইড বুক করুন</h2>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">
            পিকআপ স্বয়ংক্রিয় জিপিএস এবং ম্যাপে লাল পিন টেনে গন্তব্য নির্বাচন করুন।
          </p>
        </div>

        {/* Live Interactive Map with GPS Auto-Fetch & Draggable Red Drop Pin */}
        <InteractiveBookingMap
          initialPickup={pickupText}
          initialDrop={dropText}
          onRouteSelected={(route) => {
            setPickupText(route.pickup);
            setDropText(route.drop);
            setPickupCoords(route.pickupCoords);
            setDropCoords(route.dropCoords);
            setTripDistance(route.distanceKm);
            setTripFare(route.estimatedFare);
          }}
        />

        {/* Confirmed Ride Status Card (If Booked) */}
        {passengerBooking && (
          <div className="p-5 rounded-3xl bg-emerald-50 border-2 border-emerald-300 space-y-4 animate-in slide-in-from-bottom shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900">রাইড নিশ্চিত হয়েছে!</span>
              </div>
              <span className="text-xs text-emerald-800 font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                #SR-9412
              </span>
            </div>

            {/* 4-Digit Ride PIN for Passenger Security (Uber-Style) */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-emerald-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  যাত্রা শুরুর সিকিউরিটি পিন (OTP)
                </span>
                <span className="text-xl font-black text-emerald-600 tracking-widest font-mono">
                  ৪ ৮ ২ ১
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium text-right max-w-[130px]">
                চালক গাড়িতে উঠলে এই পিনটি বলবেন
              </span>
            </div>

            {/* Driver Profile Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center text-xl shadow-sm">
                    🛺
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{passengerBooking.driverName || "রাজেশ মন্ডল"}</h4>
                    <span className="font-mono font-bold text-emerald-700">{passengerBooking.totoNumber || "WB-96-T-8421"}</span>
                  </div>
                </div>

                <a
                  href={`tel:${passengerBooking.driverPhone || "9593177885"}`}
                  className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
                  title="চালকের সাথে কথা বলুন"
                >
                  <Phone className="w-5 h-5 fill-white" />
                </a>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600 font-medium">
                <span>নগদ ভাড়া পরিশোধ:</span>
                <span className="font-black text-slate-900 text-sm">₹{tripFare}.০০</span>
              </div>
            </div>

            {/* Finish Trip & Go to Receipt */}
            <div className="space-y-2 pt-1">
              <Button
                size="lg"
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                onClick={() => {
                  setPhase("passenger_trip_completed");
                  playSuccessSound();
                  toast.success("ট্রিপ সফলভাবে সমাপ্ত হয়েছে! ডিজিটাল রসিদ প্রস্তুত।");
                }}
              >
                <span>🏁 ট্রিপ সমাপ্ত ও রসিদ দেখুন</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-9 font-semibold"
                onClick={() => {
                  setPassengerBooking(null);
                  toast.info("বুকিং বাতিল করা হয়েছে");
                }}
              >
                বুকিং বাতিল করুন
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Book Button */}
      {!passengerBooking && (
        <div className="p-4 pb-6">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-600/20"
            onClick={async () => {
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
            🛺 টোটো রাইড কনফার্ম করুন (₹{tripFare}.০০)
          </Button>
        </div>
      )}
    </div>
  );
}
