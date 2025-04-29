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
    // Drop all existing indexes except _id
    await Category.collection.dropIndexes();
    console.log('Dropped existing category indexes');

    // Create the compound index
    await Category.collection.createIndex(
      { name: 1, branchId: 1 },
      { 
        unique: true,
        background: true,
        name: 'unique_name_per_branch'
      }
    );
    console.log('Created new compound index for categories');
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
