import mongoose, { Schema, type InferSchemaType } from "mongoose";

const onboardingDetailsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phone: { type: String, default: null },
    whatsapp: { type: String, default: null },
    address: { type: String, default: null, maxlength: 200 },
    teachingExp: {
      type: String,
      default: null,
      enum: ["0-1", "2-5", "6-10", "10+", null],
    },
    jobExp: {
      type: String,
      default: null,
      enum: ["0-1", "2-5", "6-10", "10+", null],
    },
    qualification: { type: String, default: null }, board: {
      type: String,
      default: null,
      enum: ["CBSE", "ICSE", "ISC", "IB", "WB-Bengali", "WB-English", null],
    },
    subjects: { type: [String], default: [] },
    plan: {
      type: String,
      default: null,
      enum: ["teacher", "teacher_candidate", null],
    },
    status: {
      type: String,
      enum: ["incomplete", "completed"],
      default: "incomplete",
    },
    // TTL field: set to now+72h on every save; cleared (null) on payment so
    // MongoDB does not auto-delete a paid user's onboarding record.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL index: MongoDB removes the document when expiresAt is reached.
// Documents with expiresAt = null are ignored by this index.
onboardingDetailsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IOnboardingDetails = InferSchemaType<
  typeof onboardingDetailsSchema
> & { _id: mongoose.Types.ObjectId };

const OnboardingDetails =
  (mongoose.models.OnboardingDetails as mongoose.Model<IOnboardingDetails>) ??
  mongoose.model<IOnboardingDetails>(
    "OnboardingDetails",
    onboardingDetailsSchema,
  );

export default OnboardingDetails;
