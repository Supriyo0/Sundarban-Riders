"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  UsersRound,
  Search,
  RefreshCw,
  Phone,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Calendar,
  History,
  Unlock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface Customer {
  id: string;
  name?: string;
  phone: string;
  total_rides?: number;
  cancellation_count?: number;
  is_blocked?: boolean;
  created_at?: string;
  last_ride_at?: string;
}

export default function CustomersPage() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked" | "warned">("all");

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load customers";
      console.error("Error loading customers:", errorMsg);
      toast.error("গ্রাহক তালিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();

    const channel = supabase
      .channel("customers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customers" },
        () => {
          loadCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery);

      const isBlocked = (c.cancellation_count || 0) >= 3 || c.is_blocked;
      const isWarned = (c.cancellation_count || 0) > 0 && !isBlocked;

      if (filter === "blocked") return matchesSearch && isBlocked;
      if (filter === "warned") return matchesSearch && isWarned;
      if (filter === "active") return matchesSearch && !isBlocked;
      return matchesSearch;
    });
  }, [customers, searchQuery, filter]);

  const stats = useMemo(() => {
    const total = customers.length;
    const blocked = customers.filter(
      (c) => (c.cancellation_count || 0) >= 3 || c.is_blocked
    ).length;
    const warned = customers.filter(
      (c) => (c.cancellation_count || 0) > 0 && (c.cancellation_count || 0) < 3
    ).length;
    const active = total - blocked;
    return { total, active, blocked, warned };
  }, [customers]);

  // Reset Customer Strikes / Unblock
  const handleResetStrikes = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          cancellation_count: 0,
          is_blocked: false,
        })
        .eq("id", customer.id);

      if (error) throw error;

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id
            ? { ...c, cancellation_count: 0, is_blocked: false }
            : c
        )
      );

      toast.success(`✅ ${customer.phone}-এর বাতিল স্ট্রাইক রিসেট ও আনলক করা হয়েছে`);
    } catch (err: unknown) {
      toast.error("রিসেট করতে ব্যর্থ হয়েছে");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            👥 কাস্টমার ও বুকিং নিরাপত্তা (Customers Panel)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            গ্রাহকদের তালিকা, সম্পন্ন বুকিং এবং ৩-বার বাতিলকরণ নীতি (3-Strike Cancellation Rule)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadCustomers}
          className="border-border text-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          রিফ্রেশ
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">মোট কাস্টমার</span>
              <UsersRound className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">মোট ব্যবহারকারী</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-500">সক্রিয় কাস্টমার</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
            <p className="text-xs text-muted-foreground">বুকিং করার অনুমতি আছে</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-500">সতর্কতাপ্রাপ্ত (১-২ বাতিল)</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.warned}
            </div>
            <p className="text-xs text-muted-foreground">বাতিলের নোটিশ পেয়েছেন</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-500">স্বয়ংক্রিয় ব্লক্ড (৩+ বাতিল)</span>
              <Ban className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.blocked}
            </div>
            <p className="text-xs text-muted-foreground">সাময়িকভাবে স্থগিত</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="নাম বা ফোন নম্বর দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={filter === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className="text-xs"
              >
                সব ({stats.total})
              </Button>
              <Button
                variant={filter === "active" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("active")}
                className="text-xs text-emerald-500"
              >
                সক্রিয় ({stats.active})
              </Button>
              <Button
                variant={filter === "warned" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("warned")}
                className="text-xs text-amber-500"
              >
                সতর্কতাপ্রাপ্ত ({stats.warned})
              </Button>
              <Button
                variant={filter === "blocked" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter("blocked")}
                className="text-xs text-red-500"
              >
                ব্লক্ড ({stats.blocked})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">লোড হচ্ছে...</div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="border-dashed border-border bg-card py-12 text-center">
            <UsersRound className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-3 text-lg font-medium text-foreground">কোনো কাস্টমার পাওয়া যায়নি</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              হোয়াটসঅ্যাপে বুকিং শুরু হলে গ্রাহকরা এখানে তালিকাভুক্ত হবেন।
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const cancels = customer.cancellation_count || 0;
              const isBlocked = cancels >= 3 || customer.is_blocked;

              return (
                <Card
                  key={customer.id}
                  className={`border-border bg-card transition-all ${
                    isBlocked ? "border-red-500/40 bg-red-500/5" : ""
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-base">
                          {customer.name || "সুন্দরবন কাস্টমার"}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground font-mono">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isBlocked
                            ? "bg-red-500/10 text-red-500 border border-red-500/30"
                            : cancels > 0
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                        }`}
                      >
                        {isBlocked
                          ? "স্থগিত (Blocked)"
                          : cancels > 0
                          ? `${cancels}/৩ বাতিল`
                          : "ক্লিন রেকর্ড 🟢"}
                      </span>
                    </div>

                    {/* Strikes Progress Bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>বাতিল স্ট্রাইক কাউন্টার:</span>
                        <span className="font-bold text-foreground">{cancels} / ৩</span>
                      </div>
                      <div className="flex h-2 gap-1 rounded-full overflow-hidden bg-muted p-0.5">
                        <div
                          className={`h-full flex-1 rounded-full ${
                            cancels >= 1 ? "bg-amber-500" : "bg-muted-foreground/20"
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-full ${
                            cancels >= 2 ? "bg-amber-600" : "bg-muted-foreground/20"
                          }`}
                        />
                        <div
                          className={`h-full flex-1 rounded-full ${
                            cancels >= 3 ? "bg-red-600" : "bg-muted-foreground/20"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        মোট বুকিং: <span className="font-semibold text-foreground">{customer.total_rides || 0}</span>
                      </div>

                      {cancels > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResetStrikes(customer)}
                          className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <Unlock className="mr-1.5 h-3 w-3" />
                          স্ট্রাইক রিসেট ও আনলক
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
    </div>
  );
}
