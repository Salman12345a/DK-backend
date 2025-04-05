import {
  createOrder,
  acceptOrder,
  markOrderAsPacked,
  assignDeliveryPartner,
  updateOrderStatus,
  getOrders,
  getOrderById,
  orderCancel,
  modifyOrder,
  getDeliveryAvailability, // New import for the controller function
} from "../controllers/order/order.js";
import { verifyToken } from "../middleware/auth.js";
import { checkBranchRole } from "../middleware/auth.js";

export const orderRoutes = async (fastify, options) => {
  // Global authentication hook
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

  // New endpoint: Check delivery availability
  fastify.get("/delivery-availability/:branchId", {
    schema: {
      params: {
        type: "object",
        properties: {
          branchId: { type: "string" },
        },
        required: ["branchId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            isDeliveryAvailable: { type: "boolean" },
          },
        },
        404: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
        500: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
      },
    },
    handler: getDeliveryAvailability,
  });
};
