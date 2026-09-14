"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import Admin from "@/lib/models/Admin";
import dbConnect from "@/lib/db";
import {
  createTeacherReview,
  updateTeacherReview,
  deleteTeacherReview,
  listTeacherReviews
} from "@/lib/services/teacher-review.service";
import {
  createTeacherReviewSchema,
  updateTeacherReviewSchema,
} from "@/lib/validations/teacher-review";
import { reportError } from "@/lib/sentry-report";

async function verifyAdminPermission() {
  await dbConnect();
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const metadata = sessionClaims?.publicMetadata as Record<string, unknown>;
  const isAdminFromMetadata = metadata?.isAdmin === true;

  const currentAdmin = await Admin.findOne({ clerkId: userId }).lean();
  
  if (!isAdminFromMetadata && !currentAdmin) {
    throw new Error("Forbidden");
  }

  if (!currentAdmin) {
    throw new Error("Admin not found");
  }

  const adminDoc = currentAdmin as any;
  if (!adminDoc.isActive) {
    throw new Error("Forbidden: Admin is inactive");
  }
}

export async function getTeacherReviewsAction() {
  await verifyAdminPermission();
  const reviews = await listTeacherReviews();
  return JSON.parse(JSON.stringify(reviews)); // serialize for client
}

export async function createTeacherReviewAction(data: any) {
  try {
    await verifyAdminPermission();
    const parsed = createTeacherReviewSchema.parse(data);
    const result = await createTeacherReview(parsed);
    revalidatePath("/admin/teacher-reviews");
    revalidatePath("/");
    return { success: true, teacherReview: JSON.parse(JSON.stringify(result)) };
  } catch (error) {
    reportError(error, { tags: { area: "admin-teacher-reviews", operation: "create" } });
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTeacherReviewAction(id: string, data: any) {
  try {
    await verifyAdminPermission();
    const parsed = updateTeacherReviewSchema.parse(data);
    const result = await updateTeacherReview(id, parsed);
    revalidatePath("/admin/teacher-reviews");
    revalidatePath("/");
    return { success: true, teacherReview: JSON.parse(JSON.stringify(result)) };
  } catch (error) {
    reportError(error, { tags: { area: "admin-teacher-reviews", operation: "update" } });
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTeacherReviewAction(id: string) {
  try {
    await verifyAdminPermission();
    await deleteTeacherReview(id);
    revalidatePath("/admin/teacher-reviews");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    reportError(error, { tags: { area: "admin-teacher-reviews", operation: "delete" } });
    return { success: false, error: (error as Error).message };
  }
}
