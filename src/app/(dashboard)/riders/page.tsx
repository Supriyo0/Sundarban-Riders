"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Car,
  Plus,
  Search,
  Phone,
  ShieldCheck,
  Star,
  RefreshCw,
  Power,
  SlidersHorizontal,
  MapPin,
  CreditCard,
  CheckCircle,
  FileText,
  Clock,
  ExternalLink,
  Upload,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Driver {
  id: string;
  name: string;
  phone: string;
  toto_number: string;
  unique_id?: string;
  district?: string;
  block?: string;
  aadhar_no?: string;
  license_no?: string;
  license_number?: string;
  current_location_name?: string;
  vehicle_type?: string;
  is_active: boolean;
  is_available: boolean;
  is_approved?: boolean;
  agreed_terms?: boolean;
  email?: string;
  aadhar_card_url?: string;
  secondary_doc_url?: string;
  secondary_doc_type?: string;
  license_doc_url?: string;
  toto_receipt_doc_url?: string;
  total_trips?: number;
  rating?: number;
  created_at?: string;
}

export default function RidersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "busy">("all");

  // Add Driver Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTotoNumber, setNewTotoNumber] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [newBlock, setNewBlock] = useState("");
  const [newAadharNo, setNewAadharNo] = useState("");
  const [newAadharCardUrl, setNewAadharCardUrl] = useState("");
  const [uploadingAadharDoc, setUploadingAadharDoc] = useState(false);
  const aadharFileInputRef = useRef<HTMLInputElement>(null);

  // Toto Receipt (টোটো রসিদ)
  const [newTotoReceiptDocUrl, setNewTotoReceiptDocUrl] = useState("");
  const [uploadingTotoReceiptDoc, setUploadingTotoReceiptDoc] = useState(false);
  const totoReceiptFileInputRef = useRef<HTMLInputElement>(null);

  // Driving Licence (লাইসেন্স - ঐচ্ছিক / Not Mandatory)
  const [newLicenseNo, setNewLicenseNo] = useState("");
  const [newLicenseDocUrl, setNewLicenseDocUrl] = useState("");
  const [uploadingLicenseDoc, setUploadingLicenseDoc] = useState(false);
  const licenseFileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  // Approve Driver Dialog State with Unique ID assignment
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvingDriver, setApprovingDriver] = useState<Driver | null>(null);
  const [assignUniqueId, setAssignUniqueId] = useState("");
  const [approving, setApproving] = useState(false);

  // Edit Driver Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editName, setEditName] = useState("");
  const [editUniqueId, setEditUniqueId] = useState("");
  const [editTotoNumber, setEditTotoNumber] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAadharDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAadharDoc(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", `admin_aadhar_${file.name}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success && json.url) {
        setNewAadharCardUrl(json.url);
        toast.success("আধার কার্ড ImgBB-তে সফলভাবে আপলোড হয়েছে");
      } else {
        toast.error(json.message || "আপলোড ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingAadharDoc(false);
    }
  };

  const handleTotoReceiptDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingTotoReceiptDoc(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", `admin_receipt_${file.name}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success && json.url) {
        setNewTotoReceiptDocUrl(json.url);
        toast.success("টোটো রসিদ ImgBB-তে সফলভাবে আপলোড হয়েছে");
      } else {
        toast.error(json.message || "টোটো রসিদ আপলোড ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("টোটো রসিদ আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingTotoReceiptDoc(false);
    }
  };

  const handleLicenseDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLicenseDoc(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", `admin_license_${file.name}`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success && json.url) {
        setNewLicenseDocUrl(json.url);
        toast.success("ড্রাইভিং লাইসেন্স ImgBB-তে সফলভাবে আপলোড হয়েছে");
      } else {
        toast.error(json.message || "লাইসেন্স আপলোড ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("লাইসেন্স আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingLicenseDoc(false);
    }
  };

  // Helper to determine status
  const getDriverStatus = (d: Driver): "online" | "busy" | "offline" => {
    if (!d.is_active) return "offline";
    if (!d.is_available) return "busy";
    return "online";
  };

  // Load Drivers
  const loadDrivers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/drivers");
      if (res.ok) {
        const json = await res.json();
        setDrivers(json.drivers || []);
      } else {
        const { data, error } = await supabase
          .from("drivers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Parse fallback metadata
        const parsed = ((data as Driver[]) || []).map((d) => {
          let district = d.district || "";
          let block = d.block || "";
          let aadhar_no = d.aadhar_no || d.license_number || "";

          if ((!district || !block || !aadhar_no) && d.current_location_name) {
            try {
              const meta = JSON.parse(d.current_location_name);
              district = district || meta.district || "";
              block = block || meta.block || "";
              aadhar_no = aadhar_no || meta.aadhar_no || "";
            } catch {}
          }
          return { ...d, district, block, aadhar_no };
        });

        setDrivers(parsed);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load drivers";
      console.error("Error loading drivers:", errorMsg);
      toast.error("চালক তালিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();

    // Realtime listener for live driver status updates
    const channel = supabase
      .channel("drivers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => {
          loadDrivers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Filter Drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        d.name?.toLowerCase().includes(query) ||
        d.phone?.includes(query) ||
        d.toto_number?.toLowerCase().includes(query) ||
        d.district?.toLowerCase().includes(query) ||
        d.block?.toLowerCase().includes(query) ||
        d.aadhar_no?.includes(query);

      const status = getDriverStatus(d);
      const matchesStatus =
        statusFilter === "all" ? true : status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  // Status Metrics
  const stats = useMemo(() => {
    const total = drivers.length;
    const online = drivers.filter((d) => d.is_active && d.is_available).length;
    const busy = drivers.filter((d) => d.is_active && !d.is_available).length;
    const offline = drivers.filter((d) => !d.is_active).length;
    return { total, online, busy, offline };
  }, [drivers]);

  // Toggle Driver Duty Status
  const handleToggleStatus = async (driver: Driver) => {
    const nextActive = !driver.is_active;
    try {
      const res = await fetch("/api/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: driver.id,
          is_active: nextActive,
          is_available: nextActive,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "স্ট্যাটাস পরিবর্তন করা যায়নি");
      }

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driver.id
            ? { ...d, is_active: nextActive, is_available: nextActive }
            : d
        )
      );
      toast.success(
        nextActive
          ? `${driver.name} এখন অনলাইন আছেন 🟢`
          : `${driver.name} এখন অফলাইন আছেন 🔴`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "স্ট্যাটাস পরিবর্তন করা যায়নি";
      toast.error(msg);
    }
  };

  // Delete Driver & Free for Re-registration
  const handleDeleteDriver = async (driver: Driver) => {
    const confirmed = window.confirm(
      `আপনি কি নিশ্চিত যে চালক ${driver.name} (${driver.phone})-কে মুছে ফেলতে চান?\n\nমুছে ফেললে এই চালক পুনরায় নতুন করে রেজিস্ট্রেশন করতে পারবেন।`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/drivers?id=${encodeURIComponent(driver.id)}&phone=${encodeURIComponent(driver.phone)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "চালক সফলভাবে মুছে ফেলা হয়েছে");
        loadDrivers();
      } else {
        toast.error(data.error || "মুছে ফেলা ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    }
  };

  // Open Approve Modal & Suggest Unique ID
  const handleOpenApproveModal = (driver: Driver) => {
    setApprovingDriver(driver);
    const cleanDigits = (driver.phone || "").replace(/\D/g, "").slice(-4);
    const defaultUid = driver.unique_id || (cleanDigits ? `SR-${cleanDigits}` : `SR-${Math.floor(1000 + Math.random() * 9000)}`);
    setAssignUniqueId(defaultUid);
    setIsApproveOpen(true);
  };

  // Confirm Approve & Assign Unique ID
  const handleConfirmApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingDriver) return;
    if (!assignUniqueId.trim()) {
      toast.error("ইউনিক চালক আইডি আবশ্যক");
      return;
    }

    try {
      setApproving(true);
      const res = await fetch("/api/drivers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: approvingDriver.id,
          approve: true,
          unique_id: assignUniqueId.trim().toUpperCase(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `চালক সফলভাবে অনুমোদিত হয়েছে (আইডি: ${assignUniqueId})!`);
        setIsApproveOpen(false);
        setApprovingDriver(null);
        loadDrivers();
      } else {
        toast.error(json.message || "অনুমোদন ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    } finally {
      setApproving(false);
    }
  };

  // Open Edit Modal for driver Unique ID and details
  const handleOpenEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setEditName(driver.name || "");
    setEditUniqueId(driver.unique_id || driver.toto_number || "");
    setEditTotoNumber(driver.toto_number || "");
    setIsEditOpen(true);
  };

  // Save Driver Edits
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    if (!editName.trim() || !editTotoNumber.trim() || !editUniqueId.trim()) {
      toast.error("চালকের নাম, টোটো নম্বর এবং ইউনিক আইডি আবশ্যক");
      return;
    }

    try {
      setSavingEdit(true);
      const res = await fetch("/api/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDriver.id,
          name: editName.trim(),
          toto_number: editTotoNumber.trim().toUpperCase(),
          unique_id: editUniqueId.trim().toUpperCase(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "আপডেট করা যায়নি");
      }

      toast.success("✅ চালকের তথ্য ও ইউনিক আইডি সফলভাবে আপডেট হয়েছে!");
      setIsEditOpen(false);
      setEditingDriver(null);
      loadDrivers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "আপডেট করা যায়নি";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Add New Driver
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newTotoNumber.trim()) {
      toast.error("চালকের নাম, ফোন ও টোটো নম্বর আবশ্যক");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          toto_number: newTotoNumber.trim().toUpperCase(),
          district: newDistrict.trim(),
          block: newBlock.trim(),
          aadhar_no: newAadharNo.trim(),
          aadhar_card_url: newAadharCardUrl.trim() || undefined,
          toto_receipt_doc_url: newTotoReceiptDocUrl.trim() || undefined,
          secondary_doc_url: newTotoReceiptDocUrl.trim() || undefined,
          license_no: newLicenseNo.trim() || undefined,
          license_doc_url: newLicenseDocUrl.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "চালক যুক্ত করা যায়নি");
      }

      toast.success(json.message || "✅ চালক সফলভাবে যুক্ত হয়েছে!");
      setIsAddOpen(false);
      setNewName("");
      setNewPhone("");
      setNewTotoNumber("");
      setNewDistrict("");
      setNewBlock("");
      setNewAadharNo("");
      setNewAadharCardUrl("");
      setNewTotoReceiptDocUrl("");
      setNewLicenseNo("");
      setNewLicenseDocUrl("");
      loadDrivers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "চালক যুক্ত করা যায়নি";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              🛺 চালক ব্যবস্থাপনা (Toto Riders Panel)
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            সুন্দরবন রাইডার্সের সমস্ত নিবন্ধিত চালক, জেলা, ব্লক, আধার নম্বর এবং লাইভ ডিউটি স্ট্যাটাস
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDrivers}
            className="border-border text-foreground hover:bg-muted"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            রিফ্রেশ
          </Button>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            নতুন চালক যুক্ত করুন
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">মোট চালক</span>
              <Car className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">নিবন্ধিত টোটো</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-500">অনলাইন (প্রস্তুত)</span>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.online}
            </div>
            <p className="text-xs text-muted-foreground">বুকিং গ্রহণের জন্য উপলব্ধ</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-500">রাইডে ব্যস্ত</span>
              <Car className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.busy}
            </div>
            <p className="text-xs text-muted-foreground">চলমান ট্রিপে আছেন</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">অফলাইন</span>
              <Power className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold text-muted-foreground">{stats.offline}</div>
            <p className="text-xs text-muted-foreground">ডিউটিতে নেই</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="নাম, ফোন, টোটো নম্বর, জেলা, ব্লক বা আধার দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground"
              />
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Button
                variant={statusFilter === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs"
              >
                সব ({stats.total})
              </Button>
              <Button
                variant={statusFilter === "online" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("online")}
                className="text-xs text-emerald-500"
              >
                অনলাইন ({stats.online})
              </Button>
              <Button
                variant={statusFilter === "busy" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("busy")}
                className="text-xs text-amber-500"
              >
                ব্যস্ত ({stats.busy})
              </Button>
              <Button
                variant={statusFilter === "offline" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("offline")}
                className="text-xs"
              >
                অফলাইন ({stats.offline})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drivers List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</div>
        ) : filteredDrivers.length === 0 ? (
          <Card className="border-dashed border-border bg-card py-12 text-center">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-medium text-foreground">কোনো চালক পাওয়া যায়নি</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              নতুন চালক যুক্ত করতে উপরের বাটনে ক্লিক করুন।
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver) => {
              const status = getDriverStatus(driver);
              const isOnline = status === "online";
              const isBusy = status === "busy";

              return (
                <Card
                  key={driver.id}
                  className="border-border bg-card transition-all hover:border-border/80 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-base">
                            {driver.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              isOnline
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : isBusy
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {isOnline ? "অনলাইন 🟢" : isBusy ? "ব্যস্ত 🟡" : "অফলাইন 🔴"}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{driver.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                              🆔 আইডি: {driver.unique_id || driver.toto_number}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              (টোটো: {driver.toto_number})
                            </span>
                          </div>

                          {(driver.district || driver.block) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                              <span>{[driver.district, driver.block].filter(Boolean).join(" • ")}</span>
                            </div>
                          )}

                          {driver.aadhar_no && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                              <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                              <span>আধার: {driver.aadhar_no}</span>
                            </div>
                          )}
                          {driver.license_no && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                              <span>লাইসেন্স: {driver.license_no}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                          <Star className="h-3.5 w-3.5 fill-amber-500" />
                          <span>{driver.rating || 5.0}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {driver.total_trips || 0} টি রাইড
                        </span>
                      </div>
                    </div>

                    {/* KYC Documents Links if submitted */}
                    {(driver.aadhar_card_url || driver.toto_receipt_doc_url || driver.secondary_doc_url || driver.license_doc_url) && (
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-muted-foreground font-medium">ডকুমেন্টস:</span>
                        {driver.aadhar_card_url && (
                          <a
                            href={driver.aadhar_card_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                          >
                            <FileText className="h-3 w-3" />
                            আধার কার্ড
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {(driver.toto_receipt_doc_url || driver.secondary_doc_url) && (
                          <a
                            href={driver.toto_receipt_doc_url || driver.secondary_doc_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-600 hover:underline font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20"
                          >
                            <FileText className="h-3 w-3" />
                            টোটো রসিদ
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {driver.license_doc_url && (
                          <a
                            href={driver.license_doc_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                          >
                            <FileText className="h-3 w-3" />
                            ড্রাইভিং লাইসেন্স (ঐচ্ছিক)
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {driver.is_approved === false ? (
                          <span className="text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Clock className="h-3.5 w-3.5" />
                            অনুমোদনের অপেক্ষায়
                          </span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle className="h-3.5 w-3.5" />
                            অনুমোদিত চালক
                          </span>
                        )}
                      </div>

                      {driver.is_approved === false ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenApproveModal(driver)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          অনুমোদন করুন
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={driver.is_active ? "destructive" : "outline"}
                          onClick={() => handleToggleStatus(driver)}
                          className={`text-xs h-8 ${
                            !driver.is_active
                              ? "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                              : ""
                          }`}
                        >
                          <Power className="mr-1.5 h-3.5 w-3.5" />
                          {driver.is_active ? "অফলাইন করুন" : "অনলাইন করুন"}
                        </Button>
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="আইডি ও চালক তথ্য সম্পাদনা"
                          onClick={() => handleOpenEditModal(driver)}
                          className="text-xs h-8 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="চালক সম্পূর্ণ ডিলিট করুন"
                          onClick={() => handleDeleteDriver(driver)}
                          className="text-xs h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Driver Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <span>🛺 নতুন টোটো চালক যুক্ত করুন</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              চালকের সঠিক বিবরণ ও প্রয়োজনীয় ডকুমেন্টস (আধার কার্ড, টোটো রসিদ ও ঐচ্ছিক লাইসেন্স) যুক্ত করুন।
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDriver} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-semibold">চালকের পূর্ণ নাম *</Label>
              <Input
                id="name"
                placeholder="যেমন: রাজেশ মন্ডল"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-muted border-border text-foreground"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground font-semibold">হোয়াটসঅ্যাপ ফোন নম্বর *</Label>
                <Input
                  id="phone"
                  placeholder="যেমন: +91 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toto" className="text-foreground font-semibold">টোটো রেজিস্ট্রেশন নম্বর *</Label>
                <Input
                  id="toto"
                  placeholder="যেমন: WB-96-T-1234"
                  value={newTotoNumber}
                  onChange={(e) => setNewTotoNumber(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground uppercase font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="district" className="text-foreground">জেলা (District)</Label>
                <Input
                  id="district"
                  placeholder="যেমন: দক্ষিণ ২৪ পরগনা"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="block" className="text-foreground">ব্লক (Block)</Label>
                <Input
                  id="block"
                  placeholder="যেমন: কাকদ্বীপ / নামখানা / ডায়মন্ড হারবার"
                  value={newBlock}
                  onChange={(e) => setNewBlock(e.target.value)}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </div>

            {/* KYC Documents Section */}
            <div className="pt-2 pb-1 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  চালকের ভেরিফিকেশন ডকুমেন্টস
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">আধার ও টোটো রসিদ প্রয়োজন</span>
              </div>

              {/* 1. AADHAR CARD */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="aadhar" className="text-foreground font-bold text-xs flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                    ১. আধার কার্ড (Aadhar Card)
                  </Label>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    আবশ্যক
                  </span>
                </div>
                <Input
                  id="aadhar"
                  placeholder="১২ সংখ্যার আধার নম্বর (যেমন: 1234 5678 9012)"
                  value={newAadharNo}
                  onChange={(e) => setNewAadharNo(e.target.value)}
                  maxLength={16}
                  className="bg-background border-border text-foreground font-mono text-xs h-9"
                />
                <input
                  ref={aadharFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleAadharDocUpload}
                />
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-dashed border-border"
                    disabled={uploadingAadharDoc}
                    onClick={() => aadharFileInputRef.current?.click()}
                  >
                    {uploadingAadharDoc ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {newAadharCardUrl ? "আধার ছবি পরিবর্তন করুন" : "আধার কার্ড ছবি আপলোড (ImgBB)"}
                  </Button>
                  {newAadharCardUrl && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <a
                        href={newAadharCardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline truncate max-w-[140px] flex items-center gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        আধার প্রিভিউ
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setNewAadharCardUrl("")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. TOTO ROSIT / RECEIPT */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground font-bold text-xs flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-purple-500" />
                    ২. টোটো রসিদ (Toto Rosit / Purchase Receipt)
                  </Label>
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                    আবশ্যক
                  </span>
                </div>
                <input
                  ref={totoReceiptFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleTotoReceiptDocUpload}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-dashed border-border"
                    disabled={uploadingTotoReceiptDoc}
                    onClick={() => totoReceiptFileInputRef.current?.click()}
                  >
                    {uploadingTotoReceiptDoc ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-500" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {newTotoReceiptDocUrl ? "টোটো রসিদ পরিবর্তন করুন" : "টোটো রসিদ ছবি আপলোড (ImgBB)"}
                  </Button>
                  {newTotoReceiptDocUrl && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <a
                        href={newTotoReceiptDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 underline truncate max-w-[140px] flex items-center gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        রসিদ প্রিভিউ
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setNewTotoReceiptDocUrl("")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. DRIVING LICENCE (NOT MANDATORY) */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="license" className="text-foreground font-bold text-xs flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    ৩. ড্রাইভিং লাইসেন্স (Licence)
                  </Label>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                    ঐচ্ছিক (Not Mandatory)
                  </span>
                </div>
                <Input
                  id="license"
                  placeholder="লাইসেন্স নম্বর (ঐচ্ছিক)"
                  value={newLicenseNo}
                  onChange={(e) => setNewLicenseNo(e.target.value)}
                  className="bg-background border-border text-foreground font-mono text-xs h-9"
                />
                <input
                  ref={licenseFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleLicenseDocUpload}
                />
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-dashed border-border"
                    disabled={uploadingLicenseDoc}
                    onClick={() => licenseFileInputRef.current?.click()}
                  >
                    {uploadingLicenseDoc ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {newLicenseDocUrl ? "লাইসেন্স ছবি পরিবর্তন করুন" : "লাইসেন্স ছবি আপলোড (ঐচ্ছিক)"}
                  </Button>
                  {newLicenseDocUrl && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <a
                        href={newLicenseDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline truncate max-w-[140px] flex items-center gap-1"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        লাইসেন্স প্রিভিউ
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setNewLicenseDocUrl("")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="border-border text-foreground"
              >
                বাতিল
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {saving ? "যুক্ত হচ্ছে..." : "সংরক্ষণ করুন"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve & Assign Unique ID Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="sm:max-w-[440px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">চালক অনুমোদন ও ইউনিক আইডি বরাদ্দ</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              অনুমোদনের পূর্বে চালকের জন্য একটি ইউনিক আইডি নির্ধারণ করুন। এই আইডিটি অ্যাপ ও বুকিং সিস্টেমে টোটো নম্বরের পরিবর্তে প্রদর্শিত হবে।
            </DialogDescription>
          </DialogHeader>
          {approvingDriver && (
            <form onSubmit={handleConfirmApprove} className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/60 p-3 space-y-1.5 text-xs text-muted-foreground border border-border/50">
                <div className="flex justify-between">
                  <span>চালকের নাম:</span>
                  <span className="font-semibold text-foreground">{approvingDriver.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>ফোন নম্বর:</span>
                  <span className="font-mono text-foreground">{approvingDriver.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span>টোটো নম্বর:</span>
                  <span className="font-mono text-foreground">{approvingDriver.toto_number}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approveUniqueId" className="text-foreground font-semibold">
                  ইউনিক চালক আইডি (Unique Driver ID) *
                </Label>
                <Input
                  id="approveUniqueId"
                  placeholder="যেমন: SR-101 / SR-DRV-01"
                  value={assignUniqueId}
                  onChange={(e) => setAssignUniqueId(e.target.value)}
                  required
                  className="bg-muted border-emerald-500/50 text-foreground font-mono font-bold uppercase tracking-wider text-base focus:border-emerald-500"
                />
                <p className="text-[11px] text-muted-foreground">
                  প্রয়োজনে এই আইডিটি আপনি নিজের ইচ্ছামতো পরিবর্তন করতে পারেন।
                </p>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApproveOpen(false)}
                  className="border-border text-foreground"
                >
                  বাতিল
                </Button>
                <Button
                  type="submit"
                  disabled={approving || !assignUniqueId.trim()}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5"
                >
                  {approving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {approving ? "অনুমোদন হচ্ছে..." : "অনুমোদন ও আইডি বরাদ্দ"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Driver & Unique ID Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[440px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">চালক ও ইউনিক আইডি সম্পাদনা</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              চালকের ইউনিক আইডি বা নাম ও টোটো নম্বর পরিবর্তন করুন।
            </DialogDescription>
          </DialogHeader>
          {editingDriver && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="editUniqueId" className="text-foreground font-semibold">
                  ইউনিক চালক আইডি (Unique Driver ID) *
                </Label>
                <Input
                  id="editUniqueId"
                  placeholder="যেমন: SR-101"
                  value={editUniqueId}
                  onChange={(e) => setEditUniqueId(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground font-mono font-bold uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editName" className="text-foreground">চালকের পূর্ণ নাম *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editToto" className="text-foreground">টোটো রেজিস্ট্রেশন নম্বর *</Label>
                <Input
                  id="editToto"
                  value={editTotoNumber}
                  onChange={(e) => setEditTotoNumber(e.target.value)}
                  required
                  className="bg-muted border-border text-foreground font-mono uppercase"
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="border-border text-foreground"
                >
                  বাতিল
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {savingEdit ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
