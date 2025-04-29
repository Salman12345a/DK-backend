import mongoose from "mongoose";

// Define the category schema
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Remove leading/trailing whitespace
      unique: false, // Explicitly set to false to prevent unique constraint on just the name
    },
    image: {
      type: String,
      required: false,
      default: "",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true, // Make branchId required to ensure proper indexing
    },
    imageUrl: {
      type: String, // S3 URL for the category image
      required: false,
      default: "",
    },
    createdFromTemplate: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      enum: ["system", "branch_admin"],
      default: "branch_admin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    defaultCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DefaultCategory",
      required: false,
    },
  },
  { timestamps: true }
);

// Drop any existing indexes to ensure clean state
categorySchema.index({ name: 1 }, { unique: false }); // Explicitly override any existing unique index on name

// Ensure the combination of name and branchId is unique
// This allows same category names across different branches
categorySchema.index({ name: 1, branchId: 1 }, { unique: true });

// Create the Category model using the schema
const Category = mongoose.model("Category", categorySchema);

// Export the Category model to use in other files
export default Category;
