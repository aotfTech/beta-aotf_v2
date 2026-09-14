"use client";

import { siteConfig } from "@/config/site";
import { Chip } from "@heroui/chip";
import {
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Link } from "@heroui/link";
import { FaChalkboardTeacher } from "react-icons/fa";
import QRCode from "react-qr-code";
import { addToast } from "@heroui/toast";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdCardData {
  /** "teacher" or "candidate" */
  role: "teacher" | "candidate";
  name: string;
  photo: string;
  designation?: string;
  qualification?: string;
  subjects?: string[];
  employeeId: string;
  phone: string;
  email: string;
  address: string;
  joinDate: string;
  expiryDate: string;
  isVerified?: boolean;
  uniqId: string; // Unique identifier for QR code (could be a URL or encoded data)
  /** Only candidates with an active plan get the card */
  plan?: "basic" | "premium" | "elite";
}

// ─── Gradient maps ────────────────────────────────────────────────────────────

const roleGradient: Record<IdCardData["role"], string> = {
  teacher: "from-indigo-600 via-blue-600 to-cyan-500",
  candidate: "from-emerald-600 via-teal-600 to-cyan-500",
};

const roleAccent: Record<IdCardData["role"], string> = {
  teacher: "bg-indigo-500",
  candidate: "bg-emerald-500",
};

const roleBadgeBg: Record<IdCardData["role"], string> = {
  teacher: "bg-indigo-100 text-indigo-700",
  candidate: "bg-emerald-100 text-emerald-700",
};

// ─── Single-sided ID Card ─────────────────────────────────────────────────────

