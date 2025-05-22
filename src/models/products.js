import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true,
    },
    image: { type: String, required: false },
    imageUrl: { type: String, required: false }, // S3 URL for the product image
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    quantity: { type: String, required: true }, // e.g., "1 kg", "500 g"
    unit: { type: String, required: true }, // e.g., "kg", "liter", "pack"
    Category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isPacket: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
    },
    createdFromTemplate: {
      type: Boolean,
      default: false,
    },
    modifiedFromDefault: {
      type: Boolean,
      default: false,
    },
    defaultProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DefaultProduct",
      required: false,
    },
    disabledReason: {
      type: String,
    },
    lastDisabledAt: {
      type: Date,
    },
    lastModifiedBy: {
      type: String,
    },
    lastUpdatedFromDefault: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

// Initialize function to ensure proper index setup
export const initializeProductIndexes = async () => {
  try {
    // We'll use the schema-level index declaration instead of manually creating it here
    // This avoids duplicate index creation
    console.log('Product indexes are defined at the schema level');
  } catch (error) {
    console.error('Error initializing product indexes:', error);
    throw error;
  }
};

// Create compound index for branch and name
productSchema.index({ name: 1, branchId: 1 }, { 
  unique: true,
  background: true,
  name: 'unique_name_per_branch'
});

const Product = mongoose.model("Product", productSchema);

export default Product;
