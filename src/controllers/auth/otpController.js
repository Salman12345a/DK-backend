import Branch from "../../models/branch.js";
import OTPService from "../../services/otpService.js";

export const sendOTP = async (request, reply) => {
  const logger = request.log;

  try {
    const { phone } = request.body;

    if (!phone) {
      return reply.code(400).send({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if branch exists
    const branch = await Branch.findOne({ phone });
    if (!branch) {
      return reply.code(404).send({
        success: false,
        message: "Branch not found",
      });
    }

    // Check rate limiting
    if (
      branch.phoneVerificationAttempts >= 3 &&
      branch.lastPhoneVerificationAttempt &&
      Date.now() - branch.lastPhoneVerificationAttempt.getTime() <
        15 * 60 * 1000
    ) {
      return reply.code(429).send({
        success: false,
        message: "Too many attempts. Please try again after 15 minutes.",
      });
    }

    // Generate and send OTP
    const otpResult = await OTPService.generateOTP(phone);
    if (!otpResult.success) {
      throw new Error(otpResult.error);
    }

    // Update verification attempt count
    await Branch.findByIdAndUpdate(branch._id, {
      $inc: { phoneVerificationAttempts: 1 },
      lastPhoneVerificationAttempt: new Date(),
    });

    logger.info({
      msg: "OTP sent successfully",
      phone,
    });

    return reply.send({
      success: true,
      message: "OTP sent successfully",
      token: otpResult.token,
      verificationCode: otpResult.verificationCode, // Remove in production
    });
  } catch (error) {
    logger.error({
      msg: "Error in sendOTP",
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to send OTP",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};

export const verifyOTP = async (request, reply) => {
  const logger = request.log;

  try {
    const { phone, otp, token } = request.body;

    if (!phone || !otp || !token) {
      return reply.code(400).send({
        success: false,
        message: "Phone number, OTP, and token are required",
      });
    }

    // Check if branch exists
    const branch = await Branch.findOne({ phone });
    if (!branch) {
      return reply.code(404).send({
        success: false,
        message: "Branch not found",
      });
    }

    // Verify OTP
    const verificationResult = await OTPService.verifyOTP(phone, otp, token);
    if (!verificationResult.success) {
      return reply.code(400).send({
        success: false,
        message: verificationResult.error,
      });
    }

    // Update branch verification status
    await Branch.findByIdAndUpdate(branch._id, {
      isPhoneVerified: true,
      phoneVerificationAttempts: 0,
      lastPhoneVerificationAttempt: null,
    });

    logger.info({
      msg: "Phone number verified successfully",
      phone,
    });

    return reply.send({
      success: true,
      message: "Phone number verified successfully",
    });
  } catch (error) {
    logger.error({
      msg: "Error in verifyOTP",
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      success: false,
      message: "Failed to verify OTP",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};
