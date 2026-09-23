"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Car,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  ShieldCheck,
  Star,
  RefreshCw,
  Power,
  SlidersHorizontal,
  UserCheck,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  status: "online" | "offline" | "busy";
  is_approved?: boolean;
  total_rides?: number;
  rating?: number;
  created_at?: string;
}

export default function RidersPage() {
  const { account } = useAuth();
  const supabase = createClient();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "busy">("all");

  // Add Driver Dialog State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTotoNumber, setNewTotoNumber] = useState("");
  const [saving, setSaving] = useState(false);

  // Load Drivers
  const loadDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
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
  }, []);

  // Filter Drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchesSearch =
        d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone?.includes(searchQuery) ||
        d.toto_number?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : d.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchQuery, statusFilter]);

  // Status Metrics
  const stats = useMemo(() => {
    const total = drivers.length;
    const online = drivers.filter((d) => d.status === "online").length;
    const busy = drivers.filter((d) => d.status === "busy").length;
    const offline = drivers.filter((d) => d.status === "offline" || !d.status).length;
    return { total, online, busy, offline };
  }, [drivers]);

  // Toggle Driver Duty Status
  const handleToggleStatus = async (driver: Driver) => {
    const nextStatus = driver.status === "online" ? "offline" : "online";
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ status: nextStatus })
        .eq("id", driver.id);

      if (error) throw error;

      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? { ...d, status: nextStatus } : d))
      );
      toast.success(
        nextStatus === "online"
          ? `${driver.name} এখন অনলাইন আছেন 🟢`
          : `${driver.name} এখন অফলাইন আছেন 🔴`
      );
    } catch (err: unknown) {
      toast.error("স্ট্যাটাস পরিবর্তন করা যায়নি");
    }
  };

  // Add New Driver
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newTotoNumber.trim()) {
      toast.error("সবগুলো তথ্য সঠিকভাবে পূরণ করুন");
      return;
    }

    try {
      setSaving(true);
      const cleanedPhone = newPhone.trim().replace(/[^0-9+]/g, "");

      const { data, error } = await supabase
        .from("drivers")
        .insert({
          name: newName.trim(),
          phone: cleanedPhone,
          toto_number: newTotoNumber.trim().toUpperCase(),
          status: "online",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("✅ নতুন চালক সফলভাবে যুক্ত হয়েছে!");
      setIsAddOpen(false);
      setNewName("");
      setNewPhone("");
      setNewTotoNumber("");
      loadDrivers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add driver";
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
            সুন্দরবন রাইডার্সের সমস্ত নিবন্ধিত চালক, টোটো নম্বর এবং লাইভ ডিউটি স্ট্যাটাস
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
                placeholder="নাম, ফোন নম্বর বা টোটো নম্বর দিয়ে খুঁজুন..."
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
              const isOnline = driver.status === "online";
              const isBusy = driver.status === "busy";

              return (
                <Card
                  key={driver.id}
                  className="border-border bg-card transition-all hover:border-border/80 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
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

                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
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
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                          <Star className="h-3.5 w-3.5 fill-amber-500" />
                          <span>{driver.rating || 5.0}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {driver.total_rides || 0} টি রাইড
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                        <ShieldCheck className="h-4 w-4" />
                        <span>চুক্তি সম্মত</span>
                      </div>

                      <Button
                        size="sm"
                        variant={isOnline ? "destructive" : "outline"}
                        onClick={() => handleToggleStatus(driver)}
                        className={`text-xs h-8 ${
                          !isOnline
                            ? "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        <Power className="mr-1.5 h-3.5 w-3.5" />
                        {isOnline ? "অফলাইন করুন" : "অনলাইন করুন"}
                      </Button>
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
        <DialogContent className="sm:max-w-[425px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">নতুন টোটো চালক যুক্ত করুন</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              চালকের সঠিক ফোন নম্বর ও টোটো নম্বর লিখুন।
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDriver} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">চালকের পূর্ণ নাম</Label>
              <Input
                id="name"
                placeholder="যেমন: রাজেশ মন্ডল"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-muted border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground">হোয়াটসঅ্যাপ ফোন নম্বর</Label>
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
              <Label htmlFor="toto" className="text-foreground">টোটো রেজিস্ট্রেশন নম্বর</Label>
              <Input
                id="toto"
                placeholder="যেমন: WB-96-T-1234"
                value={newTotoNumber}
                onChange={(e) => setNewTotoNumber(e.target.value)}
                required
                className="bg-muted border-border text-foreground uppercase font-mono"
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
