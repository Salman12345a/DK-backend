import mongoose from "mongoose";

const affiliateProductSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },
    imageUrl: { 
      type: String, 
      required: true 
    },
    affiliateLink: { 
      type: String, 
      required: true,
      trim: true 
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const AffiliateProduct = mongoose.model("AffiliateProduct", affiliateProductSchema);

export default AffiliateProduct;
