import {
  getNearbyBranches,
  initiateBranchRegistration,
  completeBranchRegistration,
  updateBranchStatus,
  getBranchStatus,
  modifyBranch,
} from "../controllers/branch/branch.js";
import { uploadBranchFiles } from "../middleware/uploadBranchFiles.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import { sendOTP, verifyOTP } from "../controllers/auth/otp.js";
import { rateLimitOTP } from "../middleware/otpVerification.js";

const checkAdminRole = async (req, reply) => {
  if (req.user.role !== "Admin") {
    return reply.code(403).send({
      status: "ERROR",
      message: "Unauthorized: Admin access required",
      code: "UNAUTHORIZED_ROLE",
    });
  }
  return true;
};

export const branchRoutes = async (fastify) => {
  fastify.addHook("onRequest", (request, reply, done) => {
    console.log(`Incoming request: ${request.method} ${request.url}`);
    done();
  });

  // Step 1: Initiate branch registration
  fastify.post(
    "/register/branch/initiate",
    { preHandler: [uploadBranchFiles] },
    async (request, reply) => {
      console.log("Handling POST /register/branch/initiate");
      return initiateBranchRegistration(request, reply);
    }
  );

  // Step 2: Send OTP
  fastify.post(
    "/register/branch/send-otp",
    { preHandler: [rateLimitOTP] },
    async (request, reply) => {
      return sendOTP(request, reply);
    }
  );

  // Step 3: Verify OTP
  fastify.post("/register/branch/verify-otp", async (request, reply) => {
    return verifyOTP(request, reply);
  });

  // Step 4: Complete Registration
  fastify.post("/register/branch/complete", async (request, reply) => {
    console.log("Handling POST /register/branch/complete");
    return completeBranchRegistration(request, reply);
  });

  // Other existing routes
  fastify.get("/branch/nearby", async (request, reply) => {
    console.log("Handling GET /nearby");
    return getNearbyBranches(request, reply);
  });

  fastify.patch(
    "/admin/branch/:branchId/status",
    { preHandler: [verifyToken] },
    async (request, reply) => {
      console.log(
        `PATCH request received for branchId: ${request.params.branchId} with body:`,
        request.body
      );
      try {
        const result = await updateBranchStatus(request, reply);
        console.log(
          `PATCH /admin/branch/${request.params.branchId}/status completed successfully`
        );
        return result;
      } catch (error) {
        console.error(
          `Error in PATCH /admin/branch/${request.params.branchId}/status:`,
          error.message
        );
        throw error;
      }
    }
  );

  fastify.get(
    "/branch/status/:branchId",
    { preHandler: [verifyToken] },
    async (request, reply) => {
      console.log(`Handling GET /branch/status/${request.params.branchId}`);
      return getBranchStatus(request, reply);
    }
  );

  fastify.patch(
    "/modify/branch/:branchId",
    {
      preHandler: [verifyToken, checkBranchRole],
      schema: {
        body: {
          type: "object",
          properties: {
            branchName: { type: "string" },
            location: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Point"] },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  minItems: 2,
                  maxItems: 2,
                },
              },
              required: ["type", "coordinates"],
            },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                area: { type: "string" },
                city: { type: "string" },
                pincode: { type: "string" },
              },
              required: ["street", "area", "city", "pincode"],
            },
            branchEmail: { type: "string" },
            openingTime: { type: "string" },
            closingTime: { type: "string" },
            ownerName: { type: "string" },
            govId: { type: "string" },
            phone: { type: "string" },
            homeDelivery: { type: "boolean" },
            selfPickup: { type: "boolean" },
            branchfrontImage: { type: "string" },
            ownerIdProof: { type: "string" },
            ownerPhoto: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      console.log(
        `PATCH request received for branchId: ${request.params.branchId} with body:`,
        request.body
      );
      try {
        const result = await modifyBranch(request, reply);
        console.log(
          `PATCH /api/modify/branch/${request.params.branchId} completed successfully`
        );
        return result;
      } catch (error) {
        console.error(
          `Error in PATCH /api/modify/branch/${request.params.branchId}:`,
          error.message
        );
        throw error;
      }
    }
  );
};
