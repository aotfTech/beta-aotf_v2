import mongoose from "mongoose";
import dotenv from "dotenv";
import dbConnect from "./lib/db.ts";
import PostLedger from "./lib/models/PostLedger.ts";

dotenv.config({ path: ".env.local" });

async function test() {
  await dbConnect();
  try {
    const res = await PostLedger.find({ postId: { $in: ["P-13092600"] } }).lean();
    console.log("Find worked:", res.length);
  } catch (e) {
    console.error("Find failed:", e);
  }

  try {
    const res3 = await PostLedger.find({ postId: ["P-13092600"] }).lean();
    console.log("Array find worked:", res3.length);
  } catch (e) {
    console.error("Array find failed:", e);
  }
  process.exit(0);
}
test();
