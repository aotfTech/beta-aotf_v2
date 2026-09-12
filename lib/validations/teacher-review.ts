import { z } from "zod";

export const createTeacherReviewSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be at most 200 characters"),
  qualification: z
    .string({ message: "Qualification is required" })
    .trim()
    .min(2, "Qualification must be at least 2 characters")
    .max(200, "Qualification must be at most 200 characters"),
  experience: z.coerce
    .number()
    .int()
    .min(0, "Experience must be 0 or more"),
  message: z
    .string({ message: "Message is required" })
    .trim()
    .min(5, "Message must be at least 5 characters")
    .max(1000, "Message must be at most 1000 characters"),
  order: z.coerce.number().int().min(0).optional().default(0),
  isVisible: z.boolean().optional().default(true),
});

export const updateTeacherReviewSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  qualification: z.string().trim().min(2).max(200).optional(),
  experience: z.coerce.number().int().min(0).optional(),
  message: z.string().trim().min(5).max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

export type CreateTeacherReviewInput = z.infer<typeof createTeacherReviewSchema>;
export type UpdateTeacherReviewInput = z.infer<typeof updateTeacherReviewSchema>;
