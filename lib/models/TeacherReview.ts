import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface ITeacherReview extends Document {
  name: string;
  qualification: string;
  experience: number;
  message: string;
  order: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherReviewSchema = new Schema<ITeacherReview>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    qualification: { type: String, required: true, trim: true, maxlength: 200 },
    experience: { type: Number, required: true, min: 0 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    order: { type: Number, required: true, default: 0 },
    isVisible: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
    collection: "teacher_reviews",
  },
);

TeacherReviewSchema.index({ order: 1 });
TeacherReviewSchema.index({ isVisible: 1, order: 1 });

const TeacherReview: Model<ITeacherReview> =
  models.TeacherReview ||
  mongoose.model<ITeacherReview>("TeacherReview", TeacherReviewSchema);

export default TeacherReview;
