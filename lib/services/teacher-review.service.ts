import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import TeacherReview, {
  type ITeacherReview,
} from "@/lib/models/TeacherReview";
import { NotFoundError } from "@/lib/errors";
import type {
  CreateTeacherReviewInput,
  UpdateTeacherReviewInput,
} from "@/lib/validations/teacher-review";

export async function listTeacherReviews(
  visibleOnly = false,
): Promise<ITeacherReview[]> {
  await dbConnect();
  const filter = visibleOnly ? { isVisible: true } : {};
  return TeacherReview.find(filter).sort({ order: 1, createdAt: 1 }).lean<
    ITeacherReview[]
  >();
}

export async function getTeacherReviewById(
  id: string,
): Promise<ITeacherReview> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError("TeacherReview");
  const doc = await TeacherReview.findById(id).lean<ITeacherReview>();
  if (!doc) throw new NotFoundError("TeacherReview");
  return doc;
}

export async function createTeacherReview(
  input: CreateTeacherReviewInput,
): Promise<ITeacherReview> {
  await dbConnect();
  return TeacherReview.create(input);
}

export async function updateTeacherReview(
  id: string,
  input: UpdateTeacherReviewInput,
): Promise<ITeacherReview> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError("TeacherReview");
  const doc = await TeacherReview.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  }).lean<ITeacherReview>();
  if (!doc) throw new NotFoundError("TeacherReview");
  return doc;
}

export async function deleteTeacherReview(id: string): Promise<void> {
  await dbConnect();
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError("TeacherReview");
  const result = await TeacherReview.findByIdAndDelete(id);
  if (!result) throw new NotFoundError("TeacherReview");
}
