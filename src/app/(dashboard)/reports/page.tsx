"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Calendar,
  Download,
  IndianRupee,
  Car,
  TrendingUp,
  Clock,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface AuditBooking {
  id: string;
  booking_no?: string;
  customer_phone: string;
  driver_name?: string;
  toto_number?: string;
  pickup_location?: string;
  drop_location?: string;
  distance_km?: number;
  fare?: number;
  status: string;
  created_at: string;
  cancellation_reason?: string;
}

export default function ReportsAuditPage() {
  const supabase = createClient();

  const [bookings, setBookings] = useState<AuditBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "all">("today");

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setBookings(data || []);
    } catch (err: unknown) {
      console.error("Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered by Time
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = today - 30 * 24 * 60 * 60 * 1000;

    return bookings.filter((b) => {
      const itemTime = new Date(b.created_at).getTime();
      if (timeFilter === "today") return itemTime >= today;
      if (timeFilter === "week") return itemTime >= weekAgo;
      if (timeFilter === "month") return itemTime >= monthAgo;
      return true;
    });
  }, [bookings, timeFilter]);

  // Financial Summary
  const analytics = useMemo(() => {
    const total = filteredBookings.length;
    const completed = filteredBookings.filter((b) => b.status === "completed");
    const cancelled = filteredBookings.filter((b) => b.status === "cancelled");

    const grossRevenue = completed.reduce((sum, b) => sum + (b.fare || 0), 0);
    const techFees = completed.length * 5; // ₹5 platform tech fee per completed ride
    const driverPayouts = Math.max(0, grossRevenue - techFees);
    const avgFare = completed.length > 0 ? Math.round(grossRevenue / completed.length) : 0;

    return {
      total,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
      grossRevenue,
      techFees,
      driverPayouts,
      avgFare,
    };
  }, [filteredBookings]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error("এক্সপোর্ট করার জন্য কোনো তথ্য নেই");
      return;
    }

    const headers = [
      "Booking ID",
      "Timestamp",
      "Customer Phone",
      "Driver Name",
      "Toto Number",
      "Pickup Location",
      "Drop Location",
      "Distance (KM)",
      "Fare (INR)",
      "Status",
    ];

    const rows = filteredBookings.map((b) => [
      b.booking_no || b.id,
      new Date(b.created_at).toLocaleString(),
      b.customer_phone,
      b.driver_name || "N/A",
      b.toto_number || "N/A",
      `"${(b.pickup_location || "").replace(/"/g, '""')}"`,
      `"${(b.drop_location || "").replace(/"/g, '""')}"`,
      b.distance_km || 0,
      b.fare || 0,
      b.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sundarban_riders_report_${timeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("✅ রিপোর্ট CSV ফাইল সফলভাবে ডাউনলোড হয়েছে!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            রিয়েল-টাইম অডিট ও রিপোর্ট (Live Audit & Reports)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            প্রতিটি সেকেন্ডের বুকিং বিবরণ, দৈনিক ট্রিপ ভলিউম এবং আর্থিক হিসাব-নিকাশ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="border-border text-foreground hover:bg-muted"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            রিফ্রেশ
          </Button>

          <Button
            onClick={handleExportCSV}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV ডাউনলোড
          </Button>
        </div>
      </div>

      {/* Time Filter Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mr-2">
          <Filter className="h-3.5 w-3.5" />
          সময়সীমা:
        </span>
        <Button
          variant={timeFilter === "today" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("today")}
          className="text-xs"
        >
          আজকের রিপোর্ট
        </Button>
        <Button
          variant={timeFilter === "week" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("week")}
          className="text-xs"
        >
          গত ৭ দিন
        </Button>
        <Button
          variant={timeFilter === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("month")}
          className="text-xs"
        >
          গত ৩০ দিন
        </Button>
        <Button
          variant={timeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTimeFilter("all")}
          className="text-xs"
        >
          সর্বমোট হিসেব
        </Button>
      </div>

      {/* Financial Analytics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-500">মোট সংগৃহীত ভাড়া</span>
              <IndianRupee className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              ₹{analytics.grossRevenue.toLocaleString()}.00
            </div>
            <p className="text-xs text-muted-foreground">{analytics.completedCount} টি সফল রাইড</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-500">চালকদের প্রাপ্য (Payouts)</span>
              <Car className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-500">
              ₹{analytics.driverPayouts.toLocaleString()}.00
            </div>
            <p className="text-xs text-muted-foreground">চালকদের নিট আয়</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-500">প্ল্যাটফর্ম টেক ফি</span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-500">
              ₹{analytics.techFees.toLocaleString()}.00
            </div>
            <p className="text-xs text-muted-foreground">প্ল্যাটফর্ম রক্ষণাবেক্ষণ ফি</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">গড় ট্রিপ ভাড়া</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              ₹{analytics.avgFare}.00
            </div>
            <p className="text-xs text-muted-foreground">প্রতি রাইডের গড় মান</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Second-by-Second Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">প্রতি সেকেন্ডের রাইড ও ইভেন্ট লগ</CardTitle>
          <CardDescription className="text-muted-foreground">
            হোয়াটসঅ্যাপের সমস্ত রাইড রিকোয়েস্ট ও ট্রানজ্যাকশন ডাটাবেসে স্থায়ীভাবে সংরক্ষিত রয়েছে।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">বুকিং আইডি ও সময়</th>
                  <th className="px-4 py-3">কাস্টমার</th>
                  <th className="px-4 py-3">চালক ও টোটো</th>
                  <th className="px-4 py-3">রুট (পিকআপ → ড্রপ)</th>
                  <th className="px-4 py-3 text-right">দূরত্ব ও ভাড়া</th>
                  <th className="px-4 py-3 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      লোড হচ্ছে...
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      এই সময়সীমার মধ্যে কোনো রাইড তথ্য পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-foreground">
                          #{b.booking_no || b.id.slice(0, 8)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.created_at).toLocaleString("bn-IN", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-mono text-foreground">
                        {b.customer_phone}
                      </td>

                      <td className="px-4 py-3">
                        {b.driver_name ? (
                          <div>
                            <span className="font-medium text-foreground">{b.driver_name}</span>
                            <p className="text-xs text-muted-foreground font-mono">{b.toto_number}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">অ্যাসাইন করা হয়নি</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs max-w-xs">
                        <p className="truncate text-foreground font-medium">📍 {b.pickup_location || "পিকআপ পয়েন্ট"}</p>
                        <p className="truncate text-muted-foreground mt-0.5">🏁 {b.drop_location || "গন্তব্য"}</p>
                      </td>

                      <td className="px-4 py-3 text-right font-mono">
                        <span className="font-bold text-emerald-500">₹{b.fare || 0}.00</span>
                        <p className="text-xs text-muted-foreground">{b.distance_km || 0} কিমি</p>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            b.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : b.status === "cancelled"
                              ? "bg-red-500/10 text-red-500"
                              : b.status === "searching"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {b.status === "completed"
                            ? "সম্পন্ন"
                            : b.status === "cancelled"
                            ? "বাতিল"
                            : b.status === "searching"
                            ? "খোঁজা হচ্ছে"
                            : "চলমান"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
