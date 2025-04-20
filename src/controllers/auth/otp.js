import twilio from "twilio";
import { config } from "../../config/config.js";
import { trackOTPVerification } from "../../middleware/otpVerification.js";

const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};

export const sendOTP = async (request, reply) => {
  try {
    const { phoneNumber } = request.body;

    if (!phoneNumber) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return reply.code(400).send({
        status: "error",
        message:
          "Invalid phone number format. Please use international format (e.g., +91XXXXXXXXXX)",
      });
    }

    // Send verification token
    const verification = await client.verify.v2
      .services(config.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
        locale: "en",
      });

    // Reset verification status when sending new OTP
    await trackOTPVerification(phoneNumber, false);

    return reply.code(200).send({
      status: "success",
      message: "OTP sent successfully",
      data: {
        status: verification.status,
        validityPeriod: "10 minutes",
        retryAfter: "1 minute",
      },
    });
  } catch (error) {
    console.error("Error sending OTP:", error);

    // Handle specific Twilio errors
    if (error.code === 60200) {
      return reply.code(400).send({
        status: "error",
        message: "Invalid phone number provided",
      });
    } else if (error.code === 60203) {
      return reply.code(429).send({
        status: "error",
        message: "Max send attempts reached. Please try again later",
      });
    }

    return reply.code(500).send({
      status: "error",
      message: "Failed to send OTP",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

export const verifyOTP = async (request, reply) => {
  try {
    const { phoneNumber, otp } = request.body;

    if (!phoneNumber || !otp) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number and OTP are required",
      });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return reply.code(400).send({
        status: "error",
        message: "Invalid phone number format",
      });
    }

    // Verify the token
    const verificationCheck = await client.verify.v2
      .services(config.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code: otp,
      });

    if (verificationCheck.status === "approved") {
      // Track successful verification
      await trackOTPVerification(phoneNumber, true);

      return reply.code(200).send({
        status: "success",
        message: "OTP verified successfully",
        data: {
          verified: true,
          validFor: "30 minutes",
        },
      });
    } else {
      return reply.code(400).send({
        status: "error",
        message: "Invalid OTP",
        data: {
          verified: false,
          remainingAttempts: 3, // You can make this dynamic based on your Twilio configuration
        },
      });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);

    // Handle specific Twilio errors
    if (error.code === 60200) {
      return reply.code(400).send({
        status: "error",
        message: "Invalid phone number provided",
      });
    } else if (error.code === 60202) {
      return reply.code(400).send({
        status: "error",
        message: "Invalid or expired OTP",
      });
    }

    return reply.code(500).send({
      status: "error",
      message: "Failed to verify OTP",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
