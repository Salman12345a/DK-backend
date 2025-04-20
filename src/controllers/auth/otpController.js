import Branch from "../../models/branch.js";
import OTPService from "../../services/otpService.js";

export const sendOTP = async (request, reply) => {
  try {
    const { phoneNumber } = request.body;

    if (!phoneNumber) {
      return reply.code(400).send({
        success: false,
        error: "Phone number is required",
      });
    }

    const result = await OTPService.generateOTP(phoneNumber);

    if (!result.success) {
      return reply.code(400).send(result);
    }

    return reply.code(200).send(result);
  } catch (error) {
    console.error("Error in sendOTP controller:", error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
    });
  }
};

export const verifyOTP = async (request, reply) => {
  try {
    const { phoneNumber, code, token } = request.body;

    if (!phoneNumber || !code || !token) {
      return reply.code(400).send({
        success: false,
        error: "Phone number, verification code, and token are required",
      });
    }

    // First verify the OTP
    const verifyResult = await OTPService.verifyOTP(phoneNumber, code);
    if (!verifyResult.success) {
      return reply.code(400).send(verifyResult);
    }

    // Then verify the Firebase token
    const tokenResult = await OTPService.verifyPhoneToken(token);
    if (!tokenResult.success) {
      return reply.code(401).send(tokenResult);
    }

    // Check if the phone numbers match
    const formattedPhone = OTPService.formatPhoneNumber(phoneNumber);
    if (formattedPhone !== tokenResult.phoneNumber) {
      return reply.code(400).send({
        success: false,
        error: "Phone number mismatch",
      });
    }

    // Update branch phone verification status
    const branch = await Branch.findOne({ phone: phoneNumber });
    if (branch) {
      branch.isPhoneVerified = true;
      branch.phoneVerificationAttempts = 0;
      branch.lastPhoneVerificationAttempt = new Date();
      await branch.save();
    }

    return reply.code(200).send({
      success: true,
      message: "Phone number verified successfully",
      phoneNumber: tokenResult.phoneNumber,
    });
  } catch (error) {
    console.error("Error in verifyOTP controller:", error);
    return reply.code(500).send({
      success: false,
      error: "Internal server error",
    });
  }
};
