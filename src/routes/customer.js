import { selectCustomerBranch } from "../controllers/customer/customer.js";
import { verifyToken } from "../middleware/auth.js";

export default async function customerRoutes(fastify, options) {
  // POST /api/customer/select-branch
  fastify.post(
    "/select-branch",
    {
      preHandler: [verifyToken], // Apply JWT authentication
    },
    selectCustomerBranch
  );
}
