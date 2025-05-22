import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
    // unique index defined explicitly below
  },
  balance: { type: Number, default: 0 },
  transactions: [
    {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
      amount: { type: Number, required: true },
      type: {
        type: String,
        enum: ["order", "payment"],
        required: true,
      },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Add index on branchId for faster lookups
walletSchema.index({ branchId: 1 });

const Wallet = mongoose.model("Wallet", walletSchema, "wallets");
export default Wallet;
