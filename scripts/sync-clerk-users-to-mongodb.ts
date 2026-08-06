/**
 * Backfill NEW MongoDB User + Profile records from existing Clerk accounts.
 *
 * Usage:
 *   pnpm tsx scripts/sync-clerk-users-to-mongodb.ts
 *
 * Or trigger from the running app (as a logged-in admin):
 *   GET /api/admin/app-users?sync=1
 */

import path from "path";
import dns from "node:dns/promises";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

// Atlas SRV lookups can fail on some local DNS resolvers when NODE_ENV=production.
if (process.env.NODE_ENV === "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

async function main() {
  const { default: dbConnect } = await import("../lib/db");
  const { isAppClerkUser, seedClerkUserInMongo } = await import(
    "../lib/migration/seed-clerk-user"
  );
  const { createClerkClient } = await import("@clerk/nextjs/server");

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Missing CLERK_SECRET_KEY");

  await dbConnect();
  const clerk = createClerkClient({ secretKey });

  const PAGE_SIZE = 100;
  const DELAY_MS = 150;

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const clerkUsers = [];
  let offset = 0;

  while (true) {
    const page = await clerk.users.getUserList({
      limit: PAGE_SIZE,
      offset,
      orderBy: "-created_at",
    });
    clerkUsers.push(...page.data);
    if (page.data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(DELAY_MS);
  }

  const appUsers = clerkUsers.filter(isAppClerkUser);
  console.log(`Clerk users: ${clerkUsers.length}, app users to sync: ${appUsers.length}\n`);

  const results = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const clerkUser of appUsers) {
    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    try {
      const { action } = await seedClerkUserInMongo(clerkUser);
      if (action === "created") results.created++;
      else if (action === "updated") results.updated++;
      else results.skipped++;
      console.log(`${action}: ${email ?? clerkUser.id}`);
    } catch (err) {
      results.failed++;
      console.error(`failed: ${email ?? clerkUser.id}`, err);
    }
  }

  console.log("\nSummary:", results);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
