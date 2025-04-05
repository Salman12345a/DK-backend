import fastify from "fastify";
import { authRoutes } from "./auth.js";
import { categoryRoutes, productRoutes } from "./product.js";
import { orderRoutes } from "./order.js";
import { syncmarts } from "./syncmarts.js";
import { deliveryPartnerRoutes } from "./deliveryPartner.js";
import { branchRoutes } from "./branch.js";
import customerRoutes from "./customer.js";

const prefix = "/api";

export const registerRoutes = async (fastifyInstance) => {
  try {
    fastifyInstance.register(authRoutes, { prefix: `${prefix}/auth` });
    fastifyInstance.register(categoryRoutes, {
      prefix: `${prefix}`,
    });
    fastifyInstance.register(productRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(orderRoutes, { prefix: `${prefix}/orders` });
    fastifyInstance.register(syncmarts, { prefix: `${prefix}/syncmarts` }); // Changed from `${prefix}`
    fastifyInstance.register(deliveryPartnerRoutes, {
      prefix: `${prefix}/delivery-partner`,
    });
    fastifyInstance.register(branchRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(customerRoutes, { prefix: `${prefix}/customer` });

    // Log all registered routes for debugging
    fastifyInstance.log.info("Registered routes:", fastifyInstance.routes);
  } catch (error) {
    console.error("Error registering routes:", error);
    throw new Error("Failed to register routes");
  }
};
