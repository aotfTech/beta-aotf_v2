"use client";

import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils/display-date";
import { reportClientError } from "@/lib/client-report-error";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import AdminSearchBar, {
  FilterConfig,
} from "@/components/admin/ui/AdminSearchBar";
import DateChips from "@/components/admin/ui/DateChips";
import {
  adListFilterConfigs,
  adStatuses,
  adPlacements,
  adTypes,
} from "@/lib/validations/forms";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Eye,
  MousePointerClick,
  TrendingUp,
  Megaphone,
  Calendar,
  ExternalLink,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ad {
  id: string;
  title: string;
  adType: "image" | "text" | "html";
  placement: string;
  imageUrl?: string;
  content?: string;
  targetUrl?: string;
  advertiser: string;
  status: "active" | "inactive" | "scheduled" | "expired";
  startDate?: string;
  endDate?: string;
  priority: number;
  impressions: number;
  clicks: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Analytics {
  totalAds: number;
  activeAds: number;
  scheduledAds: number;
  expiredAds: number;
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
}

type Tab = "list" | "analytics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapApiAd(a: Record<string, unknown>): Ad {
  return {
    id: (a.adId as string) ?? (a._id as string),
    title: a.title as string,
    adType: a.adType as Ad["adType"],
    placement: a.placement as string,
    imageUrl: a.imageUrl as string | undefined,
    content: a.content as string | undefined,
    targetUrl: a.targetUrl as string | undefined,
    advertiser: a.advertiser as string,
    status: a.status as Ad["status"],
    startDate: a.startDate as string | undefined,
    endDate: a.endDate as string | undefined,
    priority: (a.priority as number) ?? 0,
    impressions: (a.impressions as number) ?? 0,
    clicks: (a.clicks as number) ?? 0,
    notes: a.notes as string | undefined,
    createdAt: a.createdAt as string,
    updatedAt: a.updatedAt as string | undefined,
  };
}

const statusColorMap: Record<Ad["status"], "success" | "default" | "warning" | "danger"> = {
  active: "success",
  inactive: "default",
  scheduled: "warning",
  expired: "danger",
};

const placementLabelMap: Record<string, string> = {
  home_banner: "Home Banner",
  sidebar: "Sidebar",
  feed_inline: "Feed Inline",
  popup: "Popup",
  footer: "Footer",
};

function formatDate(d?: string): string {
  if (!d) return "—";
  return formatDisplayDate(d);
}

function formatDateTime(d?: string): string {
  if (!d) return "—";
  return formatDisplayDateTime(d);
}

function computeCtr(impressions: number, clicks: number): string {
  if (impressions === 0) return "0%";
  return ((clicks / impressions) * 100).toFixed(2) + "%";
}


// ─── Default form state ───────────────────────────────────────────────────────

