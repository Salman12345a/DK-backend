import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttempt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const OTPVerification = mongoose.model(
  "OTPVerification",
  otpVerificationSchema
);

export const trackOTPVerification = async (phoneNumber, status) => {
  try {
    const verification = await OTPVerification.findOneAndUpdate(
      { phoneNumber },
      {
        $set: {
          isVerified: status,
          verifiedAt: status ? new Date() : null,
          expiresAt: status ? new Date(Date.now() + 30 * 60 * 1000) : null, // 30 minutes expiry
        },
      },
      { upsert: true, new: true }
    );
    return verification;
  } catch (error) {
    console.error("Error tracking OTP verification:", error);
    throw error;
  }
};

export const verifyOTPStatus = async (request, reply) => {
  try {
    const { phone } = request.body;

    if (!phone) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    const verification = await OTPVerification.findOne({
      phoneNumber: phone,
      isVerified: true,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return reply.code(403).send({
        status: "error",
        message:
          "Phone number not verified or verification expired. Please verify your phone number first.",
      });
    }

    // Proceed to next middleware/handler
    return true;
  } catch (error) {
    console.error("Error verifying OTP status:", error);
    return reply.code(500).send({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const rateLimitOTP = async (request, reply) => {
  try {
    const { phoneNumber } = request.body;

    if (!phoneNumber) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    const verification = await OTPVerification.findOne({ phoneNumber });

    if (verification) {
      // Check if last attempt was within 1 minute
      if (
        verification.lastAttempt &&
        Date.now() - verification.lastAttempt.getTime() < 60000
      ) {
        return reply.code(429).send({
          status: "error",
          message: "Please wait 1 minute before requesting another OTP",
        });
      }

      // Check if max attempts (5) reached within 1 hour
      if (
        verification.attempts >= 5 &&
        verification.lastAttempt &&
        Date.now() - verification.lastAttempt.getTime() < 3600000
      ) {
        return reply.code(429).send({
          status: "error",
          message:
            "Maximum OTP attempts reached. Please try again after 1 hour",
        });
      }

      // Update attempts
      await OTPVerification.updateOne(
        { phoneNumber },
        {
          $inc: { attempts: 1 },
          $set: { lastAttempt: new Date() },
        }
      );
    } else {
      // Create new verification record
      await OTPVerification.create({
        phoneNumber,
        attempts: 1,
        lastAttempt: new Date(),
      });
    }

    // Proceed to next middleware/handler
    return true;
  } catch (error) {
    console.error("Error in rate limit middleware:", error);
    return reply.code(500).send({
      status: "error",
      message: "Internal server error",
    });
  }
};
