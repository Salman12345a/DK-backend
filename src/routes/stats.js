import { getTotalDeliveredOrders, getTotalCustomers, getTotalBranches } from "../controllers/stats/stats.js";

export const statsRoutes = async (fastify, options) => {
  // Get total delivered orders
  fastify.get("/stats/orders/delivered", { 
    schema: {
      description: "Get total number of delivered orders",
      response: {
        200: {
          type: "integer",
          description: "Total count of delivered orders"
        }
      }
    }
  }, getTotalDeliveredOrders);

  // Get total customers
  fastify.get("/stats/customers", {
    schema: {
      description: "Get total number of registered customers",
      response: {
        200: {
          type: "integer",
          description: "Total count of registered customers"
        }
      }
    }
  }, getTotalCustomers);

  // Get total branches
  fastify.get("/stats/branches", {
    schema: {
      description: "Get total number of registered branches",
      response: {
        200: {
          type: "integer",
          description: "Total count of registered branches"
        }
      }
    }
  }, getTotalBranches);
};
