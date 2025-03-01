import {
  createOrder,
  acceptOrder,
  markOrderAsPacked,
  assignDeliveryPartner,
  updateOrderStatus,
  getOrders,
  getOrderById,
  orderCancel,
  modifyOrder, // Added explicitly for clarity
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/auth.js";

// Assuming checkBranchRole exists elsewhere
import { checkBranchRole } from "../middleware/auth.js"; // Adjust path if needed

export const orderRoutes = async (fastify, options) => {
  // Global authentication hook (kept for consistency, could be selective later)
  fastify.addHook("preHandler", async (request, reply) => {
    const isAuthenticated = await verifyToken(request, reply);
    if (!isAuthenticated) {
      return reply.code(401).send({ message: "Unauthenticated" });
    }
  });

  // Order creation (Customer)
  fastify.post("/", createOrder);

  // Branch actions (Syncmart)
  fastify.patch("/:orderId/accept", acceptOrder);
  fastify.patch("/:orderId/modify", {
    preHandler: checkBranchRole,
    schema: {
      body: {
        type: "object",
        required: ["modifiedItems"],
        properties: {
          modifiedItems: {
            type: "array",
            items: {
              type: "object",
              required: ["item", "count"],
              properties: {
                item: { type: "string" },
                count: { type: "number", minimum: 0 },
              },
            },
          },
        },
      },
      params: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
      },
    },
    handler: modifyOrder,
  });
  fastify.patch("/:orderId/pack", markOrderAsPacked);
  fastify.patch("/:orderId/assign/:partnerId", assignDeliveryPartner);
  fastify.patch("/:orderId/cancel", orderCancel);

  // Delivery partner actions (Syncer's)
  fastify.patch("/:orderId/status", updateOrderStatus);

  // Order retrieval
  fastify.get("/", getOrders);
  fastify.get("/:orderId", getOrderById);
};
