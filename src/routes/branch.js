import { getNearbyBranches } from "../controllers/branch/branch.js";

// Define branch-related routes
export const branchRoutes = async (fastify) => {
  // GET /branch/nearby - Find branches within a specified radius
  fastify.get("/nearby", async (request, reply) => {
    return getNearbyBranches(request, reply);
  });
};
