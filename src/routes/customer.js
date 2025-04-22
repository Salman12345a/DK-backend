import {
  selectCustomerBranch,
  getLastCustomerBranch,
  getDeliveryServiceStatus,
  updateLocation,
} from "../controllers/customer/customer.js";
import {
  requestOTP,
  verifyPhoneNumber,
  completeRegistration,
} from "../controllers/auth/customer.js";
import { verifyToken } from "../middleware/auth.js";

export default async function customerRoutes(fastify, options) {
  // Customer Registration Endpoints - 3 Step Flow

  // Step 1: Request OTP
  fastify.post(
    "/register/request-otp",
    {
      schema: {
        body: {
          type: "object",
          required: ["phoneNumber"],
          properties: {
            phoneNumber: { type: "string" },
          },
        },
      },
    },
    requestOTP
  );

  // Step 2: Verify OTP
  fastify.post(
    "/register/verify-otp",
    {
      schema: {
        body: {
          type: "object",
          required: ["phoneNumber", "otp"],
          properties: {
            phoneNumber: { type: "string" },
            otp: { type: "string" },
          },
        },
      },
    },
    verifyPhoneNumber
  );

  // Step 3: Complete Registration with Details
  fastify.post(
    "/register/complete",
    {
      schema: {
        body: {
          type: "object",
          required: ["verificationToken", "name", "age", "gender", "address"],
          properties: {
            verificationToken: {
              type: "string",
              description: "Token received after OTP verification in step 2",
            },
            name: { type: "string" },
            age: { type: "number" },
            gender: { type: "string", enum: ["male", "female", "other"] },
            address: {
              type: "object",
              required: ["street", "landmark", "city", "pincode"],
              properties: {
                street: { type: "string" },
                landmark: { type: "string" },
                city: { type: "string" },
                pincode: { type: "string" },
              },
            },
          },
        },
      },
    },
    completeRegistration
  );

  // Existing Customer Endpoints
  fastify.post(
    "/select-branch",
    { preHandler: [verifyToken] },
    selectCustomerBranch
  );
  fastify.get(
    "/last-branch",
    { preHandler: [verifyToken] },
    getLastCustomerBranch
  );
  fastify.get(
    "/delivery-status",
    { preHandler: [verifyToken] },
    getDeliveryServiceStatus
  );
  fastify.put(
    "/update-location",
    { preHandler: [verifyToken] },
    updateLocation
  );
}
