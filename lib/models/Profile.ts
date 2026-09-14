import mongoose, { Schema, type InferSchemaType } from "mongoose";

const socialLinksSchema = new Schema(
  {
    linkedin: { type: String, default: undefined },
    twitter: { type: String, default: undefined },
    github: { type: String, default: undefined },
  },
  { _id: false },
);

const profileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    clerkId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, default: null },
    bio: { type: String, default: null, maxlength: 300 },
    avatarUrl: { type: String, default: null },
    location: { type: String, default: null },
    websiteUrl: { type: String, default: null },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
    // Subject keys, not labels. This lets admin label changes flow through
    // automatically to every teacher profile.
    subjects: { type: [String], default: [] },
    experience: { type: Number, default: null },
    isPublic: { type: Boolean, default: true },
    // Onboarding fields
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
    qualification: { type: String, default: null },
    board: {
      type: String,
      default: null,
      enum: ["CBSE", "ICSE", "ISC", "IB", "WB-Bengali", "WB-English", null],
    },
    gender: {
      type: String,
      default: null,
      enum: ["male", "female", "other", null],
    },
  },
  { timestamps: true },
);

// Case-insensitive unique index on username
profileSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: "en_US", strength: 2 } },
);

export type IProfile = InferSchemaType<typeof profileSchema> & {
  _id: mongoose.Types.ObjectId;
};

const Profile =
  (mongoose.models.Profile as mongoose.Model<IProfile>) ??
  mongoose.model<IProfile>("Profile", profileSchema);

export default Profile;
