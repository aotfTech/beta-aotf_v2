import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { listSubjects } from "@/lib/services/adminOptions.service";
import { handleApiError } from "@/lib/api-utils";

/** Public subject catalogue used by onboarding and profile editing. */
export async function GET() {
  try {
    await dbConnect();
    const subjects = await listSubjects();
    return NextResponse.json({ subjects });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/subjects");
  }
}
