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
    // Drop all existing indexes except _id
    await Product.collection.dropIndexes();
    console.log('Dropped existing product indexes');

    // Create the compound index
    await Product.collection.createIndex(
      { name: 1, branchId: 1 },
      { 
        unique: true,
        background: true,
        name: 'unique_name_per_branch'
      }
    );
    console.log('Created new compound index for products');
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
