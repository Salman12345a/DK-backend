import twilio from "twilio";
import { config } from "../../config/config.js";
import { trackOTPVerification } from "../../middleware/otpVerification.js";

const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

const validatePhoneNumber = (phoneNumber) => {
  // Ensure the phone number starts with +
  if (!phoneNumber.startsWith("+")) {
    console.warn(`Phone number doesn't start with +: ${phoneNumber}`);
    return false;
  }

  // Basic validation for international format
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  const isValid = phoneRegex.test(phoneNumber);

  if (!isValid) {
    console.warn(`Phone number failed regex validation: ${phoneNumber}`);
  }

  return isValid;
};

export const sendOTP = async (request, reply) => {
  try {
    console.log(
      "SendOTP request received:",
      JSON.stringify(request.body, null, 2)
    );

    const { phoneNumber } = request.body;

    if (!phoneNumber) {
      console.error("Phone number missing in sendOTP request");
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      console.error(`Invalid phone format: ${phoneNumber}`);
      return reply.code(400).send({
        status: "error",
        message:
          "Invalid phone number format. Please use international format (e.g., +91XXXXXXXXXX)",
      });
    }

    console.log(`Sending OTP to: ${phoneNumber}`);

    // Create a new client instance to ensure we get fresh env vars
    const localClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    console.log("SendOTP credentials:", {
      sid: process.env.TWILIO_ACCOUNT_SID ? "Set" : "Not set",
      token: process.env.TWILIO_AUTH_TOKEN ? "Set" : "Not set",
      service: process.env.TWILIO_VERIFY_SERVICE_SID || "Not set",
    });

    // Send verification token
    const verification = await localClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phoneNumber,
        channel: "sms",
        locale: "en",
      });

    console.log(`OTP sent successfully, status: ${verification.status}`);

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

    // Create a new client instance to ensure we get fresh env vars
    const localClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    console.log("VerifyOTP credentials:", {
      sid: process.env.TWILIO_ACCOUNT_SID ? "Set" : "Not set",
      token: process.env.TWILIO_AUTH_TOKEN ? "Set" : "Not set",
      service: process.env.TWILIO_VERIFY_SERVICE_SID || "Not set",
    });

    // Verify the token
    const verificationCheck = await localClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
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
