import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISource extends Document {
  key: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const SourceSchema = new Schema<ISource>(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
  },
  { timestamps: true }
);

const Source: Model<ISource> =
  mongoose.models.Source || mongoose.model<ISource>("Source", SourceSchema);

export default Source;
