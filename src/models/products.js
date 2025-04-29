import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      unique: false, // Explicitly set to false to prevent unique constraint on just the name
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
      required: true, // Make branchId required to ensure proper indexing
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
  },
  { timestamps: true }
);

// Drop any existing indexes to ensure clean state
productSchema.index({ name: 1 }, { unique: false }); // Explicitly override any existing unique index on name

// Create compound index for branch and name - allows same product names across different branches
productSchema.index({ name: 1, branchId: 1 }, { unique: true });

// Index for quick filtering by availability
productSchema.index({ branchId: 1, isAvailable: 1 });

// Index for category filtering
productSchema.index({ Category: 1, branchId: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
