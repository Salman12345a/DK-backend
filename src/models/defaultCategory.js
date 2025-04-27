import mongoose from "mongoose";

// Define the default category schema
const defaultCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    imageUrl: {
      type: String, // S3 URL for the category image
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Create the DefaultCategory model using the schema
const DefaultCategory = mongoose.model(
  "DefaultCategory",
  defaultCategorySchema
);

// Export the DefaultCategory model to use in other files
export default DefaultCategory;
