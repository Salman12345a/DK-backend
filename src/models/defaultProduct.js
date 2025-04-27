import mongoose from "mongoose";

const defaultProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    suggestedPrice: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    }, // e.g., "kg", "liter", "pack"
    defaultCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DefaultCategory",
      required: true,
    },
    isPacket: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for category filtering
defaultProductSchema.index({ defaultCategory: 1 });

const DefaultProduct = mongoose.model("DefaultProduct", defaultProductSchema);
export default DefaultProduct;
