import {
  selectCustomerBranch,
  getLastCustomerBranch,
} from "../controllers/customer/customer.js"; // Add new import
import { verifyToken } from "../middleware/auth.js";

export default async function customerRoutes(fastify, options) {
  // POST /api/customer/select-branch
  fastify.post(
    "/select-branch",
    { preHandler: [verifyToken] },
    selectCustomerBranch
  );

  // GET /api/customer/last-branch
  fastify.get(
    "/last-branch",
    { preHandler: [verifyToken] },
    getLastCustomerBranch
  );
}
