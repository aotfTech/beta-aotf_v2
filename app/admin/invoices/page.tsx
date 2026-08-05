"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  RefreshCw,
  Trash2,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  CalendarDays,
  User,
  Phone,
  Hash,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  SlidersHorizontal,
  Eye,
  Share2,
  Copy,
  Check,
  PencilLine,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { shareOnWhatsApp } from "@/lib/utils/share";

interface PartialPayment {
  amountPaid: number;
  percentagePaid: number;
  amountDue: number;
}

interface Invoice {
  _id: string;
  invoiceId: string;
  version: number;
  isLatest: boolean;
  recipient: { name: string; address?: string; phone?: string };
  assignedTeacher?: { name: string; phone?: string };
  amount: {
    currency: string;
    grandTotal: number;
    subTotal: number;
    taxAmount: number;
    taxPercentage: number;
  };
  breakdown: {
    items: {
      name: string;
      description?: string;
      quantity: number;
      unitAmount: number;
      total: number;
    }[];
    notes?: string;
  };
  paymentStatus: "paid" | "unpaid" | "partial";
  partialPayment?: PartialPayment;
  paymentDate?: string;
  invoiceDate: string;
  dueDate?: string;
  postId?: string;
  projectId?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    color: "success" as const,
    icon: CheckCircle2,
    bg: "bg-success-50",
    text: "text-success-700",
  },
  unpaid: {
    label: "Unpaid",
    color: "warning" as const,
    icon: Clock,
    bg: "bg-warning-50",
    text: "text-warning-700",
  },
  partial: {
    label: "Partial",
    color: "secondary" as const,
    icon: AlertCircle,
    bg: "bg-secondary-50",
    text: "text-secondary-700",
  },
};

