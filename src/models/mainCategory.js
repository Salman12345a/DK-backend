import mongoose from "mongoose";

const MainCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
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

// Compound index to ensure name is unique per branch
MainCategorySchema.index({ name: 1, branch: 1 }, { unique: true });

const MainCategory = mongoose.model("MainCategory", MainCategorySchema);

export default MainCategory;