export function IdCard({ data }: { data: IdCardData }) {
  const verifyBaseUrl =
    typeof window !== "undefined" ? window.location.origin : siteConfig.url;

  return (
    <div className="w-full select-none rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-white dark:bg-zinc-900 flex flex-col">
      {/* ── Top gradient banner ── */}
      <div
        className={`relative bg-linear-to-br ${roleGradient[data.role]} px-5 pt-4 pb-10`}
      >
        {/* Decorative circles */}
        <div className="absolute top-2 right-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-6 w-14 h-14 rounded-full bg-white/5 blur-lg" />

        {/* Org header */}
        <div className="flex items-center gap-2.5 relative z-10">
          <img
            src="/AOTF.svg"
            alt="AOTF"
            className="w-8 h-8 rounded-lg bg-white p-0.5"
          />
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">
              {siteConfig.name}
            </p>
            <p className="text-[10px] text-white/70 tracking-widest uppercase">
              {data.role === "teacher"
                ? "Faculty ID Card"
                : "Candidate ID Card"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Photo + Name overlay ── */}
      <div className="relative px-5 -mt-8 z-10 flex items-start gap-3">
        <div className="shrink-0 rounded-xl overflow-hidden ring-3 ring-white dark:ring-zinc-900 shadow-lg backdrop-blur-md bg-white/30">
          <img
            src={data.photo}
            alt={data.name}
            className="w-18 h-18 object-cover"
          />
        </div>
        <div className="pb-1 min-w-0">
          <div className="flex items-center gap-1.5 cursor-pointer">
            {/* <div
              className="flex items-center gap-1.5 flex-1"
              onClick={() =>
                window.open(
                  `${verifyBaseUrl}/verify/${encodeURIComponent(data.uniqId)}`,
                  "_blank"
                )
              }
            >
              <h2 className="text-base font-bold text-white truncate">
                {data.name}
              </h2>
              {data.isVerified && (
                <ExternalLink size={14} className="text-white shrink-0 " />
              )}
            </div> */}

            <Link
              isBlock
              showAnchorIcon
              className="text-white"
              href={`${verifyBaseUrl}/verify/${encodeURIComponent(data.uniqId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {data.name}
            </Link>
            <div className="bg-white/20 hover:bg-white/30 rounded-md p-1.5 opacity-80 hover:opacity-100 transition-opacity">
              <Copy
                size={14}
                color="white"
                className="shrink-0 cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(data.uniqId);
                  // show toast notification (you can replace this with your own toast implementation)
                  addToast({
                    title: "Unique ID Copied",
                    description:
                      "The unique identifier has been copied to your clipboard.",
                  });
                }}
              />
            </div>
          </div>
          <Chip
            size="sm"
            variant="flat"
            className={`mt-0.5 text-[10px] font-semibold uppercase ${roleBadgeBg[data.role]}`}
          >
            {data.role === "teacher" ? "Faculty" : "Candidate"}
            {data.plan ? ` · ${data.plan}` : ""}
          </Chip>
        </div>
      </div>

      {/* ── Details section ── */}
      <div className="px-5 pt-3 pb-2 space-y-1.5 text-[11px]">
        {/* ID */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 shrink-0">ID</span>
          <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 tracking-wide">
            {data.employeeId}
          </span>
        </div>

        {/* Qualification */}
        {data.qualification && (
          <div className="flex items-center gap-2">
            <GraduationCap size={12} className="text-zinc-400 shrink-0" />
            <span className="text-zinc-700 dark:text-zinc-300 truncate">
              {data.qualification}
            </span>
          </div>
        )}

        {/* Subjects */}
        {data.subjects && data.subjects.length > 0 && (
          <div className="flex items-start gap-2">
            <FaChalkboardTeacher
              size={12}
              className="text-zinc-400 shrink-0 mt-0.5"
            />
            <div className="flex flex-wrap gap-1">
              {data.subjects.map((s) => (
                <span
                  key={s}
                  className={`px-1.5 py-px rounded text-[9px] font-medium text-white ${roleAccent[data.role]}`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="flex items-center gap-2">
          <Phone size={11} className="text-zinc-400 shrink-0" />
          <span className="text-zinc-700 dark:text-zinc-300">{data.phone}</span>
        </div>

        <div className="flex items-center gap-2">
          <Mail size={11} className="text-zinc-400 shrink-0" />
          <span className="text-zinc-700 dark:text-zinc-300 truncate">
            {data.email}
          </span>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin size={11} className="text-zinc-400 shrink-0 mt-0.5" />
          <span className="text-zinc-600 dark:text-zinc-400 leading-tight">
            {data.address}
          </span>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 border-t border-dashed border-zinc-200 dark:border-zinc-700" />

      {/* ── QR + Barcode section ── */}
      <div className="px-5 py-3 flex items-center gap-4">
        {/* QR placeholder */}
        <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center shrink-0">
          <div className="bg-white p-2 w-fit rounded-xl">
            <QRCode
              value={`${verifyBaseUrl}/verify/${encodeURIComponent(data.uniqId)}`}
              size={50}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 min-w-0">
          <p className="font-mono text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 tracking-widest">
            {data.employeeId}
          </p>
          <p className="text-[9px] text-zinc-400">
            Account Created on: {data.joinDate}
          </p>
        </div>
      </div>

      {/* ── Terms strip ── */}
      <div className="bg-zinc-100 dark:bg-zinc-800 px-5 py-2 text-[8px] text-zinc-400 dark:text-zinc-500 leading-tight space-y-0.5">
        <p>
          This card is the property of Academy of Tutorials and Freelancers
          (AOTF). If found, please return to the nearest AOTF office.
        </p>
        <p>Unauthorized use is prohibited. Contact: support@aotf.in</p>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className={`bg-linear-to-br ${roleGradient[data.role]} px-5 py-1.5 flex items-center justify-between`}
      >
        <p className="text-[9px] text-white/80">
          www.aotf.in &nbsp;•&nbsp; {siteConfig.contact.phone}
        </p>
        {/* <QrCode size={12} className="text-white/40" /> */}
      </div>
    </div>
  );
}

// ─── Upgrade to Candidate Card ────────────────────────────────────────────────

export function UpgradeCandidateCard({
  onUpgrade,
  isLoading = false,
  error,
}: {
  onUpgrade?: () => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="w-full h-full select-none rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-white dark:bg-zinc-900 flex flex-col">
      {/* ── Top gradient banner ── */}
      <div className="relative bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 px-5 pt-4 pb-10">
        {/* Decorative circles */}
        <div className="absolute top-2 right-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-6 w-14 h-14 rounded-full bg-white/5 blur-lg" />

        {/* Org header */}
        <div className="flex items-center gap-2.5 relative z-10">
          <img
            src="/AOTF.svg"
            alt="AOTF"
            className="w-8 h-8 rounded-lg bg-white/20 p-0.5"
          />
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">
              Academy of Tutorials and Freelancers
            </p>
            <p className="text-[10px] text-white/70 tracking-widest uppercase">
              Candidate Program
            </p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center gap-4">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-linear-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
          <Sparkles size={28} className="text-amber-500" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Become a Candidate
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-60">
            Unlock your personalized Candidate ID Card, get priority access to
            job postings, and stand out to recruiters for just INR 50 extra.
          </p>
        </div>

        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          Upgrade fee: INR 50
        </p>

        {/* Benefits */}
        <div className="w-full space-y-2 text-left text-[11px]">
          {[
            "Official AOTF Candidate ID",
            "Priority job matching",
            "Profile verified badge",
            "Recruiter visibility boost",
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <ShieldCheck size={10} className="text-emerald-500" />
              </div>
              <span className="text-zinc-700 dark:text-zinc-300">
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onUpgrade}
          disabled={isLoading || !onUpgrade}
          className="mt-1 w-full flex items-center justify-center gap-2 bg-linear-to-br from-amber-500 to-orange-500 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? "Processing..." : "Upgrade Now"}
          <ArrowRight size={14} />
        </button>

        {error ? (
          <p className="text-[11px] text-danger text-center leading-relaxed">
            {error}
          </p>
        ) : null}
      </div>

      {/* ── Bottom bar ── */}
      <div className="bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 px-5 py-1.5 flex items-center justify-between">
        <p className="text-[9px] text-white/80">
          www.aotf.in &nbsp;•&nbsp; {siteConfig.contact.phone}
        </p>
        <p className="text-[9px] text-white/60 font-medium">
          Candidate unlock in INR 50
        </p>
      </div>
    </div>
  );
}
