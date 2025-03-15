import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String },
  role: {
    type: String,
    enum: ["Customer", "Admin", "DeliveryPartner"],
    required: true,
  },
  isActivated: { type: Boolean, default: false },
});

const customerSchema = new mongoose.Schema({
  ...userSchema.obj,
  phone: { type: Number, required: true, unique: true },
  role: { type: String, enum: ["Customer"], default: "Customer" },
  liveLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  address: { type: String },
  selectedBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" }, // Added field
});

const deliveryPartnerSchema = new mongoose.Schema({
  ...userSchema.obj,
  phone: { type: Number, required: true },
  role: { type: String, enum: ["DeliveryPartner"], default: "DeliveryPartner" },
  liveLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
  },
  address: { type: String },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
  },
  availability: { type: Boolean, default: true },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  age: { type: Number, required: true },
  gender: { type: String, enum: ["male", "female", "other"], required: true },
  licenseNumber: { type: String, required: true, unique: true },
  rcNumber: { type: String, required: true, unique: true },
  documents: [
    {
      type: {
        type: String,
        enum: ["license", "rc", "photo", "aadhaarFront", "aadhaarBack"],
        required: true,
      },
      url: { type: String, required: true },
    },
  ],
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  rejectionMessage: { type: String, required: false },
});

const adminSchema = new mongoose.Schema({
  ...userSchema.obj,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Admin"], default: "Admin" },
  address: { type: String },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
});

export const Customer = mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.model(
  "DeliveryPartner",
  deliveryPartnerSchema
);
export const Admin = mongoose.model("Admin", adminSchema);
