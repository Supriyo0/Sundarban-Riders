"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MessageSquare,
  Save,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  Copy,
  Info,
  Car,
  Users,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

interface TemplateItem {
  key: string;
  nameBengali: string;
  category: "customer_ride" | "driver_ride" | "general" | "driver_onboarding";
  description: string;
  defaultText: string;
  variables: string[];
  currentText: string;
  isCustomized: boolean;
}

const CATEGORY_TABS = [
  { id: "all", label: "সব মেসেজ (All)", icon: MessageSquare },
  { id: "driver_ride", label: "🛺 চালক অ্যালার্ট (Driver)", icon: Car },
  { id: "customer_ride", label: "👥 যাত্রী লাইফসাইকেল (Passenger)", icon: Users },
  { id: "general", label: "📜 স্বাগতম ও ডিসক্লেইমার (General)", icon: ShieldCheck },
  { id: "driver_onboarding", label: "📋 চালক অনুমোদন ও কেওয়াইসি (KYC)", icon: FileCheck2 },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplateKey, setPreviewTemplateKey] = useState<string | null>(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp-templates");
      const data = await res.json();
      if (data?.templates) {
        setTemplates(data.templates);
        const map: Record<string, string> = {};
        data.templates.forEach((t: TemplateItem) => {
          map[t.key] = t.currentText;
        });
        setEditedTemplates(map);
        if (data.templates.length > 0 && !previewTemplateKey) {
          setPreviewTemplateKey(data.templates[0].key);
        }
      }
    } catch (err) {
      toast.error("হোয়াটসঅ্যাপ টেমপ্লেট লোড করতে ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleTextChange = (key: string, value: string) => {
    setEditedTemplates((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetToDefault = (key: string) => {
    const tpl = templates.find((t) => t.key === key);
    if (tpl) {
      setEditedTemplates((prev) => ({ ...prev, [key]: tpl.defaultText }));
      toast.info(`'${tpl.nameBengali}' ডিফল্ট লেখায় রিসেট করা হয়েছে`);
    }
  };

  const insertVariable = (key: string, variable: string) => {
    const current = editedTemplates[key] || "";
    setEditedTemplates((prev) => ({ ...prev, [key]: current + " " + variable }));
    toast.success(`'${variable}' ভেরিয়েবল যুক্ত করা হয়েছে`);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const payload = Object.entries(editedTemplates).map(([key, text]) => ({
        key,
        text,
      }));

      const res = await fetch("/api/whatsapp-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: payload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      toast.success(data.message || "সমস্ত হোয়াটসঅ্যাপ মেসেজ সফলভাবে সংরক্ষিত হয়েছে!");
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "সংরক্ষণে ত্রুটি হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchCat = activeTab === "all" || tpl.category === activeTab;
      const matchSearch =
        searchQuery === "" ||
        tpl.nameBengali.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.key.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [templates, activeTab, searchQuery]);

  const activePreview = useMemo(() => {
    if (!previewTemplateKey) return null;
    const tpl = templates.find((t) => t.key === previewTemplateKey);
    if (!tpl) return null;
    const text = editedTemplates[tpl.key] ?? tpl.currentText;

    // Replace demo values
    const demoReplaced = text
      .replaceAll("{{booking_id}}", "SR-8492")
      .replaceAll("{{booking_number}}", "SR-8492")
      .replaceAll("{{customer_name}}", "সন্দীপ মন্ডল")
      .replaceAll("{{customer_phone}}", "+91 98765 43210")
      .replaceAll("{{passenger_count}}", "3")
      .replaceAll("{{pickup_location}}", "কাকদ্বীপ স্টেশন রোড")
      .replaceAll("{{drop_location}}", "লট ৮ ফেরিঘাট")
      .replaceAll("{{distance_text}}", " [১.৫ কিমি দূরে]")
      .replaceAll("{{distance_km}}", "4.2")
      .replaceAll("{{final_fare}}", "51")
      .replaceAll("{{driver_name}}", "রাজেশ দাস")
      .replaceAll("{{driver_phone}}", "+91 95931 77885")
      .replaceAll("{{driver_id}}", "SR-DRV-042")
      .replaceAll("{{toto_number}}", "WB-96-T-8421")
      .replaceAll("{{start_otp}}", "8492")
      .replaceAll("{{strike_count}}", "1")
      .replaceAll("{{reason}}", " (জরুরি ব্যক্তিগত কারণ)")
      .replaceAll("{{name}}", "সন্দীপ বাবু")
      .replaceAll("{{helpline}}", "8348122122");

    return { ...tpl, demoReplaced, rawText: text };
  }, [previewTemplateKey, templates, editedTemplates]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-600">হোয়াটসঅ্যাপ মেসেজ টেমপ্লেট লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              হোয়াটসঅ্যাপ মেসেজ কন্ট্রোল সেন্টার
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            অ্যাডমিন প্যানেল থেকে সমস্ত অটোমেটিক হোয়াটসঅ্যাপ মেসেজ পাই টু পাই (Pai to Pai) এডিট ও কাস্টমাইজ করুন।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>সমস্ত পরিবর্তন সংরক্ষণ করুন</span>
          </Button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="মেসেজ খুঁজুন..."
            className="pl-9 rounded-2xl border-slate-200 bg-white text-xs h-10 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Layout: Template Editor List + WhatsApp Live Preview Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates Editor Column */}
        <div className="lg:col-span-7 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-2">
              <Info className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-sm">কোনো মেসেজ টেমপ্লেট খুঁজে পাওয়া যায়নি</p>
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const currentVal = editedTemplates[tpl.key] ?? tpl.currentText;
              const isSelected = previewTemplateKey === tpl.key;

              return (
                <Card
                  key={tpl.key}
                  className={`rounded-3xl border transition-all ${
                    isSelected
                      ? "ring-2 ring-emerald-500/40 border-emerald-400 shadow-md bg-white"
                      : "border-slate-200/90 hover:border-slate-300 bg-white"
                  }`}
                  onClick={() => setPreviewTemplateKey(tpl.key)}
                >
                  <CardHeader className="pb-3 pt-5 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-slate-900">
                            {tpl.nameBengali}
                          </CardTitle>
                          {tpl.isCustomized && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              কাস্টমাইজড
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                          {tpl.description}
                        </CardDescription>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetToDefault(tpl.key);
                        }}
                        className="text-xs text-slate-500 hover:text-red-600 rounded-xl gap-1 shrink-0 cursor-pointer"
                        title="অফিসিয়াল ডিফল্ট টেক্সট ফিরিয়ে আনুন"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ডিফল্ট</span>
                      </Button>
                    </div>

                    {/* Available Dynamic Variables Chips */}
                    {tpl.variables.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          ক্লিক করে ভেরিয়েবল যোগ করুন:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {tpl.variables.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                insertVariable(tpl.key, v);
                              }}
                              className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              + {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="px-5 pb-5">
                    <Textarea
                      rows={6}
                      value={currentVal}
                      onChange={(e) => handleTextChange(tpl.key, e.target.value)}
                      className="font-mono text-xs sm:text-sm bg-slate-50/70 border-slate-200 rounded-2xl resize-y focus:bg-white"
                      placeholder="মেসেজের টেক্সট লিখুন..."
                    />
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* WhatsApp Mobile Live Preview Simulator Column */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-4">
            <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                    SR
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">হোয়াটসঅ্যাপ লাইভ প্রিভিউ</h3>
                    <p className="text-[11px] text-emerald-400 font-medium">সুন্দরবন রাইডার্স বট ভিউ</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  REAL-TIME PREVIEW
                </span>
              </div>

              {activePreview ? (
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      নির্বাচিত: {activePreview.nameBengali}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activePreview.demoReplaced);
                        toast.success("প্রিভিউ টেক্সট কপি করা হয়েছে");
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>কপি</span>
                    </button>
                  </div>

                  {/* Simulated WhatsApp Chat Bubble */}
                  <div className="p-4 rounded-2xl bg-[#0b141a] border border-slate-800/80 shadow-inner">
                    <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none text-xs sm:text-[13px] leading-relaxed font-sans shadow-md whitespace-pre-wrap select-text break-words">
                      {activePreview.demoReplaced}
                      <div className="text-[10px] text-emerald-200 text-right mt-1.5 flex items-center justify-end gap-1 font-mono">
                        <span>১২:৩০ PM</span>
                        <CheckCircle2 className="w-3 h-3 text-cyan-300 inline" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      স্মার্ট ভেরিয়েবল নোট:
                    </p>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      বট পাঠানোর সময় <span className="font-mono text-emerald-300">{`{{booking_number}}`}</span>, <span className="font-mono text-emerald-300">{`{{customer_name}}`}</span>, <span className="font-mono text-emerald-300">{`{{start_otp}}`}</span> ইত্যাদি লাইভ ডেটা দ্বারা প্রতিস্থাপিত হবে।
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  যেকোনো একটি মেসেজে ক্লিক করে প্রিভিউ দেখুন
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
