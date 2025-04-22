import { Customer, DeliveryPartner } from "../../models/user.js";
import Branch from "../../models/branch.js";
import jwt from "jsonwebtoken";
import "dotenv/config";
import twilio from "twilio";
import { config } from "../../config/config.js";
import { sendOTP } from "./otp.js";

const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

const generateTokens = (user) => {
  const accessTokenSecret =
    process.env.ACCESS_TOKEN_SECRET || "default-access-secret";
  const refreshTokenSecret =
    process.env.REFRESH_TOKEN_SECRET || "default-refresh-secret";

  const accessToken = jwt.sign(
    { userId: user._id, role: user.role },
    accessTokenSecret,
    { expiresIn: "1d" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id, role: user.role },
    refreshTokenSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export const loginCustomer = async (req, reply) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return reply.status(400).send({ message: "Phone number is required" });
    }

    let customer = await Customer.findOne({ phone });

    if (!customer) {
      customer = new Customer({
        phone,
        role: "Customer",
        isActivated: true,
      });
      await customer.save();
    }

    const { accessToken, refreshToken } = generateTokens(customer);

    return reply.send({
      message: customer ? "Login Successful" : "Customer created and logged in",
      accessToken,
      refreshToken,
      customer,
    });
  } catch (error) {
    console.error("Error in loginCustomer:", error);
    return reply.status(500).send({
      message: "An error occurred",
      error: error.message || "Unknown error",
    });
  }
};

