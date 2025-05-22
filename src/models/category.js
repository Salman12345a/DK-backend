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
      required: true,
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
    lastUpdatedFromDefault: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Initialize function to ensure proper index setup
export const initializeCategoryIndexes = async () => {
  try {
    // We'll use the schema-level index declaration instead of manually creating it here
    // This avoids duplicate index creation
    console.log('Category indexes are defined at the schema level');
  } catch (error) {
    console.error('Error initializing category indexes:', error);
    throw error;
  }
};

// Create compound index for name and branchId to ensure uniqueness per branch
categorySchema.index({ name: 1, branchId: 1 }, { 
  unique: true,
  background: true,
  name: 'unique_name_per_branch'
});

// Create the Category model
const Category = mongoose.model("Category", categorySchema);

export default Category;
