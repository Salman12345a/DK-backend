import { Customer } from "../../models/user.js";
import { sendOTP, verifyOTP } from "./otp.js";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Generate auth tokens for customer
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

// Step 1: Request OTP for phone verification
export const requestOTP = async (req, reply) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number is required",
      });
    }

    // Check if customer already exists with this phone number
    const existingCustomer = await Customer.findOne({ phone: phoneNumber });
    if (existingCustomer && existingCustomer.isActivated) {
      return reply.code(400).send({
        status: "error",
        message: "Customer already registered with this phone number",
      });
    }

    // Send OTP to the phone number
    const result = await sendOTP(
      { body: { phoneNumber }, log: req.log },
      { code: (code) => ({ send: (data) => data }) }
    );

    return reply.code(200).send({
      status: "success",
      message: "OTP sent successfully",
      data: {
        phoneNumber,
        otpSent: true,
        ...result,
      },
    });
  } catch (error) {
    console.error("Error in requestOTP:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to send OTP",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Step 2: Verify phone number with OTP
export const verifyPhoneNumber = async (req, reply) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate required fields
    if (!phoneNumber || !otp) {
      return reply.code(400).send({
        status: "error",
        message: "Phone number and OTP are required",
      });
    }

    // Verify OTP
    const verificationResult = await verifyOTP(
      { body: { phoneNumber, otp }, log: req.log },
      { code: (code) => ({ send: (data) => data }) }
    );

    if (!verificationResult.data || !verificationResult.data.verified) {
      return reply.code(400).send({
        status: "error",
        message: "Invalid OTP",
      });
    }

    // Generate a temporary verification token
    const verificationToken = jwt.sign(
      { phoneNumber, verified: true },
      process.env.ACCESS_TOKEN_SECRET || "default-access-secret",
      { expiresIn: "1h" }
    );

    return reply.code(200).send({
      status: "success",
      message: "Phone number verified successfully",
      data: {
        phoneNumber,
        verificationToken,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Error in verifyPhoneNumber:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to verify phone number",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Step 3: Complete registration with customer details after phone verification
export const completeRegistration = async (req, reply) => {
  try {
    const { verificationToken, name, age, gender, address } = req.body;

    // Validate required fields
    if (!verificationToken || !name || !age || !gender || !address) {
      return reply.code(400).send({
        status: "error",
        message:
          "All fields are required: verificationToken, name, age, gender, and address",
      });
    }

    // Validate address fields
    if (
      !address.street ||
      !address.landmark ||
      !address.city ||
      !address.pincode
    ) {
      return reply.code(400).send({
        status: "error",
        message:
          "Complete address is required (street, landmark, city, pincode)",
      });
    }

    // Verify the token to ensure phone was verified
    let decoded;
    try {
      decoded = jwt.verify(
        verificationToken,
        process.env.ACCESS_TOKEN_SECRET || "default-access-secret"
      );
    } catch (error) {
      return reply.code(401).send({
        status: "error",
        message: "Invalid or expired verification token",
      });
    }

    if (!decoded.phoneNumber || !decoded.verified) {
      return reply.code(401).send({
        status: "error",
        message: "Phone verification required before registration",
      });
    }

    // Check if customer already exists
    let customer = await Customer.findOne({ phone: decoded.phoneNumber });

    if (!customer) {
      // Create new customer after phone verification
      customer = new Customer({
        phone: decoded.phoneNumber,
        role: "Customer",
        isActivated: true, // Activated since phone is verified
        name,
        age,
        gender,
        address: {
          street: address.street,
          landmark: address.landmark,
          city: address.city,
          pincode: address.pincode,
        },
      });
    } else {
      // Update existing customer with details
      customer.name = name;
      customer.age = age;
      customer.gender = gender;
      customer.address = {
        street: address.street,
        landmark: address.landmark,
        city: address.city,
        pincode: address.pincode,
      };
      customer.isActivated = true;
    }

    // Save customer record
    await customer.save();

    // Generate authentication tokens
    const { accessToken, refreshToken } = generateTokens(customer);

    return reply.code(200).send({
      status: "success",
      message: "Registration completed successfully",
      data: {
        customer: {
          _id: customer._id,
          phone: customer.phone,
          name: customer.name,
          role: customer.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Error in completeRegistration:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to complete registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
