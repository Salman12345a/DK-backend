import mongoose from "mongoose";

// Define the category schema
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Remove leading/trailing whitespace
    },
    image: {
      type: String,
      required: false,
      default: "",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
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
  },
  { timestamps: true }
);

// Ensure the combination of name and branchId is unique
categorySchema.index({ name: 1, branchId: 1 }, { unique: true });

// Create the Category model using the schema
const Category = mongoose.model("Category", categorySchema);

// Export the Category model to use in other files
export default Category;
