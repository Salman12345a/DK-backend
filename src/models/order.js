import mongoose from "mongoose";
import Counter from "./counter.js";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
    },
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
        count: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
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
    deliveryServiceAvailable: {
      type: Boolean,
      default: false,
    },
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    modifiedAt: Date,
    modificationHistory: [
      {
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Branch",
        },
        changes: [String],
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    strictPopulate: false,
  }
);

orderSchema.pre("validate", async function (next) {
  try {
    const branch = await mongoose.model("Branch").findById(this.branch);
    if (!branch) return next(new Error("Branch not found"));
    if (!branch.deliveryServiceAvailable) {
      this.deliveryServiceAvailable = false;
    }
    next();
  } catch (error) {
    next(error);
  }
});

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
