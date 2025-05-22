import {
  loginCustomer,
  loginDeliveryPartner,
  refreshToken,
  fetchUser,
  loginBranch,
  initiateBranchLogin,
  completeBranchLogin,
  initiateLogin,
  verifyLogin,
  loginAdmin,
} from "../controllers/auth/auth.js";
import { updateUser } from "../controllers/tracking/user.js";
import { verifyToken } from "../middleware/auth.js";
import { sendOTP, verifyOTP } from "../controllers/auth/otp.js";
import { rateLimitOTP } from "../middleware/otpVerification.js";

export const authRoutes = async (fastify, options) => {
  // Add a hook for parsing JSON body manually for specific routes
  fastify.addHook("preHandler", async (req, reply) => {
    console.log("Global preHandler hook triggered");

    // Check if it's the branch login initiate route
    if (req.routerPath === "/api/auth/branch/login/initiate") {
      console.log("Processing branch login initiate route");

      if (
        req.headers["content-type"] &&
        req.headers["content-type"].includes("application/json")
      ) {
        console.log("Detected JSON content type");

        // If body is a string, try to parse it
        if (typeof req.body === "string") {
          try {
            req.body = JSON.parse(req.body);
            console.log("Successfully parsed string body to JSON:", req.body);
          } catch (e) {
            console.error("Failed to parse JSON body:", e.message);
          }
        }
      }
    }
  });

  // Legacy customer login endpoint (without OTP verification)
  fastify.post("/customer/login", loginCustomer);

  // New customer login flow with OTP verification
  fastify.post(
    "/customer/login/initiate",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone"],
          properties: {
            phone: { type: "string" },
          },
        },
      },
    },
    initiateLogin
  );

  fastify.post(
    "/customer/login/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone", "otp"],
          properties: {
            phone: { type: "string" },
            otp: { type: "string" },
          },
        },
      },
    },
    verifyLogin
  );

  // Legacy branch login endpoint (without OTP verification)
  fastify.post("/branch/login", loginBranch);

  // New branch login flow with OTP verification
  fastify.post(
    "/branch/login/initiate",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            phone: { type: "string" },
          },
        },
      },
    },
    initiateBranchLogin
  );

  fastify.post(
    "/branch/login/complete",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            phoneNumber: { type: "string" },
            otp: { type: "string" },
          },
        },
      },
    },
    completeBranchLogin
  );

  fastify.post("/delivery/login", loginDeliveryPartner);
  
  // Admin login endpoint
  fastify.post("/admin/login", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" }
        }
      }
    }
  }, loginAdmin);
  
  fastify.post("/refresh-token", refreshToken);
  fastify.get("/user", { preHandler: [verifyToken] }, fetchUser);
  fastify.patch("/update", { preHandler: [verifyToken] }, updateUser);

  // These are general OTP endpoints used for registration
  fastify.post("/branch/send-otp", { preHandler: [rateLimitOTP] }, sendOTP);
  fastify.post("/branch/verify-otp", verifyOTP);

  // Test endpoint for JSON parsing
  fastify.post("/test-json", async (req, reply) => {
    console.log("Test JSON endpoint hit");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Body type:", typeof req.body);

    // Attempt to get the phone number
    let phone = null;
    if (req.body && typeof req.body === "object") {
      phone = req.body.phone;
    } else if (req.body && typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        phone = parsed.phone;
      } catch (e) {
        console.error("Error parsing body:", e.message);
      }
    }

    return reply.send({
      received: true,
      bodyType: typeof req.body,
      rawBody: req.body,
      extractedPhone: phone,
    });
  });

  // Test endpoint for branch login
  fastify.post("/branch-login-test", async (req, reply) => {
    console.log("Test branch login endpoint hit");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    console.log("Body type:", typeof req.body);

    // Attempt to get the phone number
    let phone = null;
    if (req.body && typeof req.body === "object") {
      phone = req.body.phone;
    } else if (req.body && typeof req.body === "string") {
      try {
        const parsed = JSON.parse(req.body);
        phone = parsed.phone;
      } catch (e) {
        console.error("Error parsing body:", e.message);
      }
    }

    // Return the extracted phone number to verify it worked
    return reply.send({
      success: true,
      phone: phone,
      message: phone
        ? "Successfully extracted phone number"
        : "Failed to extract phone number",
    });
  });
};
