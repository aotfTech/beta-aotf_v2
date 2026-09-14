import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "../lib/db";
import Post from "../lib/models/Post";
import { upsertPostLedger } from "../lib/services/postLedger.service";

// Load environment variables based on the active environment
const envFile = process.env.NODE_ENV === "production" ? ".env.prod" : ".env.local";
dotenv.config({ path: envFile });

async function main() {
  console.log("Starting recovery of missed posts to PostLedger...");
  try {
    await dbConnect();
    console.log("Connected to database");

    const posts = await Post.find({}, { postId: 1 }).lean();
    console.log(`Found ${posts.length} posts to process`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      try {
        await upsertPostLedger(post.postId);
        successCount++;
        if (i % 10 === 0) {
          console.log(`Processed ${i + 1}/${posts.length} posts...`);
        }
      } catch (err) {
        console.error(`Error processing post ${post.postId}:`, err);
        errorCount++;
      }
    }

    console.log("=========================================");
    console.log("Recovery complete!");
    console.log(`Total processed: ${posts.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log("=========================================");
    
  } catch (error) {
    console.error("Fatal error during recovery script:", error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("Database connection closed");
    }
    process.exit(0);
  }
}

main();
