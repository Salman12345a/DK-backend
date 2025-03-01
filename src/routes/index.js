import fastify from "fastify";
import { authRoutes } from "./auth.js";
import { categoryRoutes, productRoutes } from "./product.js";
import { orderRoutes } from "./order.js";
import { syncmarts } from "./syncmarts.js";

const prefix = "/api";

export const registerRoutes = async (fastify) => {
  // Auth routes under /api/auth
  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(productRoutes, { prefix: prefix });
  fastify.register(categoryRoutes, { prefix: prefix });
  fastify.register(orderRoutes, { prefix: "/api/orders" });
  fastify.register(syncmarts, { prefix: "/api" });
};
