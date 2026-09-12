import dbConnect from "@/lib/db";
import Review, { type IReview, type ReviewStatus } from "@/lib/models/Review";
import User from "@/lib/models/User";
import Profile from "@/lib/models/Profile";
import { NotFoundError } from "@/lib/errors";

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  message: string;
  createdAt: string;
  user: {
    username: string;
    name: string;
    imageUrl: string | null;
  };
};

export type AdminReview = PublicReview & {
  status: ReviewStatus;
  updatedAt: string;
};

function toPublicReview(doc: IReview): PublicReview {
  const snap = (doc as any).userSnapshot as IReview["userSnapshot"] | undefined;

  return {
    id: (doc as any)._id?.toString?.() ?? String((doc as any)._id),
    rating: (doc as any).rating,
    title: (doc as any).title ?? null,
    message: (doc as any).message,
    createdAt: (doc as any).createdAt instanceof Date ? (doc as any).createdAt.toISOString() : new Date((doc as any).createdAt).toISOString(),
    user: {
      username: snap?.username ?? "unknown",
      name: snap?.name ?? snap?.username ?? "Unknown",
      imageUrl: snap?.imageUrl ?? null,
    },
  };
}

function toAdminReview(doc: IReview): AdminReview {
  return {
    ...toPublicReview(doc),
    status: doc.status,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listPublicReviews(limit = 20): Promise<PublicReview[]> {
  await dbConnect();
  const docs = await Review.find({ status: "active" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<IReview[]>();
  return docs.map((d) => toPublicReview(d as unknown as IReview));
}

export async function listAdminReviews(input: {
  status?: ReviewStatus;
  page: number;
  limit: number;
}) {
  await dbConnect();
  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;

  const skip = (input.page - 1) * input.limit;

  const [total, docs] = await Promise.all([
    Review.countDocuments(filter),
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(input.limit)
      .lean<IReview[]>(),
  ]);

  return {
    reviews: docs.map((d) => toAdminReview(d as unknown as IReview)),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function createReviewAsAdmin(
  adminId: string,
  input: {
    username: string;
    rating: number;
    title?: string | null;
    message: string;
    status?: ReviewStatus;
  },
) {
  await dbConnect();

  const username = input.username.toLowerCase().trim();
  const user = await User.findOne({ username }).lean();
  if (!user) throw new NotFoundError("User");

  const profile = await Profile.findOne({ userId: user._id }).lean();

  const created = await Review.create({
    userId: user._id,
    userSnapshot: {
      username: user.username,
      name: (profile as any)?.displayName || user.username,
      imageUrl: (profile as any)?.avatarUrl ?? null,
      role: user.role,
    },
    rating: input.rating,
    title: input.title ?? null,
    message: input.message,
    status: input.status ?? "active",
    createdByAdminId: adminId,
  });

  return toAdminReview(created.toObject() as unknown as IReview);
}

export async function updateReviewAsAdmin(
  reviewId: string,
  adminId: string,
  input: {
    rating?: number;
    title?: string | null;
    message?: string;
    status?: ReviewStatus;
  },
) {
  await dbConnect();

  const updated = await Review.findByIdAndUpdate(
    reviewId,
    {
      $set: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedByAdminId: adminId,
      },
    },
    { new: true },
  );

  if (!updated) throw new NotFoundError("Review");
  return toAdminReview(updated.toObject() as unknown as IReview);
}

export async function deleteReviewAsAdmin(reviewId: string) {
  await dbConnect();
  const deleted = await Review.findByIdAndDelete(reviewId);
  if (!deleted) throw new NotFoundError("Review");
  return { id: reviewId };
}
