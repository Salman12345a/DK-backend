import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["opened", "closed"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  isManual: {
    type: Boolean,
    default: false,
  },
  reason: {
    type: String,
    required: true,
  },
});

const branchSchema = new mongoose.Schema(
  {
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
    storeStatus: { type: String, enum: ["open", "closed"], default: "closed" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    isManuallyClosed: {
      type: Boolean,
      default: false,
    },
    canReopen: {
      type: Boolean,
      default: true,
    },
    lastStatusUpdate: {
      type: Date,
      default: Date.now,
    },
    statusHistory: [statusHistorySchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

branchSchema.index({ location: "2dsphere" });
branchSchema.index({ phone: 1 });
branchSchema.index({ branchEmail: 1 });
branchSchema.index({ isOpen: 1 });
branchSchema.index({ isManuallyClosed: 1 });

const Branch = mongoose.model("Branch", branchSchema, "branches");
export default Branch;
