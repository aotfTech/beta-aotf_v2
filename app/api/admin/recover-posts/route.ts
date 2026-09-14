import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { handleApiError } from "@/lib/api-utils";
import dbConnect from "@/lib/db";
import Post from "@/lib/models/Post";
import { upsertPostLedger } from "@/lib/services/postLedger.service";

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = sessionClaims?.publicMetadata as Record<string, unknown>;
    if (metadata?.isAdmin !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    
    // Fetch all post IDs
    const posts = await Post.find({}, { postId: 1 }).lean();
    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        await upsertPostLedger(post.postId);
        successCount++;
      } catch (e) {
        console.error(`Failed to recover post ${post.postId}:`, e);
        errorCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      totalProcessed: posts.length,
      successCount,
      errorCount
    });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/recover-posts");
  }
}
