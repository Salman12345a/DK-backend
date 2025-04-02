import { Customer } from "../../models/user.js";
import Branch from "../../models/branch.js";
import Order from "../../models/order.js";
import { DeliveryPartner } from "../../models/user.js";

export const selectCustomerBranch = async (request, reply) => {
  try {
    const customerId = request.user.userId;
    const { branchId } = request.body;

    if (!branchId) {
      return reply.code(400).send({
        status: "ERROR",
        message: "Branch ID is required",
        code: "MISSING_BRANCH_ID",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return reply.code(404).send({
        status: "ERROR",
        message: "Customer not found",
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.code(404).send({
        status: "ERROR",
        message: "Branch not found",
        code: "BRANCH_NOT_FOUND",
      });
    }

    customer.selectedBranch = branchId;
    await customer.save();

    return reply.code(200).send({
      customer: {
        _id: customer._id,
        selectedBranch: customer.selectedBranch,
        name: customer.name,
        phone: customer.phone,
        role: customer.role,
        liveLocation: customer.liveLocation,
        address: customer.address,
      },
    });
  } catch (error) {
    console.error("Error in selectCustomerBranch:", error);
    return reply.code(500).send({
      status: "ERROR",
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      systemError: error.message,
    });
  }
};

export const getLastCustomerBranch = async (request, reply) => {
  try {
    const customerId = request.user.userId;

    const customer = await Customer.findById(customerId).populate(
      "selectedBranch"
    );
    if (!customer) {
      return reply.code(404).send({
        status: "ERROR",
        message: "Customer not found",
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    const branch = customer.selectedBranch || null;
    return reply.code(200).send({
      branch: branch
        ? {
            _id: branch._id,
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            storeStatus: branch.storeStatus,
            deliveryServiceAvailable: branch.deliveryServiceAvailable,
            location: branch.location,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in getLastCustomerBranch:", error);
    return reply.code(500).send({
      status: "ERROR",
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      systemError: error.message,
    });
  }
};

export const getDeliveryServiceStatus = async (request, reply) => {
  try {
    const customerId = request.user.userId;
    const customer = await Customer.findById(customerId);
    if (!customer || !customer.selectedBranch) {
      return reply.code(400).send({
        status: "ERROR",
        message: "Customer or selected branch not found",
        code: "CUSTOMER_OR_BRANCH_NOT_FOUND",
      });
    }

    const latestOrder = await Order.findOne({
      customer: customerId,
      branch: customer.selectedBranch,
    }).sort({ createdAt: -1 });

    if (!latestOrder) {
      return reply.code(404).send({
        status: "ERROR",
        message: "No orders found for this branch",
        code: "NO_ORDERS_FOUND",
      });
    }

    // Real-time check for delivery availability, only approved partners
    const branch = await Branch.findById(customer.selectedBranch);
    const availablePartners = await DeliveryPartner.find({
      branch: customer.selectedBranch,
      status: "approved", // Ensure only approved partners count
      availability: true,
    }).limit(1);
    const isDeliveryAvailable =
      branch.deliveryServiceAvailable && availablePartners.length > 0;

    return reply.code(200).send({
      status: "SUCCESS",
      isDeliveryAvailable,
      deliveryEnabled: latestOrder.deliveryEnabled,
    });
  } catch (error) {
    console.error("Error in getDeliveryServiceStatus:", error);
    return reply.code(500).send({
      status: "ERROR",
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      systemError: error.message,
    });
  }
};
