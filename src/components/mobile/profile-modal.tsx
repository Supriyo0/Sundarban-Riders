"use client";

import React, { useState, useRef } from "react";
import {
  X,
  User,
  Phone,
  ShieldCheck,
  FileText,
  LogOut,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  ExternalLink,
  Save,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DisclaimerViewerModal } from "@/components/mobile/disclaimer-screen";

interface MobileProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "rider" | "passenger";
  userName: string;
  userPhone?: string;
  userPhoto?: string;
  driverKyc?: {
    aadharNumber?: string;
    totoNumber?: string;
    licenseNumber?: string;
    aadharDoc?: string;
    receiptDoc?: string;
    district?: string;
    block?: string;
    isApproved?: boolean;
  };
  cancellationStrikes?: number;
  onUpdateProfile?: (updates: { name?: string; photo?: string }) => void;
  onSwitchRole?: () => void;
  onLogout?: () => void;
}

export function MobileProfileModal({
  isOpen,
  onClose,
  role,
  userName,
  userPhone,
  userPhoto,
  driverKyc,
  cancellationStrikes = 0,
  onUpdateProfile,
  onSwitchRole,
  onLogout,
}: MobileProfileModalProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(userName);
  const [currentPhoto, setCurrentPhoto] = useState(userPhoto || "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDisclaimerViewer, setShowDisclaimerViewer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Photo Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setCurrentPhoto(base64);
        onUpdateProfile?.({ photo: base64 });

        // Save to localStorage
        try {
          const sessStr = localStorage.getItem("sr_session");
          if (sessStr) {
            const parsed = JSON.parse(sessStr);
            parsed.photo = base64;
            if (role === "rider") parsed.driverPhoto = base64;
            else parsed.passengerPhoto = base64;
            localStorage.setItem("sr_session", JSON.stringify(parsed));
          }
        } catch {}

        toast.success("প্রোফাইল ছবি সফলভাবে পরিবর্তিত হয়েছে! 📸");
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingPhoto(false);
      toast.error("ছবি আপলোড করতে ত্রুটি হয়েছে");
    }
  };

  const handleSaveName = () => {
    if (!editedName.trim()) {
      toast.error("নাম ফাঁকা রাখা যাবে না");
      return;
    }
    onUpdateProfile?.({ name: editedName.trim() });

    // Save to localStorage
    try {
      const sessStr = localStorage.getItem("sr_session");
      if (sessStr) {
        const parsed = JSON.parse(sessStr);
        parsed.name = editedName.trim();
        if (role === "rider") parsed.driverName = editedName.trim();
        else parsed.passengerName = editedName.trim();
        localStorage.setItem("sr_session", JSON.stringify(parsed));
      }
    } catch {}

    setIsEditingName(false);
    toast.success("নাম সফলভাবে আপডেট হয়েছে! ✓");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-200"
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header (Uber Style) */}
        <div className="px-5 py-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">আমার প্রোফাইল ও অ্যাকাউন্ট</h3>
              <p className="text-[11px] text-slate-500 font-medium">সুন্দরবন রাইডার্স ইউজার প্রোফাইল</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. Avatar & Basic Profile Card */}
          <div className="p-4 rounded-3xl bg-gradient-to-tr from-emerald-50/80 via-teal-50/40 to-slate-50 border border-emerald-200/60 shadow-xs flex flex-col items-center text-center relative">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/*"
              className="hidden"
            />

            {/* Profile Avatar with Camera Overlay */}
            <div className="relative mb-3 group">
              <div className="w-22 h-22 rounded-full ring-4 ring-white shadow-md overflow-hidden bg-emerald-600 flex items-center justify-center text-white text-3xl font-black">
                {currentPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPhoto}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{userName ? userName.slice(0, 1).toUpperCase() : role === "rider" ? "🛺" : "👤"}</span>
                )}
              </div>

              {/* Tap to change photo button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                title="প্রোফাইল ছবি পরিবর্তন করুন"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-slate-900 hover:bg-black text-white flex items-center justify-center shadow-lg border-2 border-white transition-transform active:scale-90 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full max-w-xs mb-1">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="আপনার নাম লিখুন..."
                  className="h-9 text-xs font-bold bg-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>সেভ</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-lg text-slate-900">{userName || "সুন্দরবন ইউজার"}</h4>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                >
                  ✏️ নাম পরিবর্তন
                </button>
              </div>
            )}

            {/* Phone & Verification Pill */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold mt-1">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>{userPhone || "হোয়াটসঅ্যাপ নম্বর সংরক্ষিত"}</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                ✓ ভেরিফায়েড
              </span>
            </div>

            {/* Current Role Badge */}
            <div className="mt-3">
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${
                  role === "rider"
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : "bg-emerald-50 text-emerald-900 border-emerald-300"
                }`}
              >
                <span>{role === "rider" ? "🛺 অনুমোদিত টোটো চালক (Captain)" : "👤 সম্মানিত যাত্রী (Passenger)"}</span>
              </span>
            </div>
          </div>

          {/* 2. KYC Details Section (Dedicated to Driver, or Safety status to Passenger) */}
          {role === "rider" ? (
            <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-xs text-slate-900">চালক কেওয়াইসি (Driver KYC Details)</h4>
                </div>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>অনুমোদিত চালক</span>
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Aadhaar Card */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">আধার কার্ড (Aadhaar Card)</span>
                      <span className="text-[10.5px] font-mono text-slate-500">
                        {driverKyc?.aadharNumber || "XXXX-XXXX-8421"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                    যাচাইকৃত ✓
                  </span>
                </div>

                {/* Toto Municipal Receipt */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">টোটো রশিদ (Toto Receipt)</span>
                      <span className="text-[10.5px] font-mono text-slate-500">
                        {driverKyc?.totoNumber || "WB-96-T-8421"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                    সংযুক্ত ✓
                  </span>
                </div>

                {/* Operating Region */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">📍</span>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">কার্য অঞ্চল (District & Route)</span>
                      <span className="text-[10.5px] text-slate-500">
                        {driverKyc?.district || "দক্ষিণ ২৪ পরগনা"} • {driverKyc?.block || "কাকদ্বীপ / নামখানা / বকখালি"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                    সক্রিয় রুট
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-xs text-slate-900">যাত্রী একাউন্ট ও সুরক্ষা স্ট্যাটাস</h4>
                </div>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  সুরক্ষিত ✓
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80">
                  <span className="font-bold text-slate-700">বাতিলকরণ সতর্কতা (Cancellation Strikes):</span>
                  <span
                    className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                      cancellationStrikes > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {cancellationStrikes}/৩ বাতিল
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80">
                  <span className="font-bold text-slate-700">২৪×৭ হেল্পলাইন:</span>
                  <a href="tel:9593177885" className="text-emerald-700 font-bold hover:underline">
                    9593177885 📞
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 3. First-Time Disclaimer Agreement (Tick Accepted by User) */}
          <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📜</span>
                <h4 className="font-extrabold text-xs text-slate-900">আইনি ডিসক্লেইমার ও সম্মতি</h4>
              </div>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>প্রথম লগইনে টিক দিয়ে গৃহীত</span>
              </span>
            </div>

            {/* The First-Time Tick Agreement Box */}
            <div className="p-3.5 rounded-2xl bg-white border-2 border-emerald-500 shadow-xs flex items-start gap-3">
              <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-900 leading-snug">
                  {role === "rider"
                    ? "আমি সমস্ত শর্তাবলি, নিয়মাবলী ও আইনি দায়মুক্তি পড়েছি এবং এতে পূর্ণ সম্মতি দিচ্ছি"
                    : "আমি সমস্ত শর্তাবলি ও নিয়মাবলী পড়েছি এবং এতে পূর্ণ সম্মতি দিচ্ছি"}
                </p>
                <p className="text-[10.5px] text-emerald-700 font-bold flex items-center gap-1">
                  <span>✓</span>
                  <span>প্রথমবার লগইনকালে আপনি এই বাক্সে টিক চিহ্ন দিয়ে সম্মতি দিয়েছেন</span>
                </p>
              </div>
            </div>

            {/* View Full Disclaimers & Download PDF Button */}
            <button
              type="button"
              onClick={() => setShowDisclaimerViewer(true)}
              className="w-full py-2.5 px-3 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>অফিসিয়াল ডিসক্লেইমার ও নিয়মাবলী দেখুন</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5">
                <span>ধারাসমূহ</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          </div>

          {/* 4. Action Buttons: Switch Role */}
          {onSwitchRole && (
            <button
              type="button"
              onClick={() => {
                onSwitchRole();
                onClose();
              }}
              className="w-full p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-between transition-colors shadow-2xs cursor-pointer active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-slate-900">
                    {role === "rider" ? "যাত্রী মোডে স্যুইচ করুন" : "টোটো চালক মোডে স্যুইচ করুন"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {role === "rider" ? "যাত্রী হিসেবে রাইড বুক করতে চান?" : "রাইড গ্রহণ করতে চান?"}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                স্যুইচ
              </span>
            </button>
          )}

          {/* 5. Logout Button */}
          {onLogout && (
            <Button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full h-11 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-98 cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>অ্যাকাউন্ট থেকে লগআউট করুন</span>
            </Button>
          )}
        </div>
      </div>

      {/* Official Disclaimer Viewer Modal */}
      <DisclaimerViewerModal
        isOpen={showDisclaimerViewer}
        onClose={() => setShowDisclaimerViewer(false)}
        defaultRole={role}
      />
    </div>
  );
}
