import { z } from "zod";
import { boards } from "@/lib/validations/forms";

export const EXPERIENCE_OPTIONS = ["0-1", "2-5", "6-10", "10+"] as const;

/** Board options sourced from the central forms.ts definition */
export const BOARD_OPTIONS = boards;

export const PLANS = [
    {
        value: "teacher",
        label: "Teacher Plan",
        amount: 4900,
        display: "₹49",
        description: "Access to tuition post feed and applications.",
    },
    {
        value: "teacher_candidate",
        label: "Teacher & Candidate Plan",
        amount: 9900,
        display: "₹99",
        description: "Full access: tuition posts + job/project applications.",
    },
] as const;

export type PlanValue = (typeof PLANS)[number]["value"];

export interface OnboardingFormData {
    phone: string;
    whatsapp: string;
    sameAsPhone: boolean;
    address: string;
    teachingExp: string;
    jobExp: string;
    qualification: string;
    board: string;
    gender: string;
    subjects: string[];
    plan: PlanValue | "";
}

// ─── Zod validation schema for onboarding step-1 fields ─────────────
const phoneRegex = /^[6-9]\d{9}$/;

export const onboardingStep1Schema = z.object({
    phone: z
        .string()
        .regex(phoneRegex, "Enter a valid 10-digit Indian phone number"),
    whatsapp: z
        .string()
        .regex(phoneRegex, "Enter a valid 10-digit Indian WhatsApp number"),
    address: z
        .string()
        .min(3, "Address must be at least 3 characters")
        .max(200, "Address must be at most 200 characters"),
    teachingExp: z.string().min(1, "Teaching experience is required"),
    jobExp: z.string().optional(),
    qualification: z
        .string()
        .min(2, "Qualification must be at least 2 characters")
        .max(100, "Qualification must be at most 100 characters"),
    board: z.string().min(1, "Board is required"),
    gender: z.string().min(1, "Gender is required"),
    subjects: z.array(z.string()).min(1, "Select at least one subject"),
});

export type OnboardingStep1Values = z.infer<typeof onboardingStep1Schema>;

/**
 * Validate a single field against the step-1 schema.
 * Returns the error message or null if valid.
 */
export function validateField(
    field: keyof OnboardingStep1Values,
    value: string
): string | null {
    const fieldSchema = onboardingStep1Schema.shape[field];
    if (!fieldSchema) return null;
    const result = fieldSchema.safeParse(value);
    return result.success ? null : result.error.issues[0]?.message ?? null;
}
