"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Navigation,
  Car,
  Phone,
  MapPin,
  Clock,
  IndianRupee,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Radio,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface Booking {
  id: string;
  booking_no?: string;
  customer_phone: string;
  customer_name?: string;
  driver_name?: string;
  driver_phone?: string;
  toto_number?: string;
  pickup_location?: string;
  drop_location?: string;
  distance_km?: number;
  fare?: number;
  status: "searching" | "assigned" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  cancellation_reason?: string;
}

export default function DispatchRadarPage() {
  const supabase = createClient();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setBookings(data || []);
    } catch (err: unknown) {
      console.error("Error loading bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel("bookings_radar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.booking_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.customer_phone?.includes(searchQuery) ||
        b.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.pickup_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.drop_location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ? true : b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const searching = bookings.filter((b) => b.status === "searching").length;
    const assigned = bookings.filter((b) => b.status === "assigned" || b.status === "in_progress").length;
    const completed = bookings.filter((b) => b.status === "completed").length;
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    return { total, searching, assigned, completed, cancelled };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Navigation className="h-6 w-6 text-emerald-500 animate-pulse" />
              লাইভ ডিসপ্যাচ রাডার (Live Dispatch Radar)
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            রিয়েল-টাইম টোটো বুকিং রিকোয়েস্ট, চালক খোঁজা ও চলমান রাইড মনিটরিং
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadBookings}
          className="border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          রিফ্রেশ
        </Button>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-500">চালক খোঁজা হচ্ছে (Searching)</span>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500"></span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-500">{stats.searching}</div>
            <p className="text-xs text-muted-foreground">কাছাকাছি চালকদের অ্যালার্ট পাঠানো হচ্ছে</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-500">চলমান রাইড (In Progress)</span>
              <Car className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-500">{stats.assigned}</div>
            <p className="text-xs text-muted-foreground">চালক পিকআপ বা গন্তব্যে যাচ্ছেন</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-500">সম্পন্ন (Completed)</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-500">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">সফলভাবে সমাপ্ত ট্রিপ</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-500">বাতিলকৃত (Cancelled)</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-500">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">বাতিলকৃত রাইড</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="বুকিং নং, ফোন, পিকআপ বা ড্রপ লোকেশন দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={statusFilter === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs"
              >
                সব
              </Button>
              <Button
                variant={statusFilter === "searching" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("searching")}
                className="text-xs text-amber-500"
              >
                খোঁজা হচ্ছে ({stats.searching})
              </Button>
              <Button
                variant={statusFilter === "assigned" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("assigned")}
                className="text-xs text-blue-500"
              >
                অ্যাসাইনকৃত
              </Button>
              <Button
                variant={statusFilter === "completed" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
                className="text-xs text-emerald-500"
              >
                সম্পন্ন ({stats.completed})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Radar Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</div>
        ) : filteredBookings.length === 0 ? (
          <Card className="border-dashed border-border bg-card py-12 text-center">
            <Radio className="mx-auto h-12 w-12 text-muted-foreground/50 animate-pulse" />
            <h3 className="mt-3 text-lg font-medium text-foreground">কোনো সক্রিয় বুকিং পাওয়া যায়নি</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              হোয়াটসঅ্যাপে গ্রাহক টোটো বুক করলে রিয়েল-টাইমে এখানে দৃশ্যমান হবে।
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredBookings.map((b) => {
              const isSearching = b.status === "searching";
              const isAssigned = b.status === "assigned" || b.status === "in_progress";
              const isCompleted = b.status === "completed";
              const isCancelled = b.status === "cancelled";

              return (
                <Card
                  key={b.id}
                  className={`border-border bg-card transition-all ${
                    isSearching ? "border-amber-500/50 shadow-amber-500/5 shadow-md" : ""
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground text-sm">
                            #{b.booking_no || b.id.slice(0, 8)}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isSearching
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                                : isAssigned
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                                : isCompleted
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                                : "bg-red-500/10 text-red-500 border border-red-500/30"
                            }`}
                          >
                            {isSearching
                              ? "🔍 চালক খোঁজা হচ্ছে"
                              : isAssigned
                              ? "🚖 চালক পথে আছেন"
                              : isCompleted
                              ? "✅ রাইড সম্পন্ন"
                              : "❌ বাতিলকৃত"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(b.created_at).toLocaleTimeString("bn-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-500 font-mono">
                          ₹{b.fare || 0}.00
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.distance_km || 0} কিমি
                        </div>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="mt-4 rounded-lg bg-muted/60 p-3 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs text-muted-foreground">পিকআপ:</span>
                          <p className="font-medium text-foreground">{b.pickup_location || "লোকেশন পিন দেওয়া হয়েছে"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                        <MapPin className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs text-muted-foreground">ড্রপ / গন্তব্য:</span>
                          <p className="font-medium text-foreground">{b.drop_location || "নির্দিষ্ট করা হয়নি"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Driver & Customer Info */}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        <span>কাস্টমার: {b.customer_phone}</span>
                      </div>

                      {b.driver_name ? (
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Car className="h-3.5 w-3.5 text-primary" />
                          <span>{b.driver_name} ({b.toto_number})</span>
                        </div>
                      ) : (
                        <span className="text-amber-500 font-medium">অ্যাসাইন অপেক্ষমাণ...</span>
                      )}
                    </div>

                    {/* Live Tracking Link */}
                    <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ভার্চুয়াল ডিসক্লেইমার সম্মত
                      </span>

                      <a
                        href={`/track/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        লাইভ ট্র্যাকিং পেজ
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
