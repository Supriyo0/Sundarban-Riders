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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SwipeToConfirm } from "@/components/mobile/swipe-to-confirm";
import { playRideAlertSound, playSuccessSound } from "@/lib/mobile/sound";

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
  const [kycBlock, setKycBlock] = useState("গোসাবা");
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
  const [pickupText, setPickupText] = useState("গোসাবা ফেরিঘাট");
  const [dropText, setDropText] = useState("পাখিরালা বাজার");
  const [passengerBooking, setPassengerBooking] = useState<any | null>(null);
  const [findingDrivers, setFindingDrivers] = useState(false);

  // Permissions state
  const [permissionsGranted, setPermissionsGranted] = useState(false);

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
    }, 1500);

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

  // Simulated live demo incoming ride for online driver (after 6 seconds of going online)
  useEffect(() => {
    if (phase === "rider_home" && isOnline && !incomingRide && !activeRide) {
      const demoTimer = setTimeout(() => {
        setAlertCountdown(30);
        setIncomingRide({
          id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
          fare: 50,
          passengerName: "রমেশ দাস",
          passengerRating: 4.9,
          passengerPhone: "918348122122",
          pickup: "গোসাবা ফেরিঘাট",
          pickupDistance: "১.২ কিমি দূরে",
          drop: "পাখিরালা বাজার",
          tripDistance: "৪.৫ কিমি ট্রিপ",
        });
      }, 7000);

      return () => clearTimeout(demoTimer);
    }
  }, [phase, isOnline, incomingRide, activeRide]);

  // Handle Permissions
  const handleGrantPermissions = () => {
    localStorage.setItem("sr_permissions_granted", "true");
    setPermissionsGranted(true);
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
  // VIEW: SPLASH SCREEN
  // -------------------------------------------------------------
  if (phase === "splash") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-black text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-2xl animate-pulse">
            <Car className="w-12 h-12 text-emerald-400" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-spin" />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight text-white">
          সুন্দরবন রাইডার
        </h1>
        <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mt-1">
          Smart Toto Mobility • 24x7
        </p>
        <div className="mt-12 flex items-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
          <span>লোড হচ্ছে...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: PERMISSIONS ONBOARDING SCREEN
  // -------------------------------------------------------------
  if (phase === "permissions") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
        <div className="pt-6 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              অ্যাপের প্রয়োজনীয় অনুমতি
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              উবার বা র‍্যাপিডোর মতো সঠিক পরিষেবা নিশ্চিত করতে নিচের অনুমতিগুলো গ্রহণ করা আবশ্যক:
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">জিপিএস লোকেশন (GPS)</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  নিকটস্থ ৫ কিমির মধ্যে বুকিং প্রদান ও ম্যাপের লাইভ রুট নির্দেশনার জন্য।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">পুশ নোটিফিকেশন</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  অ্যাপ ব্যাকগ্রাউন্ডে থাকলেও নতুন রাইড ও স্ট্যাটাসের তাৎক্ষণিক অ্যালার্ট পেতে।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">অডিও ও ভাইব্রেশন</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  রাইড আসার সাথে সাথে উচ্চশব্দে রিংটোন বেজে ওঠা ও ভাইব্রেশন নিশ্চিত করতে।
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">স্ক্রিন ওয়েক-লক</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  মোবাইল স্লিপ বা লক থাকলেও নতুন বুকিং আসার সাথে সাথে স্ক্রিন অন হতে।
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pb-4">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-950"
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
  // VIEW: ROLE SELECTOR SCREEN
  // -------------------------------------------------------------
  if (phase === "select_role") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
        <div className="pt-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
            <Car className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            সুন্দরবন রাইডারে স্বাগতম
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
            আপনি কীভাবে সুন্দরবন রাইডার ব্যবহার করতে চান?
          </p>

          <div className="mt-8 space-y-4">
            {/* Rider Card */}
            <button
              onClick={() => {
                setRole("rider");
                setPhase("otp_login");
              }}
              className="w-full p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 text-left transition-all active:scale-[0.98] shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
                  <Car className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">🛺 টোটো চালক (Rider)</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    রাইড গ্রহণ করুন, দৈনিক আয় বাড়ান ও স্মার্ট ড্রাইভার হন।
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-emerald-400 shrink-0" />
            </button>

            {/* Passenger Card */}
            <button
              onClick={() => {
                setRole("passenger");
                setPhase("otp_login");
              }}
              className="w-full p-5 rounded-2xl bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/30 hover:border-blue-400 text-left transition-all active:scale-[0.98] shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">👤 সাধারণ যাত্রী (Passenger)</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    মাত্র ৫ মিনিটে টোটো বুকিং করুন ও নিরাপদ ভ্রমণ নিশ্চিত করুন।
                  </p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-blue-400 shrink-0" />
            </button>
          </div>
        </div>

        <div className="text-center pb-4 text-xs text-slate-500">
          সুন্দরবন রাইডার • ২৪x৭ নিরাপদ যোগাযোগ
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: WHATSAPP OTP LOGIN SCREEN
  // -------------------------------------------------------------
  if (phase === "otp_login") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
        <div className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPhase("select_role")}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              ← ফিরে যান
            </button>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                role === "rider"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              }`}
            >
              {role === "rider" ? "🛺 চালক লগইন" : "👤 যাত্রী লগইন"}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              WhatsApp OTP দিয়ে লগইন
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              আপনার ফোন নম্বরে কোনো SMS চার্জ ছাড়াই সরাসরি হোয়াটসঅ্যাপে কোড যাবে।
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-slate-300">হোয়াটসঅ্যাপ মোবাইল নম্বর</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={phoneInput}
                  disabled={otpSent}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="h-14 pl-14 bg-slate-900 border-slate-800 text-white text-lg font-bold rounded-2xl tracking-wider"
                />
              </div>
            </div>

            {otpSent && (
              <div className="space-y-2 pt-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-300">৪ সংখ্যার OTP কোড</Label>
                  <span className="text-xs text-emerald-400 font-mono">
                    {otpTimer > 0 ? `পুনরায় পাঠাতে: ${otpTimer}s` : ""}
                  </span>
                </div>
                <Input
                  type="text"
                  maxLength={4}
                  placeholder="• • • •"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-16 text-center text-2xl font-black tracking-[1em] bg-slate-900 border-emerald-500/40 text-emerald-400 rounded-2xl"
                />

                {otpTimer === 0 && (
                  <button
                    onClick={handleSendOtp}
                    className="text-xs text-emerald-400 hover:underline pt-1 block"
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
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg"
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
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg"
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
  // VIEW: DRIVER KYC ONBOARDING FORM
  // -------------------------------------------------------------
  if (phase === "kyc_form") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 pb-12 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              নতুন চালক নিবন্ধন
            </span>
            <span className="text-xs text-slate-400 font-mono">+91 {phoneInput}</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              চালক তথ্য ও ডকুমেন্ট সাবমিট
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              যাচাইকরণের জন্য সঠিক তথ্য ও আধার কার্ডের পরিষ্কার ছবি সংযুক্ত করুন।
            </p>
          </div>

          <form onSubmit={handleKycSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">পূর্ণ নাম *</Label>
              <Input
                placeholder="যেমন: রাজেশ মন্ডল"
                value={kycName}
                onChange={(e) => setKycName(e.target.value)}
                className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">ইমেইল ঠিকানা (অনুমোদনপত্রের জন্য)</Label>
              <Input
                type="email"
                placeholder="example@gmail.com"
                value={kycEmail}
                onChange={(e) => setKycEmail(e.target.value)}
                className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">জেলা *</Label>
                <Input
                  value={kycDistrict}
                  onChange={(e) => setKycDistrict(e.target.value)}
                  className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">ব্লক *</Label>
                <Input
                  value={kycBlock}
                  onChange={(e) => setKycBlock(e.target.value)}
                  className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">টোটো রেজিস্ট্রেশন নম্বর *</Label>
              <Input
                placeholder="যেমন: WB-96-T-8421"
                value={kycTotoNumber}
                onChange={(e) => setKycTotoNumber(e.target.value)}
                className="h-12 bg-slate-900 border-slate-800 text-white font-mono rounded-xl uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">আধার কার্ড নম্বর (১২ সংখ্যা) *</Label>
              <Input
                placeholder="XXXX XXXX XXXX"
                maxLength={12}
                value={kycAadharNumber}
                onChange={(e) => setKycAadharNumber(e.target.value.replace(/\D/g, ""))}
                className="h-12 bg-slate-900 border-slate-800 text-white font-mono rounded-xl"
              />
            </div>

            {/* Document Upload Simulation */}
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <div>
                    <h5 className="text-xs font-bold text-white">আধার কার্ড ছবি *</h5>
                    <p className="text-[10px] text-slate-400">সামনে ও পেছনের স্পষ্ট ছবি</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-700"
                  onClick={() => {
                    setKycAadharDoc("https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop");
                    toast.success("আধার কার্ড সফলভাবে সংযুক্ত হয়েছে");
                  }}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {kycAadharDoc ? "যুক্ত হয়েছে ✓" : "আপলোড"}
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <div>
                    <h5 className="text-xs font-bold text-white">২য় ডকুমেন্ট (লাইসেন্স/ভোটার) *</h5>
                    <p className="text-[10px] text-slate-400">ড্রাইভিং লাইসেন্স বা ভোটার আইডি</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-700"
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
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg mt-4"
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
  // VIEW: KYC PENDING APPROVAL SCREEN
  // -------------------------------------------------------------
  if (phase === "kyc_pending") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 text-center">
        <div className="pt-16 space-y-6">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto animate-pulse">
            <Clock className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              আবেদন অনুমোদনের অপেক্ষায়
            </h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              নমস্কার {session?.driverName || "চালক বন্ধু"}! আপনার চালক আবেদন ও আধার ডকুমেন্টস সফলভাবে জমা হয়েছে।
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left space-y-2 max-w-xs mx-auto text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">টোটো নম্বর:</span>
              <span className="font-mono font-bold text-white">{session?.totoNumber || "WB-96-T-XXXX"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">স্ট্যাটাস:</span>
              <span className="text-amber-400 font-bold">ভেরিফিকেশন চলছে</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              অ্যাডমিন অনুমোদন করার সাথে সাথে আপনি WhatsApp ও ইমেইলে কনফার্মেশন পাবেন এবং এই স্ক্রিন স্বয়ংক্রিয়ভাবে খুলে যাবে।
            </p>
          </div>
        </div>

        <div className="space-y-3 pb-4">
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-slate-800 text-slate-300"
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
  // VIEW: RIDER HOME / DASHBOARD (Uber/Rapido Flow)
  // -------------------------------------------------------------
  if (phase === "rider_home") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden select-none">
        {/* Header Bar */}
        <div className="p-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black">
              🛺
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">{session?.driverName || "চালকের ড্যাশবোর্ড"}</h3>
                <span className="flex items-center text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded">
                  <Star className="w-2.5 h-2.5 fill-amber-400 mr-0.5" /> 5.0
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">{session?.totoNumber || "WB-96-T-8421"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switch to Passenger Mode */}
            <button
              onClick={handleSwitchRole}
              title="যাত্রী মোডে যান"
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                isOnline
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
                  : "bg-red-500/20 text-red-400 border border-red-500/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-slate-950 animate-ping" : "bg-red-500"}`} />
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
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
                  <div className="absolute inset-4 rounded-full bg-emerald-500/20 animate-pulse" />
                  <div className="w-20 h-20 rounded-full bg-emerald-500/30 border-2 border-emerald-400 flex items-center justify-center text-3xl shadow-xl shadow-emerald-950">
                    🛺
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">নতুন রাইডের খোঁজ চলছে...</h3>
                  <p className="text-xs text-emerald-400 font-medium mt-1">
                    📍 ৫ কিমি রেডিয়াসের মধ্যে যাত্রী বুকিং করলেই অ্যালার্ট পাবেন
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl mx-auto text-slate-600">
                  ⚪
                </div>
                <h3 className="text-lg font-bold text-slate-400">আপনি অফলাইনে আছেন</h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  রাইড গ্রহণ শুরু করতে উপরের 'অনলাইন যান' বোতামে চাপ দিন।
                </p>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">আজকের ট্রিপ</span>
                <div className="text-xl font-bold text-white mt-0.5">৬ টি</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">সংগৃহীত নগদ</span>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">₹৩৬০.০০</div>
              </div>
            </div>
          </div>
        )}

        {/* Active In-Progress Ride View */}
        {activeRide && (
          <div className="flex-1 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-400 font-bold">
                    {activeRide.status === "heading_pickup" ? "যাত্রীর কাছে যাচ্ছেন" : "যাত্রা চলমান 🛺"}
                  </span>
                  <h4 className="font-bold text-lg text-white mt-0.5">{activeRide.passengerName}</h4>
                </div>
                <a
                  href={`tel:${activeRide.passengerPhone}`}
                  className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg active:scale-95"
                >
                  <Phone className="w-5 h-5 fill-slate-950" />
                </a>
              </div>

              {/* Route Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">পিকআপ লোকেশন</span>
                    <p className="text-sm font-semibold text-white">{activeRide.pickup}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-400 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">গন্তব্য (Drop)</span>
                    <p className="text-sm font-semibold text-white">{activeRide.drop}</p>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeRide.pickup)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 text-xs font-bold flex items-center justify-center gap-2 mt-2"
                >
                  <Navigation className="w-4 h-4" />
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
                  onConfirm={() => {
                    setActiveRide({ ...activeRide, status: "on_trip" });
                    toast.success("যাত্রা শুরু হয়েছে! সাবধানে ড্রাইভ করুন।");
                  }}
                />
              ) : (
                <SwipeToConfirm
                  label="➡️ স্লাইড করে ট্রিপ সমাপ্ত করুন"
                  confirmedLabel="ট্রিপ সমাপ্ত হয়েছে ✓"
                  colorScheme="emerald"
                  onConfirm={() => {
                    toast.success("ট্রিপ সফলভাবে সমাপ্ত! নগদ ₹৫০.০০ সংগ্রহ করুন।");
                    setActiveRide(null);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* UBER / RAPIDO STYLE INCOMING RIDE MODAL SHEET */}
        {/* ------------------------------------------------------------- */}
        {incomingRide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-in slide-in-from-bottom duration-300">
            <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-6 shadow-2xl space-y-6">
              {/* Header with Circular Countdown & Fare */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    নতুন রাইড অনুরোধ!
                  </span>
                  <div className="text-3xl font-black text-amber-400 mt-0.5">
                    ₹{incomingRide.fare}.00 <span className="text-xs text-slate-400 font-normal">নগদ</span>
                  </div>
                </div>

                {/* 30s Countdown Ring */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" className="text-slate-800" fill="transparent" />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-emerald-400 transition-all duration-1000"
                      fill="transparent"
                      strokeDasharray={150}
                      strokeDashoffset={150 - (150 * alertCountdown) / 30}
                    />
                  </svg>
                  <span className="absolute font-black text-sm text-white">{alertCountdown}s</span>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    👤
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{incomingRide.passengerName}</h4>
                    <span className="flex items-center text-xs text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400 mr-1" /> {incomingRide.passengerRating}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-mono">#{incomingRide.id}</span>
              </div>

              {/* Route Preview */}
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">পিকআপ: {incomingRide.pickupDistance}</span>
                    <p className="font-bold text-sm text-white">{incomingRide.pickup}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-400 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">গন্তব্য: {incomingRide.tripDistance}</span>
                    <p className="font-bold text-sm text-white">{incomingRide.drop}</p>
                  </div>
                </div>
              </div>

              {/* Swipe to Accept Button */}
              <div className="space-y-3 pt-2">
                <SwipeToConfirm
                  label="➡️ স্লাইড করে রাইড গ্রহণ করুন"
                  confirmedLabel="রাইড গ্রহণ সফল! ✓"
                  colorScheme="emerald"
                  onConfirm={() => {
                    setActiveRide({
                      ...incomingRide,
                      status: "heading_pickup",
                    });
                    setIncomingRide(null);
                    toast.success("রাইড গ্রহণ করা হয়েছে! যাত্রীর অবস্থানে যান।");
                  }}
                />

                <Button
                  variant="ghost"
                  className="w-full text-xs text-red-400 hover:text-red-300 h-10"
                  onClick={() => {
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
  // VIEW: PASSENGER HOME / BOOKING SCREEN
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none">
      {/* Passenger Header */}
      <div className="p-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
            👤
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">{session?.passengerName || "যাত্রী পোর্টাল"}</h3>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              টোটো বুকিং ২৪x৭ প্রস্তুত
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Switch to Rider Mode */}
          <button
            onClick={handleSwitchRole}
            title="চালক মোডে যান"
            className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
          >
            <Car className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">চালক মোড</span>
          </button>

          <button
            onClick={handleLogout}
            title="লগআউট"
            className="p-2 text-slate-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Booking Interface */}
      <div className="flex-1 p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">টোটো রাইড বুক করুন</h2>
          <p className="text-slate-400 text-xs mt-1">
            আপনার অবস্থান থেকে ৫ কিমির ভেতরের স্মার্ট টোটো চালকদের অনুরোধ পাঠানো হবে।
          </p>
        </div>

        {/* Pickup & Drop Inputs */}
        <div className="space-y-4 p-5 rounded-3xl bg-slate-900 border border-slate-800">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> পিকআপ অবস্থান
            </Label>
            <Input
              value={pickupText}
              onChange={(e) => setPickupText(e.target.value)}
              className="h-12 bg-slate-950 border-slate-800 text-white rounded-xl text-sm font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" /> গন্তব্যের নাম (Drop)
            </Label>
            <Input
              value={dropText}
              onChange={(e) => setDropText(e.target.value)}
              className="h-12 bg-slate-950 border-slate-800 text-white rounded-xl text-sm font-semibold"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">আনুমানিক ভাড়া:</span>
            <span className="text-lg font-black text-amber-400">₹৫০.০০ নগদ</span>
          </div>
        </div>

        {/* Live Booking Status (If Booked) */}
        {passengerBooking ? (
          <div className="p-5 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm text-white">রাইড নিশ্চিত হয়েছে!</span>
              </div>
              <span className="text-xs text-emerald-400 font-mono">#SR-9412</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">চালক:</span>
                <span className="font-bold text-white">রাজেশ মন্ডল</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">টোটো নম্বর:</span>
                <span className="font-mono font-bold text-amber-400">WB-96-T-8421</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ফোন:</span>
                <span className="font-mono text-white">9593177885</span>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full h-11 rounded-xl text-xs font-bold"
              onClick={() => {
                setPassengerBooking(null);
                toast.info("বুকিং বাতিল করা হয়েছে");
              }}
            >
              বুকিং বাতিল করুন
            </Button>
          </div>
        ) : findingDrivers ? (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="font-bold text-sm text-white">কাছাকাছি ৫ কিমির মধ্যে চালক খোঁজা হচ্ছে...</h4>
            <p className="text-xs text-slate-400">অনলাইন চালকদের কাছে অনুরোধ পৌঁছে গেছে।</p>
          </div>
        ) : null}
      </div>

      {/* Book Button */}
      {!passengerBooking && (
        <div className="p-4 pb-6">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl"
            disabled={findingDrivers}
            onClick={() => {
              setFindingDrivers(true);
              setTimeout(() => {
                setFindingDrivers(false);
                setPassengerBooking({ id: "SR-9412" });
                playSuccessSound();
                toast.success("চালক রাইড গ্রহণ করেছেন!");
              }, 4000);
            }}
          >
            {findingDrivers ? "চালক খোঁজা হচ্ছে..." : "🛺 টোটো রাইড কনফার্ম করুন (₹৫০.০০)"}
          </Button>
        </div>
      )}
    </div>
  );
}
