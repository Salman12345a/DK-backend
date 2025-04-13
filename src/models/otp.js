import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  phone: { type: Number, required: true },
  otpHash: { type: String, required: true }, // Hashed OTP
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5-minute TTL
  attempts: { type: Number, default: 0 }, // Track failed attempts
});

export const Otp = mongoose.model("Otp", otpSchema);
