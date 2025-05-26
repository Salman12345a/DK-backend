import Order from "../../models/order.js";
import { Customer } from "../../models/user.js";
import Branch from "../../models/branch.js";

/**
 * Get the total number of delivered orders
 */
export const getTotalDeliveredOrders = async (request, reply) => {
  try {
    const count = await Order.countDocuments({ status: "delivered" });
    return count;
  } catch (error) {
    console.error("Error counting delivered orders:", error);
    reply.code(500).send(error);
  }
};

/**
 * Get the total number of registered customers
 */
export const getTotalCustomers = async (request, reply) => {
  try {
    const count = await Customer.countDocuments();
    return count;
  } catch (error) {
    console.error("Error counting customers:", error);
    reply.code(500).send(error);
  }
};

/**
 * Get the total number of registered branches
 */
export const getTotalBranches = async (request, reply) => {
  try {
    const count = await Branch.countDocuments();
    return count;
  } catch (error) {
    console.error("Error counting branches:", error);
    reply.code(500).send(error);
  }
};