const emptyForm = {
  title: "",
  adType: "image" as Ad["adType"],
  placement: "home_banner",
  imageUrl: "",
  content: "",
  targetUrl: "",
  advertiser: "",
  status: "inactive" as Ad["status"],
  startDate: "",
  endDate: "",
  priority: "0",
  notes: "",
};

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AdsPage() {
  // ─── Tab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("list");

  // ─── Data state ─────────────────────────────────────────────────────────
  const [ads, setAds] = useState<Ad[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ─── Filter state ───────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const initialSearch = new URLSearchParams(window.location.search).get("search");
    if (initialSearch) setSearchTerm(initialSearch);
  }, []);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlacement, setFilterPlacement] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedDateChip, setSelectedDateChip] = useState("");

  // ─── Create/Edit form state ─────────────────────────────────────────────
  const [form, setForm] = useState({ ...emptyForm });
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);

  // ─── Delete modal ───────────────────────────────────────────────────────
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<Ad | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Debounce search ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  // ─── Fetch ads ──────────────────────────────────────────────────────────
  const fetchAds = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("analytics", "true");
      params.set("sync", "true");
      if (filterStatus) params.set("status", filterStatus);
      if (filterPlacement) params.set("placement", filterPlacement);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/v1/admin/ads?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error || `Failed to fetch ads (${res.status})`;
        if (res.status === 401 || res.status === 403) {
          setFetchError(message);
          return;
        }
        throw new Error(message);
      }
      const data = await res.json();
      setAds((data.ads ?? []).map(mapApiAd));
      if (data.analytics) setAnalytics(data.analytics);
    } catch (err) {
      reportClientError(err, { feature: "admin-ads" });
      setFetchError(
        err instanceof Error ? err.message : "Failed to fetch ads",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterPlacement, debouncedSearch]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // ─── Client-side date filtering ────────────────────────────────────────
  const filteredAds = useMemo(() => {
    let filtered = [...ads];

    if (selectedYear || selectedMonth || selectedDay) {
      filtered = filtered.filter((ad) => {
        if (!ad.createdAt) return true;
        const d = new Date(ad.createdAt);
        if (selectedYear && d.getFullYear() !== parseInt(selectedYear, 10)) return false;
        if (selectedMonth && d.getMonth() + 1 !== parseInt(selectedMonth, 10)) return false;
        if (selectedDay && d.getDate() !== parseInt(selectedDay, 10)) return false;
        return true;
      });
    }

    if (selectedDateChip) {
      filtered = filtered.filter((ad) => {
        if (!ad.createdAt) return false;
        return ad.createdAt.slice(0, 10) === selectedDateChip;
      });
    }

    return filtered;
  }, [ads, selectedYear, selectedMonth, selectedDay, selectedDateChip]);

  // ─── Filter handlers ───────────────────────────────────────────────────
  const filterValues: Record<string, string> = {
    status: filterStatus,
    placement: filterPlacement,
    year: selectedYear,
    month: selectedMonth,
    day: selectedDay,
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") setFilterStatus(value);
    else if (key === "placement") setFilterPlacement(value);
    else if (key === "year") setSelectedYear(value);
    else if (key === "month") setSelectedMonth(value);
    else if (key === "day") setSelectedDay(value);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("");
    setFilterPlacement("");
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedDay("");
    setSelectedDateChip("");
  };

  // ─── Form handlers ─────────────────────────────────────────────────────
  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openCreateForm = () => {
    setEditingAd(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = (ad: Ad) => {
    setEditingAd(ad);
    setForm({
      title: ad.title,
      adType: ad.adType,
      placement: ad.placement,
      imageUrl: ad.imageUrl ?? "",
      content: ad.content ?? "",
      targetUrl: ad.targetUrl ?? "",
      advertiser: ad.advertiser,
      status: ad.status,
      startDate: ad.startDate ? new Date(ad.startDate).toISOString().slice(0, 16) : "",
      endDate: ad.endDate ? new Date(ad.endDate).toISOString().slice(0, 16) : "",
      priority: String(ad.priority),
      notes: ad.notes ?? "",
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.advertiser.trim()) errors.advertiser = "Advertiser is required";
    if (form.adType === "image" && !form.imageUrl.trim() && !editingAd)
      errors.imageUrl = "Image URL is required for image ads";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate))
      errors.endDate = "End date must be after start date";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      adType: form.adType,
      placement: form.placement,
      advertiser: form.advertiser.trim(),
      status: form.status,
      priority: parseInt(form.priority, 10) || 0,
    };
    if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();
    if (form.content.trim()) payload.content = form.content.trim();
    if (form.targetUrl.trim()) payload.targetUrl = form.targetUrl.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (form.startDate) payload.startDate = new Date(form.startDate).toISOString();
    if (form.endDate) payload.endDate = new Date(form.endDate).toISOString();

    try {
      const isEditing = !!editingAd;
      const url = isEditing
        ? `/api/v1/admin/ads/${editingAd!.id}`
        : `/api/v1/admin/ads`;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} ad`);
      }

      addToast({
        description: `Ad ${isEditing ? "updated" : "created"} successfully!`,
        color: "success",
      });
      setIsFormOpen(false);
      setEditingAd(null);
      setForm({ ...emptyForm });
      fetchAds();
    } catch (err) {
      reportClientError(err, { feature: "admin-ads" });
      addToast({
        description: err instanceof Error ? err.message : "Failed to save ad",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Delete handler ─────────────────────────────────────────────────────
  const handleDeleteClick = (ad: Ad) => {
    setDeleteTarget(ad);
    openDelete();
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/v1/admin/ads/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete ad");
      }
      addToast({ description: "Ad deleted successfully!", color: "success" });
      closeDelete();
      setDeleteTarget(null);
      fetchAds();
    } catch (err) {
      reportClientError(err, { feature: "admin-ads" });
      addToast({
        description: err instanceof Error ? err.message : "Failed to delete ad",
        color: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  // ─── Status toggle handler ─────────────────────────────────────────────
  const toggleStatus = async (ad: Ad) => {
    const newStatus = ad.status === "active" ? "inactive" : "active";

    try {
      const res = await fetch(`/api/v1/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }
      addToast({
        description: `Ad ${newStatus === "active" ? "activated" : "deactivated"}`,
        color: "success",
      });
      fetchAds();
    } catch (err) {
      reportClientError(err, { feature: "admin-ads" });
      addToast({
        description: err instanceof Error ? err.message : "Failed to update status",
        color: "danger",
      });
    }
  };

  // ─── Copy Ad ID ─────────────────────────────────────────────────────────
  const copyAdId = (id: string) => {
    navigator.clipboard.writeText(id);
    addToast({ description: `Copied ${id}`, color: "primary" });
  };
  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-default-900">Ad Management</h1>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          onPress={openCreateForm}
        >
          New Ad
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={activeTab === "list" ? "solid" : "flat"}
          color={activeTab === "list" ? "primary" : "default"}
          startContent={<Megaphone size={16} />}
          onPress={() => setActiveTab("list")}
        >
          All Ads
        </Button>
        <Button
          size="sm"
          variant={activeTab === "analytics" ? "solid" : "flat"}
          color={activeTab === "analytics" ? "primary" : "default"}
          startContent={<BarChart3 size={16} />}
          onPress={() => setActiveTab("analytics")}
        >
          Analytics
        </Button>
      </div>

      {/* ────────────── Analytics Tab ────────────── */}
      {activeTab === "analytics" && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Analytics Summary Cards */}
            {analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AnalyticCard
                  label="Total Ads"
                  value={analytics.totalAds}
                  icon={<Megaphone size={20} />}
                  color="text-primary"
                />
                <AnalyticCard
                  label="Active Now"
                  value={analytics.activeAds}
                  icon={<TrendingUp size={20} />}
                  color="text-success"
                />
                <AnalyticCard
                  label="Total Impressions"
                  value={analytics.totalImpressions.toLocaleString()}
                  icon={<Eye size={20} />}
                  color="text-warning"
                />
                <AnalyticCard
                  label="Total Clicks"
                  value={analytics.totalClicks.toLocaleString()}
                  icon={<MousePointerClick size={20} />}
                  color="text-secondary"
                />
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}

            {analytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="bg-linear-to-br from-success-50 to-success-100 dark:from-success-900/20 dark:to-success-800/10">
                  <CardBody className="text-center py-6">
                    <p className="text-sm text-success-600 dark:text-success-400 mb-1">Overall CTR</p>
                    <p className="text-3xl font-bold text-success-700 dark:text-success-300">
                      {analytics.overallCtr}%
                    </p>
                  </CardBody>
                </Card>
                <Card className="bg-linear-to-br from-warning-50 to-warning-100 dark:from-warning-900/20 dark:to-warning-800/10">
                  <CardBody className="text-center py-6">
                    <p className="text-sm text-warning-600 dark:text-warning-400 mb-1">Scheduled</p>
                    <p className="text-3xl font-bold text-warning-700 dark:text-warning-300">
                      {analytics.scheduledAds}
                    </p>
                  </CardBody>
                </Card>
                <Card className="bg-linear-to-br from-danger-50 to-danger-100 dark:from-danger-900/20 dark:to-danger-800/10">
                  <CardBody className="text-center py-6">
                    <p className="text-sm text-danger-600 dark:text-danger-400 mb-1">Expired</p>
                    <p className="text-3xl font-bold text-danger-700 dark:text-danger-300">
                      {analytics.expiredAds}
                    </p>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Per-Ad Analytics Table */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Per-Ad Performance</h3>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-divider bg-default-50">
                        <th className="text-left px-4 py-3 font-medium">Ad</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Impressions</th>
                        <th className="text-right px-4 py-3 font-medium">Clicks</th>
                        <th className="text-right px-4 py-3 font-medium">CTR</th>
                        <th className="text-left px-4 py-3 font-medium">Placement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAds.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-default-400">
                            No ads found
                          </td>
                        </tr>
                      ) : (
                        filteredAds.map((ad) => (
                          <tr key={ad.id} className="border-b border-divider hover:bg-default-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-default-900">{ad.title}</p>
                              <p className="text-xs text-default-400">{ad.id}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Chip size="sm" color={statusColorMap[ad.status]} variant="flat" className="capitalize">
                                {ad.status}
                              </Chip>
                            </td>
                            <td className="text-right px-4 py-3 font-mono">{ad.impressions.toLocaleString()}</td>
                            <td className="text-right px-4 py-3 font-mono">{ad.clicks.toLocaleString()}</td>
                            <td className="text-right px-4 py-3 font-mono">{computeCtr(ad.impressions, ad.clicks)}</td>
                            <td className="px-4 py-3">
                              <Chip size="sm" variant="bordered" className="capitalize">
                                {placementLabelMap[ad.placement] ?? ad.placement}
                              </Chip>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ────────────── List Tab ────────────── */}
      {activeTab === "list" && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Search + Filter Bar */}
            <AdminSearchBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search by title, advertiser, ID…"
              filters={adListFilterConfigs as unknown as FilterConfig[]}
              filterValues={filterValues}
              onFilterChange={handleFilterChange}
              resultCount={filteredAds.length}
              resultLabel="ad"
              onClearAll={clearFilters}
            />

            {/* Date quick-filter chips */}
            <DateChips selected={selectedDateChip} onChange={setSelectedDateChip} />

            {/* Loading */}
            {isLoading && (
              <div className="flex justify-center py-20">
                <Spinner size="lg" />
              </div>
            )}

            {/* Error */}
            {fetchError && !isLoading && (
              <Card className="bg-danger-50">
                <CardBody className="py-10 text-center">
                  <p className="text-danger">{fetchError}</p>
                  <Button size="sm" className="mt-3" onPress={fetchAds}>
                    Retry
                  </Button>
                </CardBody>
              </Card>
            )}

            {/* Ad Cards Grid */}
            {!isLoading && !fetchError && (
              <>
                {filteredAds.length === 0 ? (
                  <Card>
                    <CardBody className="py-14 text-center space-y-3">
                      <Megaphone size={48} className="mx-auto text-default-300" />
                      <p className="text-default-500">No ads found. Create your first ad!</p>
                    </CardBody>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAds.map((ad) => (
                      <AdCard
                        key={ad.id}
                        ad={ad}
                        onEdit={openEditForm}
                        onDelete={handleDeleteClick}
                        onToggleStatus={toggleStatus}
                        onCopyId={copyAdId}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ────────────── Create / Edit Modal ────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAd(null); }}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            {editingAd ? `Edit Ad — ${editingAd.id}` : "Create New Ad"}
          </ModalHeader>
          <ModalBody className="gap-4">
            {/* Row 1: Title + Advertiser */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Title"
                placeholder="e.g. Summer Sale Banner"
                value={form.title}
                onValueChange={(v) => updateForm("title", v)}
                isRequired
                variant="bordered"
                isInvalid={!!formErrors.title}
                errorMessage={formErrors.title}
              />
              <Input
                label="Advertiser"
                placeholder="e.g. Byju's"
                value={form.advertiser}
                onValueChange={(v) => updateForm("advertiser", v)}
                isRequired
                variant="bordered"
                isInvalid={!!formErrors.advertiser}
                errorMessage={formErrors.advertiser}
              />
            </div>

            {/* Row 2: Type + Placement + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="Ad Type"
                selectedKeys={[form.adType]}
                onChange={(e) => updateForm("adType", e.target.value)}
                variant="bordered"
                isRequired
              >
                {adTypes.map((t) => (
                  <SelectItem key={t.key}>{t.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Placement"
                selectedKeys={[form.placement]}
                onChange={(e) => updateForm("placement", e.target.value)}
                variant="bordered"
                isRequired
              >
                {adPlacements.map((p) => (
                  <SelectItem key={p.key}>{p.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Status"
                selectedKeys={[form.status]}
                onChange={(e) => updateForm("status", e.target.value)}
                variant="bordered"
              >
                {adStatuses.map((s) => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
            </div>

            {/* Row 3: URLs */}
            {form.adType === "image" && (
              <Input
                label="Image URL"
                placeholder="https://example.com/banner.jpg"
                value={form.imageUrl}
                onValueChange={(v) => updateForm("imageUrl", v)}
                variant="bordered"
                isInvalid={!!formErrors.imageUrl}
                errorMessage={formErrors.imageUrl}
              />
            )}
            <Input
              label="Target URL (Click-through)"
              placeholder="https://example.com/landing"
              value={form.targetUrl}
              onValueChange={(v) => updateForm("targetUrl", v)}
              variant="bordered"
              startContent={<ExternalLink size={16} className="text-default-400" />}
            />

            {/* Row 4: Content (for text/html) */}
            {(form.adType === "text" || form.adType === "html") && (
              <Textarea
                label={form.adType === "html" ? "HTML Content" : "Ad Copy"}
                placeholder={form.adType === "html" ? "<div>Your HTML here</div>" : "Write your ad text…"}
                value={form.content}
                onValueChange={(v) => updateForm("content", v)}
                variant="bordered"
                minRows={3}
              />
            )}

            {/* Row 5: Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Start Date"
                type="datetime-local"
                value={form.startDate}
                onValueChange={(v) => updateForm("startDate", v)}
                variant="bordered"
                startContent={<Calendar size={16} className="text-default-400" />}
              />
              <Input
                label="End Date"
                type="datetime-local"
                value={form.endDate}
                onValueChange={(v) => updateForm("endDate", v)}
                variant="bordered"
                isInvalid={!!formErrors.endDate}
                errorMessage={formErrors.endDate}
                startContent={<Calendar size={16} className="text-default-400" />}
              />
            </div>

            {/* Row 6: Priority + Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Priority"
                type="number"
                value={form.priority}
                onValueChange={(v) => updateForm("priority", v)}
                variant="bordered"
                description="0-100, higher = shown first"
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Notes (internal)"
                  placeholder="Internal notes about this ad…"
                  value={form.notes}
                  onValueChange={(v) => updateForm("notes", v)}
                  variant="bordered"
                  minRows={2}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => { setIsFormOpen(false); setEditingAd(null); }}
              isDisabled={isSaving}
            >
              Cancel
            </Button>
            <Button color="primary" onPress={handleSave} isLoading={isSaving}>
              {editingAd ? "Update Ad" : "Create Ad"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ────────────── Delete Confirmation Modal ────────────── */}
      <Modal isOpen={isDeleteOpen} onClose={closeDelete}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={22} className="text-danger" />
              <span>Delete Ad</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to delete this ad?
            </p>
            {deleteTarget && (
              <Card className="mt-2">
                <CardBody className="gap-1">
                  <p className="text-sm">
                    <span className="font-semibold">Ad ID:</span>{" "}
                    <span className="text-primary">{deleteTarget.id}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Title:</span> {deleteTarget.title}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Advertiser:</span> {deleteTarget.advertiser}
                  </p>
                </CardBody>
              </Card>
            )}
            <p className="text-sm text-danger-500 mt-2">
              This action cannot be undone. All analytics data for this ad will be lost.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeDelete} isDisabled={isDeleting}>
              Cancel
            </Button>
            <Button color="danger" onPress={confirmDelete} isLoading={isDeleting}>
              Delete Ad
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnalyticCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardBody className="flex flex-row items-center gap-3 py-4">
        <div className={`p-2 rounded-xl bg-default-100 ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-default-500">{label}</p>
          <p className="text-xl font-bold text-default-900">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function AdCard({
  ad,
  onEdit,
  onDelete,
  onToggleStatus,
  onCopyId,
}: {
  ad: Ad;
  onEdit: (ad: Ad) => void;
  onDelete: (ad: Ad) => void;
  onToggleStatus: (ad: Ad) => void;
  onCopyId: (id: string) => void;
}) {
  const isExpired = ad.status === "expired";

  return (
    <Card className="border border-divider/50 hover:shadow-md transition-shadow">
      <CardHeader className="flex justify-between items-start pb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Chip size="sm" color={statusColorMap[ad.status]} variant="flat" className="capitalize">
              {ad.status}
            </Chip>
            <Chip size="sm" variant="bordered" className="capitalize">
              {ad.adType}
            </Chip>
          </div>
          <h3 className="text-base font-semibold text-default-900 truncate">{ad.title}</h3>
          <button
            onClick={() => onCopyId(ad.id)}
            className="flex items-center gap-1 text-xs text-default-400 hover:text-primary transition-colors mt-0.5"
          >
            <Copy size={10} />
            {ad.id}
          </button>
        </div>
      </CardHeader>

      <CardBody className="pt-1 pb-2 space-y-2">
        {/* Info rows */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-default-500">Advertiser</span>
            <span className="font-medium text-default-800">{ad.advertiser}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-default-500">Placement</span>
            <Chip size="sm" variant="dot" color="primary">
              {placementLabelMap[ad.placement] ?? ad.placement}
            </Chip>
          </div>
          <div className="flex justify-between">
            <span className="text-default-500">Priority</span>
            <span className="font-mono text-default-700">{ad.priority}</span>
          </div>
        </div>

        {/* Schedule dates */}
        {(ad.startDate || ad.endDate) && (
          <div className="rounded-lg bg-default-50 p-2 text-xs space-y-0.5">
            <div className="flex items-center gap-1 text-default-500">
              <Calendar size={12} />
              <span>Schedule</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">Start</span>
              <span className="font-medium">{formatDateTime(ad.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-default-600">End</span>
              <span className="font-medium">{formatDateTime(ad.endDate)}</span>
            </div>
          </div>
        )}

        {/* Analytics mini row */}
        <div className="flex items-center gap-4 text-xs text-default-500 pt-1">
          <div className="flex items-center gap-1">
            <Eye size={12} />
            <span>{ad.impressions.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <MousePointerClick size={12} />
            <span>{ad.clicks.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp size={12} />
            <span>{computeCtr(ad.impressions, ad.clicks)}</span>
          </div>
        </div>

        {/* Target URL */}
        {ad.targetUrl && (
          <a
            href={ad.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
          >
            <ExternalLink size={12} />
            {ad.targetUrl}
          </a>
        )}

        {/* Created at */}
        <p className="text-xs text-default-400">Created {formatDate(ad.createdAt)}</p>
      </CardBody>

      <CardFooter className="gap-2 pt-0 border-t border-divider/50">
        {!isExpired && (
          <Button
            size="sm"
            variant="flat"
            color={ad.status === "active" ? "warning" : "success"}
            onPress={() => onToggleStatus(ad)}
            className="flex-1"
          >
            {ad.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        )}
        <Button
          size="sm"
          variant="flat"
          color="primary"
          startContent={<Pencil size={14} />}
          onPress={() => onEdit(ad)}
          className="flex-1"
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="flat"
          color="danger"
          isIconOnly
          onPress={() => onDelete(ad)}
        >
          <Trash2 size={14} />
        </Button>
      </CardFooter>
    </Card>
  );
}
