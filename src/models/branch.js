import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  phone: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" }, // GeoJSON type
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  address: { type: String, required: true },
  deliveryPartners: [
    { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner" },
  ],
  storeStatus: {
    type: String,
    enum: ["open", "closed"],
    default: "open",
  },
  deliveryServiceAvailable: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add 2dsphere index for geospatial queries
branchSchema.index({ location: "2dsphere" });

const Branch = mongoose.model("Branch", branchSchema, "branches");
export default Branch;
