import {
  getNearbyBranches,
  registerBranch,
} from "../controllers/branch/branch.js";
import { uploadBranchFiles } from "../middleware/uploadBranchFiles.js";

// Define branch-related routes
export const branchRoutes = async (fastify) => {
  // GET /api/nearby - Find branches within a specified radius
  fastify.get("/nearby", async (request, reply) => {
    return getNearbyBranches(request, reply);
  });

  // POST /api/register/branch - Register a new branch
  fastify.post(
    "/register/branch",
    {
      preHandler: [uploadBranchFiles], // Parse multipart data
    },
    async (request, reply) => {
      return registerBranch(request, reply);
    }
  );
};
