import mongoose from "mongoose";

const DefaultMainCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const DefaultMainCategory = mongoose.model(
  "DefaultMainCategory",
  DefaultMainCategorySchema
);

export default DefaultMainCategory;
