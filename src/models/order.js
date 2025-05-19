import mongoose from "mongoose";
import Counter from "./counter.js";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryPartner",
      required: false,
    },
    items: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        count: { type: Number, required: true },
        quantity: { type: Number }, // For loose products
        unit: { type: String }, // Unit of measurement (kg, liter, pack, etc.)
        isPacket: { type: Boolean }, // To store if item is packed or loose
        price: { type: Number, required: true },
      },
    ],
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "placed",
        "accepted",
        "packed",
        "assigned",
        "arriving",
        "delivered",
        "cancelled",
      ],
      default: "placed",
    },
    deliveryEnabled: { type: Boolean, default: false }, // Sole delivery flag
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    totalPrice: { type: Number, required: true },
    modifiedAt: Date,
    modificationHistory: [
      {
        modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
        changes: [String],
        timestamp: { type: Date, default: Date.now },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deliveryLocation: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      address: { type: String, default: "No address available" },
    },
    pickupLocation: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
      address: { type: String, default: "No address available" },
    },
    manuallyCollected: { type: Boolean, default: false }, // Add this
  },
  { strictPopulate: false }
);

async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
}

orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const sequenceValue = await getNextSequenceValue("orderId");
    this.orderId = `QRDR${sequenceValue.toString().padStart(5, "0")}`;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