export const loginDeliveryPartner = async (req, reply) => {
  const logger = req.log; // Use Fastify's logger for consistency

  try {
    const { phone } = req.body;

    if (!phone) {
      logger.warn({ msg: "Phone number is required for login" });
      return reply.status(400).send({ message: "Phone number is required" });
    }

    const deliveryPartner = await DeliveryPartner.findOne({ phone });

    if (!deliveryPartner) {
      logger.warn({ msg: "Delivery partner not found", phone });
      return reply.status(404).send({ message: "Delivery partner not found" });
    }

    if (!deliveryPartner.isActivated) {
      logger.warn({ msg: "Delivery partner is not activated", phone });
      return reply
        .status(403)
        .send({ message: "Delivery partner is not activated" });
    }

    const { accessToken, refreshToken } = generateTokens(deliveryPartner);

    logger.info({
      msg: "Delivery partner logged in successfully",
      phone,
      id: deliveryPartner._id,
    });

    return reply.send({
      message: "Login Successful",
      accessToken,
      refreshToken,
      deliveryPartner,
    });
  } catch (error) {
    logger.error({
      msg: "Error in loginDeliveryPartner",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      message: "An error occurred",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export const loginBranch = async (req, reply) => {
  const logger = req.log; // Use Fastify's logger for consistency

  logger.warn({
    msg: "Deprecated: Using old branch login without OTP verification",
  });

  try {
    const { phone } = req.body;

    if (!phone) {
      logger.warn({ msg: "Phone number is required for login" });
      return reply.status(400).send({ message: "Phone number is required" });
    }

    const branch = await Branch.findOne({ phone });

    if (!branch) {
      logger.warn({ msg: "Branch not found", phone });
      return reply.status(404).send({ message: "Branch not found" });
    }

    const { accessToken, refreshToken } = generateTokens({
      _id: branch._id,
      role: "Branch",
    });

    logger.info({
      msg: "Branch logged in successfully",
      phone,
      id: branch._id,
    });

    return reply.send({
      message: "Branch login successful",
      accessToken,
      refreshToken,
      branch,
    });
  } catch (error) {
    logger.error({
      msg: "Error in loginBranch",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      message: "Branch login failed",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

// New function to initiate branch login with OTP
export const initiateBranchLogin = async (req, reply) => {
  const logger = req.log || console;

  try {
    // Fix for Postman-style requests where body may be an object with different structure
    console.log("Request body:", req.body);

    // Get phone number from request
    let phoneFromBody = null;

    // Try multiple ways to extract the phone from different request formats
    if (req.body) {
      // Case 1: Standard object with phone property
      if (typeof req.body === "object" && req.body.phone) {
        phoneFromBody = req.body.phone;
      }
      // Case 2: Postman raw JSON format as string
      else if (typeof req.body === "string") {
        try {
          const parsedBody = JSON.parse(req.body);
          if (parsedBody && parsedBody.phone) {
            phoneFromBody = parsedBody.phone;
          }
        } catch (e) {
          console.error("Failed to parse JSON string body:", e);
        }
      }
    }

    // Check if we found a phone number
    if (!phoneFromBody) {
      logger.warn({
        msg: "Phone number is required for login",
        body: req.body,
      });
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    // Check if the branch exists with exact phone match first
    let branch = await Branch.findOne({ phone: phoneFromBody });

    // If not found, try with a '+' prefix
    if (!branch && !phoneFromBody.startsWith("+")) {
      const phoneWithPlus = `+${phoneFromBody}`;
      branch = await Branch.findOne({ phone: phoneWithPlus });
      console.log(
        `Tried finding branch with +prefix: ${phoneWithPlus}, found: ${!!branch}`
      );
    }

    // If still not found, try without the '+' prefix
    if (!branch && phoneFromBody.startsWith("+")) {
      const phoneWithoutPlus = phoneFromBody.substring(1);
      branch = await Branch.findOne({ phone: phoneWithoutPlus });
      console.log(
        `Tried finding branch without +prefix: ${phoneWithoutPlus}, found: ${!!branch}`
      );
    }

    if (!branch) {
      logger.warn({ msg: "Branch not found", phone: phoneFromBody });
      return reply.code(404).send({
        status: "error",
        message: "Branch not found with this phone number",
      });
    }

    logger.info({
      msg: "Branch login initiated, sending OTP",
      phone: phoneFromBody,
      branchId: branch._id,
    });

    // Format phone for Twilio (needs to be in E.164 format)
    let formattedPhone = phoneFromBody;
    if (!phoneFromBody.startsWith("+")) {
      formattedPhone = `+${phoneFromBody}`;
    }

    // Create a separate request for the OTP service
    const otpRequest = {
      body: {
        phoneNumber: formattedPhone,
      },
      log: logger,
    };

    // Forward to OTP sender
    return await sendOTP(otpRequest, reply);
  } catch (error) {
    logger.error({
      msg: "Error in initiateBranchLogin",
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      status: "error",
      message: "Failed to initiate branch login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// New function to complete branch login after OTP verification
export const completeBranchLogin = async (req, reply) => {
  const logger = req.log;

  try {
    logger.info({
      msg: "Received branch login complete request",
      body: req.body,
    });

    const { phoneNumber, otp } = req.body || {};

    if (!phoneNumber || !otp) {
      logger.warn({
        msg: "Missing phone number or OTP",
        receivedBody: req.body,
      });
      return reply.code(400).send({
        status: "error",
        message: "Phone number and OTP are required",
      });
    }

    // Create a new client instance right here to ensure we get fresh env vars
    const localClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    logger.info({
      msg: "Attempting OTP verification with credentials",
      sid: process.env.TWILIO_ACCOUNT_SID ? "Set" : "Not set",
      token: process.env.TWILIO_AUTH_TOKEN ? "Set" : "Not set",
      service: process.env.TWILIO_VERIFY_SERVICE_SID || "Not set",
    });

    // Verify the OTP
    try {
      const verificationCheck = await localClient.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({
          to: phoneNumber,
          code: otp,
        });

      logger.info({
        msg: "OTP verification result",
        status: verificationCheck.status,
        phoneNumber,
      });

      if (verificationCheck.status !== "approved") {
        logger.warn({
          msg: "Invalid OTP during branch login",
          phone: phoneNumber,
          status: verificationCheck.status,
        });
        return reply.code(400).send({
          status: "error",
          message: "Invalid OTP",
        });
      }
    } catch (otpError) {
      logger.error({
        msg: "Error verifying OTP with Twilio",
        error: otpError.message,
        code: otpError.code,
        phoneNumber,
      });

      return reply.code(400).send({
        status: "error",
        message: otpError.message || "Failed to verify OTP",
        code: otpError.code,
      });
    }

    // Clean phone number format (remove '+' if it exists)
    const cleanPhone = phoneNumber.startsWith("+")
      ? phoneNumber.substring(1)
      : phoneNumber;

    // Look up the branch
    const branch = await Branch.findOne({
      $or: [{ phone: phoneNumber }, { phone: cleanPhone }],
    });

    if (!branch) {
      logger.warn({
        msg: "Branch not found after OTP verification",
        phone: phoneNumber,
      });
      return reply.code(404).send({
        status: "error",
        message: "Branch not found",
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      _id: branch._id,
      role: "Branch",
    });

    logger.info({
      msg: "Branch login completed successfully with OTP verification",
      phone: phoneNumber,
      id: branch._id,
    });

    return reply.code(200).send({
      status: "success",
      message: "Branch login successful",
      data: {
        accessToken,
        refreshToken,
        branch,
      },
    });
  } catch (error) {
    logger.error({
      msg: "Error in completeBranchLogin",
      error: error.message,
      stack: error.stack,
    });
    return reply.code(500).send({
      status: "error",
      message: "Failed to complete branch login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const refreshToken = async (req, reply) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    console.error("No refresh token provided");
    return reply.status(401).send({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return reply.status(403).send({ message: "Token has expired" });
    }

    let user;
    if (decoded.role === "Customer") {
      user = await Customer.findById(decoded.userId);
    } else if (decoded.role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(decoded.userId);
    } else {
      return reply.status(403).send({ message: "Invalid Role" });
    }

    if (!user) {
      return reply.status(403).send({ message: "Invalid refresh token" });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    return reply.send({
      message: "Token Refreshed",
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Error in refreshToken:", error);
    return reply.status(403).send({
      message: "Invalid Refresh Token",
      error: error.message || "Unknown error",
    });
  }
};

export const fetchUser = async (req, reply) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.error("Token Missing in Request");
      return reply.status(401).send({ message: "Token is required" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;

    const { userId, role } = decoded;
    if (!userId || !role) {
      console.error("Token Missing Required Claims");
      return reply.status(403).send({ message: "Invalid Token Claims" });
    }

    let user;
    if (role === "Customer") {
      user = await Customer.findById(userId);
    } else if (role === "DeliveryPartner") {
      user = await DeliveryPartner.findById(userId);
    } else {
      return reply.status(403).send({ message: "Invalid role" });
    }

    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }

    return reply.send({ user });
  } catch (error) {
    console.error("Error in fetchUser:", error);
    return reply.status(500).send({
      message: "An error occurred",
      error: error.message || "Unknown error",
    });
  }
};
