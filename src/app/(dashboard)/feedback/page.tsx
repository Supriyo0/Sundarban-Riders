"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MessageSquareWarning,
  Lightbulb,
  Search,
  RefreshCw,
  Phone,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MessageCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import type { FeedbackItem } from "@/lib/whatsapp/feedback-store";

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"complaint" | "suggestion">("complaint");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/feedback");
      const json = await res.json();
      if (json.success && Array.isArray(json.all)) {
        setItems(json.all);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load feedback";
      console.error("Error loading feedback:", errorMsg);
      toast.error("তথ্য লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "pending" | "resolved") => {
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(newStatus === "resolved" ? "অভিযোগটি সমাধান হিসেবে চিহ্নিত হয়েছে" : "স্ট্যাটাস পরিবর্তন হয়েছে");
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      } else {
        toast.error("স্ট্যাটাস আপডেট ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভার ত্রুটি");
    }
  };

  const complaints = useMemo(() => items.filter((i) => i.type === "complaint"), [items]);
  const suggestions = useMemo(() => items.filter((i) => i.type === "suggestion"), [items]);

  const pendingComplaintsCount = useMemo(
    () => complaints.filter((c) => c.status === "pending").length,
    [complaints]
  );
  const resolvedComplaintsCount = useMemo(
    () => complaints.filter((c) => c.status === "resolved").length,
    [complaints]
  );

  const displayedItems = useMemo(() => {
    const list = activeTab === "complaint" ? complaints : suggestions;
    return list.filter((item) => {
      const matchesSearch =
        item.ticket?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.customer_phone?.includes(searchQuery) ||
        item.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.message?.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "complaint" && statusFilter !== "all") {
        return matchesSearch && item.status === statusFilter;
      }
      return matchesSearch;
    });
  }, [activeTab, complaints, suggestions, searchQuery, statusFilter]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquareWarning className="h-8 w-8 text-amber-500" />
            অভিযোগ ও পরামর্শ ব্যবস্থাপনা
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            গ্রাহকদের কাছ থেকে প্রাপ্ত অভিযোগ, সমস্যা ও উন্নয়নমূলক পরামর্শ আলাদাভাবে পর্যালোচনা ও সমাধান করুন।
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          রিফ্রেশ
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">অমীমাংসিত অভিযোগ</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingComplaintsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">জরুরি মনোযোগ প্রয়োজন</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">সমাধানকৃত অভিযোগ</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{resolvedComplaintsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">সফলভাবে নিষ্পত্তি</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">মোট অভিযোগ</CardTitle>
            <MessageSquareWarning className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{complaints.length}</div>
            <p className="text-xs text-muted-foreground mt-1">সর্বমোট প্রাপ্ত অভিযোগ</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">মূল্যবান পরামর্শ</CardTitle>
            <Lightbulb className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{suggestions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">উন্নয়নমূলক মতামত</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tab Navigation & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b pb-4">
          {/* Main Two Separate Tabs */}
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab("complaint");
                setStatusFilter("all");
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "complaint"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquareWarning className="h-4 w-4 text-amber-500" />
              <span>অভিযোগ ও অনুসন্ধান</span>
              {pendingComplaintsCount > 0 && (
                <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingComplaintsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("suggestion");
                setStatusFilter("all");
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "suggestion"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb className="h-4 w-4 text-purple-500" />
              <span>মতামত ও পরামর্শ</span>
              <span className="bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs px-2 py-0.5 rounded-full font-bold">
                {suggestions.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="টিকেট, ফোন নম্বর বা লেখা দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Status Sub-Filters for Complaints */}
        {activeTab === "complaint" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> ফিল্টার:
            </span>
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
              className="h-8 text-xs rounded-full"
            >
              সকল ({complaints.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "pending" ? "default" : "outline"}
              onClick={() => setStatusFilter("pending")}
              className="h-8 text-xs rounded-full"
            >
              অমীমাংসিত ({pendingComplaintsCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "resolved" ? "default" : "outline"}
              onClick={() => setStatusFilter("resolved")}
              className="h-8 text-xs rounded-full"
            >
              সমাধানকৃত ({resolvedComplaintsCount})
            </Button>
          </div>
        )}

        {/* Content List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">তথ্য লোড হচ্ছে...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              {activeTab === "complaint" ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                  <h3 className="text-lg font-semibold">কোনো অমীমাংসিত অভিযোগ নেই</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    গ্রাহকদের সকল অভিযোগ সমাধান করা হয়েছে অথবা কোনো নতুন অভিযোগ আসেনি।
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="h-12 w-12 text-purple-400 mb-3" />
                  <h3 className="text-lg font-semibold">এখনও কোনো পরামর্শ জমা পড়েনি</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    ট্রিপ শেষ হওয়ার পর গ্রাহকরা যে পরামর্শ বা মতামত পাঠাবেন তা এখানে প্রদর্শিত হবে।
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {displayedItems.map((item) => {
              const dateStr = item.created_at
                ? new Date(item.created_at).toLocaleString("bn-BD", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "অজানা তারিখ";

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden transition-all hover:shadow-md ${
                    item.type === "complaint" && item.status === "pending"
                      ? "border-amber-500/40 bg-card"
                      : "border-border bg-card"
                  }`}
                >
                  <CardHeader className="pb-3 bg-muted/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm px-2.5 py-1 rounded bg-muted text-foreground border">
                          {item.ticket}
                        </span>

                        {item.type === "complaint" ? (
                          item.status === "resolved" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" /> সমাধান হয়েছে
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                              <Clock className="h-3.5 w-3.5" /> অমীমাংসিত
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/30">
                            <Lightbulb className="h-3.5 w-3.5" /> গ্রাহক পরামর্শ
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {/* Message Body */}
                    <div className="bg-muted/40 p-4 rounded-xl border text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      "{item.message}"
                    </div>

                    {/* Customer Info & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">গ্রাহক:</span>
                        <span className="font-semibold text-foreground">
                          {item.customer_name || "সুন্দরবন যাত্রী"}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          ({item.customer_phone})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Call Customer Button */}
                        <a
                          href={`tel:${item.customer_phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 text-blue-500" />
                          কল করুন
                        </a>

                        {/* WhatsApp Customer Button */}
                        <a
                          href={`https://wa.me/${item.customer_phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors text-emerald-600"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>

                        {/* Complaint Resolution Toggle */}
                        {item.type === "complaint" && (
                          item.status === "pending" ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1.5"
                              onClick={() => handleUpdateStatus(item.id, "resolved")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              সমাধান চিহ্নিত করুন
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5 text-amber-600"
                              onClick={() => handleUpdateStatus(item.id, "pending")}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              পুনরায় অমীমাংসিত করুন
                            </Button>
                          )
                        )}
                      </div>
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
