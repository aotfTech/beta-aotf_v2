import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Profile from "@/lib/models/Profile";
import User from "@/lib/models/User";
import { ensureUserRecord } from "@/lib/utils/ensure-user";

export async function PATCH(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const editableFields = new Set([
      "phone",
      "whatsapp",
      "address",
      "teachingExp",
      "jobExp",
      "qualification",
      "board",
      "gender",
    ]);
    const unsupportedField = Object.keys(body).find(
      (field) => !editableFields.has(field),
    );
    if (unsupportedField) {
      return NextResponse.json(
        {
          error: `${unsupportedField} cannot be changed from the profile editor.`,
        },
        { status: 400 },
      );
    }

    const {
      phone,
      whatsapp,
      address,
      teachingExp,
      jobExp,
      qualification,
      board,
      gender,
    } = body as {
      phone?: string;
      whatsapp?: string;
      address?: string;
      teachingExp?: string;
      jobExp?: string;
      qualification?: string;
      board?: string;
      gender?: string;
    };

    // Validate phone / whatsapp (10-digit Indian mobile)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (phone !== undefined && !phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Phone must be a valid 10-digit Indian mobile number" },
        { status: 400 },
      );
    }
    if (whatsapp !== undefined && !phoneRegex.test(whatsapp)) {
      return NextResponse.json(
        { error: "WhatsApp must be a valid 10-digit Indian mobile number" },
        { status: 400 },
      );
    }

    // Validate address length
    if (address !== undefined && address.length > 200) {
      return NextResponse.json(
        { error: "Address must be 200 characters or less" },
        { status: 400 },
      );
    }

    const validExpRanges = ["0-1", "2-5", "6-10", "10+"];
    if (teachingExp !== undefined && !validExpRanges.includes(teachingExp)) {
      return NextResponse.json(
        { error: "Invalid teachingExp value" },
        { status: 400 },
      );
    }
    if (jobExp !== undefined && !validExpRanges.includes(jobExp)) {
      return NextResponse.json(
        { error: "Invalid jobExp value" },
        { status: 400 },
      );
    }

    const validBoards = ["CBSE", "ICSE", "ISC", "IB", "WB-Bengali", "WB-English"];
    if (board !== undefined && !validBoards.includes(board)) {
      return NextResponse.json(
        { error: "Invalid board value" },
        { status: 400 },
      );
    }

    const normalizedGender = gender?.trim().toLowerCase() as
      | "male"
      | "female"
      | "other"
      | undefined;
    const validGenders = ["male", "female", "other"];
    if (normalizedGender !== undefined && !validGenders.includes(normalizedGender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 },
      );
    }

    await dbConnect();

    const updateFields: Record<string, unknown> = {};
    if (phone !== undefined) updateFields.phone = phone;
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (address !== undefined) updateFields.address = address;
    if (teachingExp !== undefined) updateFields.teachingExp = teachingExp;
    if (jobExp !== undefined) updateFields.jobExp = jobExp;
    if (qualification !== undefined) updateFields.qualification = qualification;
    if (board !== undefined) updateFields.board = board;
    if (normalizedGender !== undefined) updateFields.gender = normalizedGender;

    // Ensure User + Profile exist (self-heals if the Clerk webhook was delayed)
    const user = await ensureUserRecord(clerkId);

    if (normalizedGender !== undefined) {
      await User.updateOne({ clerkId }, { $set: { gender: normalizedGender } });
    }

    const profile = await Profile.findOneAndUpdate(
      { clerkId },
      {
        $set: updateFields,
        $setOnInsert: {
          userId: user._id,
          clerkId,
          username: user.username,
        },
      },
      { new: true, upsert: true },
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    console.log(`[profile] Updated profile for ${clerkId}`);

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return handleApiError(error, "PATCH /api/v1/profile");
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    await dbConnect();

    const profile = await Profile.findOne({ clerkId });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/profile");
  }
}
