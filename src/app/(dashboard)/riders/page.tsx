"use client";

import { useEffect, useState, useMemo } from "react";
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
  district?: string;
  block?: string;
  aadhar_no?: string;
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
  const [saving, setSaving] = useState(false);

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

  // Approve Driver & Trigger Email/WhatsApp Notifications
  const handleApproveDriver = async (driverId: string) => {
    try {
      const res = await fetch("/api/drivers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, approve: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "চালক সফলভাবে অনুমোদিত হয়েছে!");
        loadDrivers();
      } else {
        toast.error(json.message || "অনুমোদন ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
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
                          <div className="flex items-center gap-2">
                            <Car className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono font-medium text-foreground">
                              {driver.toto_number}
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
                    {(driver.aadhar_card_url || driver.secondary_doc_url) && (
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground font-medium">ডকুমেন্টস:</span>
                        {driver.aadhar_card_url && (
                          <a
                            href={driver.aadhar_card_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:underline font-medium"
                          >
                            <FileText className="h-3 w-3" />
                            আধার কার্ড
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {driver.secondary_doc_url && (
                          <a
                            href={driver.secondary_doc_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-500 hover:underline font-medium"
                          >
                            <FileText className="h-3 w-3" />
                            ২য় ডকুমেন্ট
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
                          onClick={() => handleApproveDriver(driver.id)}
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
        <DialogContent className="sm:max-w-[480px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">নতুন টোটো চালক যুক্ত করুন</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              চালকের সঠিক নাম, ফোন নম্বর, টোটো নম্বর, এলাকা ও আধার নম্বর লিখুন।
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDriver} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">চালকের পূর্ণ নাম *</Label>
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
                <Label htmlFor="phone" className="text-foreground">হোয়াটসঅ্যাপ ফোন নম্বর *</Label>
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
                <Label htmlFor="toto" className="text-foreground">টোটো রেজিস্ট্রেশন নম্বর *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="aadhar" className="text-foreground">আধার নম্বর (Aadhar No)</Label>
              <Input
                id="aadhar"
                placeholder="১২ সংখ্যার আধার নম্বর (যেমন: 1234 5678 9012)"
                value={newAadharNo}
                onChange={(e) => setNewAadharNo(e.target.value)}
                maxLength={16}
                className="bg-muted border-border text-foreground font-mono"
              />
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
    </div>
  );
}
