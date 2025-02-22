import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";

const defaultLocation = {
  latitude: 0,
  longitude: 0,
  address: "No address available",
};

export const createOrder = async (req, reply) => {
  try {
    const { userId } = req.user; // From JWT token
    const { items, branch, totalPrice } = req.body;

    // Validate input
    if (!items?.length || !branch || !totalPrice) {
      return reply.status(400).send({ message: "Missing required fields" });
    }

    // Get customer and branch
    const [customer, branchData] = await Promise.all([
      Customer.findById(userId),
      Branch.findById(branch),
    ]);

    // Add debug logs
    console.log("Customer Lookup:", customer ? "Found" : "Missing");
    console.log("Branch Lookup:", branchData ? "Found" : "Missing");

    console.log("Received Branch ID:", branch);
    console.log("Branch Data:", branchData);

    if (!customer) {
      return reply.status(404).send({ message: "Customer not found" });
    }
    if (!branchData) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Check delivery service availability (example logic)
    const deliveryServiceAvailable = branchData.deliveryPartners?.length > 0;

    const newOrder = new Order({
      customer: userId,
      items: items.map((item) => ({
        id: item.id,
        item: item.id,
        count: Number(item.count),
      })),
      branch,
      totalPrice,
      status: "placed",
      deliveryServiceAvailable,
      statusHistory: [{ status: "placed" }],
      deliveryLocation: {
        latitude: customer.liveLocation?.latitude || defaultLocation.latitude,
        longitude:
          customer.liveLocation?.longitude || defaultLocation.longitude,
        address: customer.address || defaultLocation.address,
      },
      pickupLocation: {
        latitude: branchData.location?.latitude || defaultLocation.latitude,
        longitude: branchData.location?.longitude || defaultLocation.longitude,
        address: branchData.address || defaultLocation.address,
      },
    });

    // Auto-accept if delivery available
    if (newOrder.deliveryServiceAvailable) {
      newOrder.status = "accepted";
      newOrder.statusHistory.push({ status: "accepted" });
    }

    const savedOrder = await newOrder.save();

    // Notify branch
    req.server.io.to(`branch_${branch}`).emit("newOrder", savedOrder);

    return reply.status(201).send(savedOrder);
  } catch (err) {
    console.error("Create Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order creation failed", error: err.message });
  }
};

export const acceptOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.status !== "placed") {
      return reply.status(400).send({ message: "Order cannot be accepted" });
    }

    order.status = "accepted";
    order.statusHistory.push({ status: "accepted" });
    await order.save();

    req.server.io.to(`branch_${order.branch}`).emit("orderAccepted", order);
    return reply.send(order);
  } catch (err) {
    console.error("Accept Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order acceptance failed", error: err.message });
  }
};

export const markOrderAsPacked = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.status !== "accepted") {
      return reply
        .status(400)
        .send({ message: "Order must be accepted first" });
    }

    order.status = "packed";
    order.statusHistory.push({ status: "packed" });
    await order.save();

    // Notify available delivery partners
    const branch = await Branch.findById(order.branch).populate(
      "deliveryPartners"
    );
    branch.deliveryPartners.forEach((partner) => {
      req.server.io
        .to(`partner_${partner._id}`)
        .emit("orderReadyForAssignment", order);
    });

    return reply.send(order);
  } catch (err) {
    console.error("Pack Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order packing failed", error: err.message });
  }
};

export const assignDeliveryPartner = async (req, reply) => {
  try {
    const { orderId, partnerId } = req.params;
    const [order, partner] = await Promise.all([
      Order.findById(orderId),
      DeliveryPartner.findById(partnerId),
    ]);

    if (!order || !partner) {
      return reply.status(404).send({ message: "Order/Partner not found" });
    }
    if (order.status !== "packed") {
      return reply.status(400).send({ message: "Order must be packed first" });
    }
    if (!partner.availability) {
      return reply.status(400).send({ message: "Partner unavailable" });
    }

    order.status = "assigned";
    order.deliveryPartner = partnerId;
    order.statusHistory.push({ status: "assigned" });

    partner.availability = false;
    partner.currentOrder = orderId;

    await Promise.all([order.save(), partner.save()]);

    // Notify all parties
    req.server.io.to(`branch_${order.branch}`).emit("orderAssigned", order);
    req.server.io.to(`partner_${partnerId}`).emit("newAssignment", order);
    req.server.io.to(`customer_${order.customer}`).emit("orderAssigned", order);

    return reply.send(order);
  } catch (err) {
    console.error("Assignment Error:", err);
    return reply
      .status(500)
      .send({ message: "Partner assignment failed", error: err.message });
  }
};

export const updateOrderStatus = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { userId } = req.user;

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });

    // In updateOrderStatus controller
    console.log("User ID:", userId);
    console.log("Order's Delivery Partner:", order.deliveryPartner?.toString());

    // Authorization check
    if (order.deliveryPartner?.toString() !== userId) {
      return reply.status(403).send({ message: "Unauthorized action" });
    }

    // Validate status transitions
    const validTransitions = {
      assigned: ["arriving", "delivered", "cancelled"],
      arriving: ["delivered"],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return reply.status(400).send({ message: "Invalid status transition" });
    }

    order.status = status;
    order.statusHistory.push({ status });
    await order.save();

    // Real-time updates
    req.server.io.to(orderId).emit("statusUpdate", order);

    // Release partner if order completed
    if (["delivered", "cancelled"].includes(status)) {
      await DeliveryPartner.findByIdAndUpdate(userId, {
        availability: true,
        $unset: { currentOrder: "" },
      });
    }

    return reply.send(order);
  } catch (err) {
    console.error("Status Update Error:", err);
    return reply
      .status(500)
      .send({ message: "Status update failed", error: err.message });
  }
};

export const getOrders = async (req, reply) => {
  try {
    const { status, branchId, customerId, partnerId } = req.query;
    const filter = {};

    if (status) filter.status = status.split(",");
    if (branchId) filter.branch = branchId;
    if (customerId) filter.customer = customerId;
    if (partnerId) filter.deliveryPartner = partnerId;

    const orders = await Order.find(filter)
      .populate("customer branch deliveryPartner")
      .sort({ createdAt: -1 });

    return reply.send(orders);
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    return reply
      .status(500)
      .send({ message: "Failed to fetch orders", error: err.message });
  }
};

export const getOrderById = async (req, reply) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
      "customer branch deliveryPartner items.item"
    );

    return order
      ? reply.send(order)
      : reply.status(404).send({ message: "Order not found" });
  } catch (err) {
    console.error("Fetch Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Failed to fetch order", error: err.message });
  }
};
