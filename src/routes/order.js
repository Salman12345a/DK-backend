import {
  createOrder,
  acceptOrder,
  markOrderAsPacked,
  assignDeliveryPartner,
  updateOrderStatus,
  getOrders,
  getOrderById,
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/auth.js";

export const orderRoutes = async (fastify, options) => {
  // Global authentication hook
  fastify.addHook("preHandler", async (request, reply) => {
    const isAuthenticated = await verifyToken(request, reply);
    if (!isAuthenticated) {
      return reply.code(401).send({ message: "Unauthenticated" });
    }
  });

  // Order creation(Customer)
  fastify.post("/", createOrder);

  // Branch actions(Syncmart)
  fastify.patch("/:orderId/accept", acceptOrder);
  fastify.patch("/:orderId/pack", markOrderAsPacked);
  fastify.patch("/:orderId/assign/:partnerId", assignDeliveryPartner);

  // Delivery partner actions(Syncer's)
  fastify.patch("/:orderId/status", updateOrderStatus);

  // Order retrieval
  fastify.get("/", getOrders);
  fastify.get("/:orderId", getOrderById);
};
