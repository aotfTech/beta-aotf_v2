import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Profile from "@/lib/models/Profile";
import User from "@/lib/models/User";
import { withApiErrorHandling } from "@/lib/api-utils";

/**
 * GET /api/v1/users/:username — public profile lookup.
 * Returns the merged User + Profile data for the given username.
 */
async function get(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  if (!username || username.length > 30) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  await dbConnect();

  // Case-insensitive lookup
  const profile = await Profile.findOne({ username }).collation({
    locale: "en_US",
    strength: 2,
  });

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await User.findOne(
    { _id: profile.userId },
    "role plan onboardingCompleted status createdAt",
  );

  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      location: profile.location,
      websiteUrl: profile.websiteUrl,
      socialLinks: profile.socialLinks,
      subjects: profile.subjects,
      experience: profile.experience,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      address: profile.address,
      teachingExp: profile.teachingExp,
      jobExp: profile.jobExp,
      qualification: profile.qualification,
      board: profile.board,
    },
    user: {
      role: user.role,
      plan: user.plan,
      onboardingCompleted: user.onboardingCompleted,
      memberSince: user.createdAt,
    },
  });
}

export const GET = withApiErrorHandling(get, "GET /api/v1/users/[username]");
