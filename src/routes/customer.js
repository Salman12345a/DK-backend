import {
  selectCustomerBranch,
  getLastCustomerBranch,
  getDeliveryServiceStatus,
  updateLocation,
} from "../controllers/customer/customer.js";
import { verifyToken } from "../middleware/auth.js";

export default async function customerRoutes(fastify, options) {
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
