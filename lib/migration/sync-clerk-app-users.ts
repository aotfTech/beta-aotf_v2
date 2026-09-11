import { clerkClient } from "@clerk/nextjs/server";
import User from "@/lib/models/User";
import { isAppClerkUser } from "@/lib/migration/clerk-user-filters";
import { seedClerkUserInMongo } from "@/lib/migration/seed-clerk-user";
import { reportBackgroundError } from "@/lib/sentry-report";

const PAGE_SIZE = 100;

export type SyncClerkAppUsersResult = {
  clerkTotal: number;
  appUsers: number;
  alreadySynced: number;
  results: { created: number; updated: number; skipped: number; failed: number };
  failures: { id: string; error: string }[];
};

/** Import only Clerk users that are not yet in MongoDB. Existing records are left as-is. */
export async function syncClerkAppUsers(): Promise<SyncClerkAppUsersResult> {
  const existingClerkIds = new Set(
    (await User.find({}).distinct("clerkId")).map(String),
  );

  const client = await clerkClient();
  const clerkUsers = [];
  let offset = 0;

  while (true) {
    const page = await client.users.getUserList({
      limit: PAGE_SIZE,
      offset,
      orderBy: "-created_at",
    });
    clerkUsers.push(...page.data);
    if (page.data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const appUsers = clerkUsers.filter(isAppClerkUser);
  const missingUsers = appUsers.filter((user) => !existingClerkIds.has(user.id));
  const results = { created: 0, updated: 0, skipped: 0, failed: 0 };
  const failures: { id: string; error: string }[] = [];

  for (const clerkUser of missingUsers) {
    try {
      const { action, reason } = await seedClerkUserInMongo(clerkUser);
      if (action === "skipped") {
        results.skipped++;
        console.log(`[sync-clerk-users] skipped ${clerkUser.id}: ${reason}`);
      } else if (action === "created") {
        results.created++;
      } else {
        results.updated++;
      }
    } catch (err) {
      results.failed++;
      failures.push({
        id: clerkUser.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length > 0) {
    reportBackgroundError(
      new Error(`Failed to sync ${failures.length} Clerk app user(s)`),
      {
        operation: "sync-clerk-app-users",
        integration: "clerk-mongodb",
        extra: {
          failedCount: failures.length,
          failedUserIds: failures.map((failure) => failure.id),
        },
      },
    );
  }

  return {
    clerkTotal: clerkUsers.length,
    appUsers: appUsers.length,
    alreadySynced: appUsers.length - missingUsers.length,
    results,
    failures,
  };
}
