import {
  getNearbyBranches,
  registerBranch,
  updateBranchStatus,
  getBranchStatus,
  modifyBranch,
} from "../controllers/branch/branch.js";
import { uploadBranchFiles } from "../middleware/uploadBranchFiles.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";

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

  fastify.get("/nearby", async (request, reply) => {
    console.log("Handling GET /nearby");
    return getNearbyBranches(request, reply);
  });

  fastify.post(
    "/register/branch",
    { preHandler: [uploadBranchFiles] },
    async (request, reply) => {
      console.log("Handling POST /register/branch");
      return registerBranch(request, reply);
    }
  );

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
            branchfrontImage: { type: "string" }, // URI string
            ownerIdProof: { type: "string" }, // URI string
            ownerPhoto: { type: "string" }, // URI string
          },
          // Optional: Make all fields optional since modifyBranch updates only provided fields
          // required: [], // Uncomment if all fields should be optional
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
