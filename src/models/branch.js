import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  phone: { type: Number, required: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
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

const Branch = mongoose.model("Branch", branchSchema, "branches");
export default Branch;
