import fastify from "fastify";
import { authRoutes } from "./auth.js";
import {
  categoryRoutes,
  productRoutes,
  branchCategoryRoutes,
  branchProductRoutes,
  defaultCategoryRoutes,
  defaultProductRoutes,
} from "./product.js";
import { orderRoutes } from "./order.js";
import { syncmarts } from "./syncmarts.js";
import { deliveryPartnerRoutes } from "./deliveryPartner.js";
import { branchRoutes } from "./branch.js";
import customerRoutes from "./customer.js";
import { walletRoutes } from "./wallet.js"; // New import
import defaultTemplateRoutes from "./default-template.routes.js";
import { affiliateRoutes } from "./affiliate.js";
import { initializeCategoryIndexes } from "../models/category.js";
import { initializeProductIndexes } from "../models/products.js";

const prefix = "/api";

export const registerRoutes = async (fastifyInstance) => {
  try {
    // Initialize indexes
    await initializeCategoryIndexes();
    console.log('Category indexes initialized successfully');
    await initializeProductIndexes();
    console.log('Product indexes initialized successfully');

    // Create uploads directory if it doesn't exist
    const fs = await import("fs");
    const path = await import("path");
    const uploadsDir = "./uploads";
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    // Original routes
    fastifyInstance.register(authRoutes, { prefix: `${prefix}/auth` });
    fastifyInstance.register(categoryRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(productRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(orderRoutes, { prefix: `${prefix}/orders` });
    fastifyInstance.register(syncmarts, { prefix: `${prefix}/syncmarts` });
    fastifyInstance.register(deliveryPartnerRoutes, {
      prefix: `${prefix}/delivery-partner`,
    });
    fastifyInstance.register(branchRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(customerRoutes, { prefix: `${prefix}/customer` });
    fastifyInstance.register(walletRoutes, { prefix: `${prefix}` });

    // New branch-specific routes
    fastifyInstance.register(branchCategoryRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(branchProductRoutes, { prefix: `${prefix}` });

    // New admin routes for default templates
    fastifyInstance.register(defaultCategoryRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(defaultProductRoutes, { prefix: `${prefix}` });
    fastifyInstance.register(defaultTemplateRoutes, { prefix: `${prefix}/templates` });

    // Register affiliate product routes
    fastifyInstance.register(affiliateRoutes, { prefix: `${prefix}` });

    // Add a root health check endpoint for AWS Beanstalk
    fastifyInstance.get("/", async (request, reply) => {
      return {
        status: "ok",
        message: "DoKirana Backend is running",
        timestamp: new Date().toISOString(),
      };
    });

    // Log all registered routes for debugging
    fastifyInstance.log.info("Registered routes:", fastifyInstance.routes);
  } catch (error) {
    console.error("Error registering routes:", error);
    throw new Error("Failed to register routes");
  }
};
 