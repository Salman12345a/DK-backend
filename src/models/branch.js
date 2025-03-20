import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  address: {
    street: { type: String, required: true },
    area: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  branchEmail: { type: String },
  openingTime: { type: String, required: true },
  closingTime: { type: String, required: true },
  ownerName: { type: String, required: true },
  govId: { type: String, required: true },
  deliveryServiceAvailable: { type: Boolean, default: false },
  selfPickup: { type: Boolean, default: false },
  branchfrontImage: { type: String },
  ownerIdProof: { type: String },
  ownerPhoto: { type: String },
  deliveryPartners: [
    { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner" },
  ],
  storeStatus: { type: String, enum: ["open", "closed"], default: "open" },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

branchSchema.index({ location: "2dsphere" });

const Branch = mongoose.model("Branch", branchSchema, "branches");
export default Branch;