function fmt(date?: string) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InvoiceCard({
  invoice,
  onDelete,
  onStatusUpdate,
  onShare,
}: {
  invoice: Invoice;
  onDelete: (id: string) => void;
  onStatusUpdate: (inv: Invoice) => void;
  onShare: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[invoice.paymentStatus];
  const Icon = cfg.icon;

  return (
    <Card className="w-full grid border border-default-200 hover:border-primary/40 hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-col items-start gap-2">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0 justify-center items-center flex">
              <FileText size={18} className="text-primary" />
            </div>
            <div className="flex-1 gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-primary">
                  {invoice.invoiceId}
                </span>
                <div className="flex gap-2">
                  <Chip
                    size="sm"
                    color={cfg.color}
                    variant="flat"
                    startContent={<Icon size={12} />}
                    className="capitalize"
                  >
                    {cfg.label}
                  </Chip>
                  {invoice.postId && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="primary"
                      className="font-mono text-xs"
                    >
                      {invoice.postId}
                    </Chip>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-default-900">
              {formatCurrency(
                invoice.amount.grandTotal,
                invoice.amount.currency
              )}
            </p>
            {invoice.paymentStatus === "partial" && invoice.partialPayment && (
              <p className="text-xs text-secondary-600 font-medium">
                {formatCurrency(
                  invoice.partialPayment.amountPaid,
                  invoice.amount.currency
                )}{" "}
                paid
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center  gap-1 mt-1">
          <User size={13} className="text-default-400" />
          <span className="text-sm font-medium text-default-700 truncate">
            {invoice.recipient.name}
          </span>
          {invoice.recipient.phone && (
            <>
              <Phone size={13} className="text-default-400 ml-2" />
              <span className="text-xs text-default-500">
                {invoice.recipient.phone}
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardBody className="p-0">
        {/* Date row */}
        <div className=" items-center gap-4 px-4 pb-3 text-xs text-default-500">
          <span className="flex items-center gap-1">
            <CalendarDays size={12} />
            Invoice: {fmt(invoice.invoiceDate)}
          </span>
          {invoice.dueDate && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Due: {fmt(invoice.dueDate)}
            </span>
          )}
          {invoice.paymentDate && invoice.paymentStatus !== "unpaid" && (
            <span className="flex items-center gap-1 text-success-600">
              <CheckCircle2 size={12} />
              Paid: {fmt(invoice.paymentDate)}
            </span>
          )}
        </div>

        {/* Partial bar */}
        {invoice.paymentStatus === "partial" && invoice.partialPayment && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-default-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary-500 rounded-full transition-all"
                style={{ width: `${invoice.partialPayment.percentagePaid}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-default-500 mt-1">
              <span>
                {invoice.partialPayment.percentagePaid.toFixed(1)}% paid
              </span>
              <span>
                {formatCurrency(
                  invoice.partialPayment.amountDue,
                  invoice.amount.currency
                )}{" "}
                due
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-4  border-t border-default-100">
          <Button
            size="sm"
            color="danger"
            isIconOnly
            onPress={() => onDelete(invoice.invoiceId)}
            title="Delete invoice"
          >
            <Trash2 size={16} />
          </Button>
          <Button
            size="sm"
            color="primary"
            startContent={<PencilLine size={14} />}
            onPress={() => onStatusUpdate(invoice)}
          >
            Update Status
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              color="success"
              isIconOnly
              onPress={() => onShare(invoice.invoiceId)}
              title="Share invoice"
            >
              <Share2 size={16} />
            </Button>
            <Button
              size="sm"
              isIconOnly
              onPress={() => setExpanded(!expanded)}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </div>

        {/* Expanded breakdown */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-default-100 pt-3 space-y-3">
            <p className="text-xs font-semibold text-default-500 uppercase tracking-wider">
              Line Items
            </p>
            <div className="space-y-2">
              {invoice.breakdown.items.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-start text-sm p-2 rounded-lg bg-default-50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-default-800">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-default-500 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-default-900 ml-4">
                    {formatCurrency(item.total, invoice.amount.currency)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <div className="text-right space-y-1">
                <div className="flex justify-between gap-8 text-sm text-default-600">
                  <span>Subtotal</span>
                  <span>
                    {formatCurrency(
                      invoice.amount.subTotal,
                      invoice.amount.currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-sm text-default-600">
                  <span>Already Paid</span>
                  <span>
                    {formatCurrency(
                      invoice.partialPayment?.amountPaid ?? 0,
                      invoice.amount.currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-base font-bold text-default-900 border-t border-default-200 pt-1">
                  <span>Remaining</span>
                  <span>
                    {formatCurrency(
                      invoice.amount.grandTotal -
                        (invoice.partialPayment?.amountPaid ?? 0),
                      invoice.amount.currency
                    )}
                  </span>
                </div>
              </div>
            </div>
            {invoice.breakdown.notes && (
              <div className="p-2 rounded-lg bg-default-50 text-xs text-default-600">
                <p className="font-semibold mb-1">Notes</p>
                <p>{invoice.breakdown.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Status Update Modal ─────────────────────────────────────────────────────

function StatusModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
}) {
  const [status, setStatus] = useState<"paid" | "unpaid" | "partial">(
    invoice.paymentStatus
  );
  const [paymentDate, setPaymentDate] = useState(
    invoice.paymentDate
      ? invoice.paymentDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [partialMode, setPartialMode] = useState<"amount" | "percent">(
    "amount"
  );
  const [partialAmount, setPartialAmount] = useState(
    invoice.partialPayment?.amountPaid?.toString() ?? ""
  );
  const [partialPct, setPartialPct] = useState(
    invoice.partialPayment?.percentagePaid?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const total = invoice.amount.grandTotal;

  // Sync conversions
  const handleAmountChange = (v: string) => {
    setPartialAmount(v);
    const n = parseFloat(v);
    if (!isNaN(n) && total > 0) setPartialPct(((n / total) * 100).toFixed(2));
  };
  const handlePctChange = (v: string) => {
    setPartialPct(v);
    const n = parseFloat(v);
    if (!isNaN(n)) setPartialAmount(((n / 100) * total).toFixed(2));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        paymentStatus: status,
        paymentDate,
      };
      if (status === "partial") {
        if (partialMode === "amount")
          body.partialAmountPaid = parseFloat(partialAmount);
        else body.partialPercentagePaid = parseFloat(partialPct);
      }
      const res = await fetch(`/api/admin/invoices/${invoice.invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        addToast({ description: "Invoice status updated!", color: "success" });
        onSaved(data.invoice);
        onClose();
      } else {
        addToast({
          description: data.message || "Update failed",
          color: "danger",
        });
      }
    } catch {
      addToast({ description: "Network error", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const statusOptions: Array<{
    value: "paid" | "unpaid" | "partial";
    label: string;
    color: string;
  }> = [
    {
      value: "unpaid",
      label: "Unpaid",
      color: "border-warning-400 bg-warning-50 text-warning-700",
    },
    {
      value: "paid",
      label: "Paid",
      color: "border-success-400 bg-success-50 text-success-700",
    },
    {
      value: "partial",
      label: "Partial",
      color: "border-secondary-400 bg-secondary-50 text-secondary-700",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-default-600 mb-2">
          Payment Status
        </p>
        <div className="grid grid-cols-3 gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${status === opt.value ? opt.color + " border-opacity-100" : "border-default-200 bg-default-50 text-default-600"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-default-600 block mb-1">
          {status === "paid" ? "Payment Date" : "Date"}
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-default-300 bg-default-50 text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {status === "partial" && (
        <div className="space-y-3 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-secondary-700">
              Amount Paid
            </p>
            <div className="flex rounded-lg overflow-hidden border border-secondary-300 ml-auto">
              <button
                onClick={() => setPartialMode("amount")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${partialMode === "amount" ? "bg-secondary-500 text-white" : "bg-white text-secondary-700"}`}
              >
                ₹ Amount
              </button>
              <button
                onClick={() => setPartialMode("percent")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${partialMode === "percent" ? "bg-secondary-500 text-white" : "bg-white text-secondary-700"}`}
              >
                % Percent
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary-600 block mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                min={0}
                max={total}
                value={partialAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-secondary-300 bg-white text-sm focus:outline-none focus:border-secondary-500"
                placeholder="e.g. 2500"
              />
            </div>
            <div>
              <label className="text-xs text-secondary-600 block mb-1">
                Percentage (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={partialPct}
                onChange={(e) => handlePctChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-secondary-300 bg-white text-sm focus:outline-none focus:border-secondary-500"
                placeholder="e.g. 50"
              />
            </div>
          </div>
          <p className="text-xs text-secondary-600">
            Total: {formatCurrency(total, invoice.amount.currency)} — Due after
            payment:{" "}
            {formatCurrency(
              Math.max(0, total - (parseFloat(partialAmount) || 0)),
              invoice.amount.currency
            )}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          variant="flat"
          onPress={onClose}
          className="flex-1"
          isDisabled={saving}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          onPress={handleSave}
          isLoading={saving}
          className="flex-1"
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [invoiceType, setInvoiceType] = useState<"all" | "regular" | "payout">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const shareDisclosure = useDisclosure();
  const [shareInvoiceId, setShareInvoiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (filterStatus !== "all") params.set("status", filterStatus);
        if (invoiceType !== "all") params.set("invoiceType", invoiceType);
        if (debouncedSearch) params.set("search", debouncedSearch);
        const res = await fetch(`/api/admin/invoices?${params}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices);
          setPagination(data.pagination);
        } else {
          addToast({ description: "Failed to load invoices", color: "danger" });
        }
      } catch {
        addToast({ description: "Network error", color: "danger" });
      } finally {
        setLoading(false);
      }
    },
    [filterStatus, invoiceType, debouncedSearch]
  );

  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  const handleDelete = async (invoiceId: string) => {
    if (!confirm(`Delete invoice ${invoiceId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        addToast({ description: "Invoice deleted", color: "success" });
        fetchInvoices(pagination.page);
      } else {
        addToast({
          description: data.message || "Delete failed",
          color: "danger",
        });
      }
    } catch {
      addToast({ description: "Network error", color: "danger" });
    }
  };

  const handleStatusUpdate = (inv: Invoice) => {
    setSelectedInvoice(inv);
    onOpen();
  };

  const handleShare = (id: string) => {
    setShareInvoiceId(id);
    shareDisclosure.onOpen();
  };

  const handleSaved = (updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((i) => (i.invoiceId === updated.invoiceId ? updated : i))
    );
  };

  // Stats
  const stats = {
    total: pagination.total,
    paid: invoices.filter((i) => i.paymentStatus === "paid").length,
    unpaid: invoices.filter((i) => i.paymentStatus === "unpaid").length,
    partial: invoices.filter((i) => i.paymentStatus === "partial").length,
    revenue: invoices
      .filter((i) => i.paymentStatus === "paid")
      .reduce((s, i) => s + i.amount.grandTotal, 0),
  };

  return (
    <div className="container mx-auto px-4 w-full max-w-5xl">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-default-900">Invoices</h1>
            <p className="text-sm text-default-500 mt-0.5">
              {pagination.total} total · ordered by date
            </p>
          </div>
          <Button
            isIconOnly
            variant="flat"
            onPress={() => fetchInvoices(pagination.page)}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Tabs for Invoice Type */}
        <div className="flex gap-2 border-b border-default-200 pb-2 mb-4">
          {(
            [
              { value: "all", label: "All Invoices" },
              { value: "regular", label: "Tuition & Service" },
              { value: "payout", label: "Admin Payouts" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setInvoiceType(tab.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                invoiceType === tab.value
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-default-500 hover:text-default-700 hover:bg-default-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 md:grid-cols-4 gap-3">
          {[
            {
              label: "Total",
              value: stats.total,
              color: "bg-default-100",
              text: "text-default-700",
            },
            {
              label: "Paid",
              value: stats.paid,
              color: "bg-success-50",
              text: "text-success-700",
            },
            {
              label: "Unpaid",
              value: stats.unpaid,
              color: "bg-warning-50",
              text: "text-warning-700",
            },
            {
              label: "Partial",
              value: stats.partial,
              color: "bg-secondary-50",
              text: "text-secondary-700",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.color} rounded-xl p-3 text-center`}
            >
              <p className="text-xs text-default-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-50 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice ID, name, phone, post ID…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-default-300 bg-default-50 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "paid", "unpaid", "partial"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? "solid" : "flat"}
                color={
                  filterStatus === s
                    ? s === "paid"
                      ? "success"
                      : s === "unpaid"
                        ? "warning"
                        : s === "partial"
                          ? "secondary"
                          : "primary"
                    : "default"
                }
                onPress={() => setFilterStatus(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Invoice list */}
        {loading ? (
          <Card>
            <CardBody className="py-16 flex items-center justify-center">
              <Spinner label="Loading invoices…" size="lg" />
            </CardBody>
          </Card>
        ) : invoices.length === 0 ? (
          <Card>
            <CardBody className="py-16 text-center space-y-2">
              <FileText size={40} className="mx-auto text-default-300" />
              <p className="text-default-500 font-medium">No invoices found</p>
              <p className="text-default-400 text-sm">
                Generate invoices from the Tuitions page
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-0">
            {invoices.map((inv) => (
              <InvoiceCard
                key={inv._id}
                invoice={inv}
                onDelete={handleDelete}
                onStatusUpdate={handleStatusUpdate}
                onShare={handleShare}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Button
              size="sm"
              variant="flat"
              isDisabled={pagination.page === 1 || loading}
              onPress={() => fetchInvoices(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-default-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="flat"
              isDisabled={pagination.page === pagination.totalPages || loading}
              onPress={() => fetchInvoices(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Status update modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>Update Payment Status</span>
                {selectedInvoice && (
                  <span className="text-sm font-mono text-primary font-normal">
                    {selectedInvoice.invoiceId}
                  </span>
                )}
              </ModalHeader>
              <ModalBody>
                {selectedInvoice && (
                  <StatusModal
                    invoice={selectedInvoice}
                    onClose={onClose}
                    onSaved={handleSaved}
                  />
                )}
              </ModalBody>
              <ModalFooter />
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Share Invoice Modal */}
      <Modal
        isOpen={shareDisclosure.isOpen}
        onClose={shareDisclosure.onClose}
        size="md"
      >
        <ModalContent>
          {() => {
            const link =
              typeof window !== "undefined"
                ? `${window.location.origin}/invoices/${shareInvoiceId}`
                : "";

            const handleCopy = async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            };

            const handleWhatsApp = () => {
              const text = `Hello! Here is the invoice.\n\nYou can view and download it here: ${link}`;
              shareOnWhatsApp(text);
            };

            return (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Share2 size={20} className="text-success-600" />
                    <span>Share Invoice</span>
                  </div>
                  <p className="text-sm font-normal text-default-500">
                    Share this permanent link with the recipient.
                  </p>
                </ModalHeader>
                <ModalBody className="pb-6">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-default-100 border border-default-200">
                    <input
                      type="text"
                      readOnly
                      value={link}
                      className="flex-1 bg-transparent text-sm text-default-700 focus:outline-none px-2 font-mono"
                    />
                    <Button
                      size="sm"
                      isIconOnly
                      variant="flat"
                      color={copied ? "success" : "default"}
                      onPress={handleCopy}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                  <Button
                    className="w-full mt-4 bg-[#25D366] text-white font-medium"
                    startContent={<Share2 size={16} />}
                    onPress={handleWhatsApp}
                  >
                    Share via WhatsApp
                  </Button>
                </ModalBody>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </div>
  );
}
