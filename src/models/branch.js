// models/branch.js
import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  address: {
    type: String,
    required: true,
  },
  deliveryPartners: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner", // Reference to your DeliveryPartner model
    },
  ],
  operatingStatus: {
    type: String,
    enum: ["open", "closed", "holiday"],
    default: "open",
  },
  deliveryServiceAvailable: {
    type: Boolean,
    default: false, // Branch controls whether delivery is available
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Branch = mongoose.model("Branch", branchSchema, "branches");
export default Branch;
