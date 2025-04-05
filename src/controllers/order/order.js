import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";
import Product from "../../models/products.js";

const defaultLocation = {
  latitude: 0,
  longitude: 0,
  address: "No address available",
};

const validateModifications = (originalItems, modifiedItems) => {
  const itemMap = new Map(originalItems.map((o) => [o.item._id.toString(), o]));
  const changes = [];
  const updatedItems = [];
  let newTotal = 0;

  for (const modItem of modifiedItems) {
    const origItem = itemMap.get(modItem.item.toString());
    if (!origItem) {
      return { valid: false, message: "Cannot add new items" };
    }
    if (modItem.count > origItem.count) {
      return {
        valid: false,
        message: `Cannot increase quantity for ${origItem.item.name}`,
      };
    }
    if (modItem.count === 0) {
      changes.push(`Removed ${origItem.item.name} (${origItem.count}x)`);
    } else if (modItem.count < origItem.count) {
      changes.push(
        `Reduced ${origItem.item.name} from ${origItem.count} to ${modItem.count}`
      );
      updatedItems.push({
        item: origItem.item._id,
        count: modItem.count,
        price: origItem.price,
      });
      newTotal += origItem.price * modItem.count;
    } else {
      updatedItems.push({
        item: origItem.item._id,
        count: modItem.count,
        price: origItem.price,
      });
      newTotal += origItem.price * modItem.count;
    }
    itemMap.delete(modItem.item.toString());
  }

  itemMap.forEach((origItem) => {
    changes.push(`Removed ${origItem.item.name} (${origItem.count}x)`);
  });

  return {
    valid: true,
    updatedItems,
    newTotal,
    changes,
    message: changes.join(", ") || "No changes made",
  };
};

export const modifyOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { modifiedItems } = req.body;
    const branchId = req.user.userId;

    if (!modifiedItems || !Array.isArray(modifiedItems)) {
      return reply.code(400).send({
        status: "ERROR",
        message: "Invalid modification data",
        code: "INVALID_MODIFICATION_DATA",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      branch: branchId,
      status: "accepted",
    }).populate("items.item", "name price");

    if (!order) {
      return reply.code(404).send({
        status: "ERROR",
        message: "Order not found or not modifiable",
        code: "ORDER_NOT_MODIFIABLE",
      });
    }

    const validation = validateModifications(order.items, modifiedItems);
    if (!validation.valid) {
      return reply.code(400).send({
        status: "ERROR",
        message: validation.message,
        code: "MODIFICATION_VALIDATION_FAILED",
      });
    }

    order.items = validation.updatedItems;
    order.totalPrice = validation.newTotal;
    order.modifiedAt = new Date();
    order.modificationHistory.push({
      modifiedBy: branchId,
      changes: validation.changes,
      timestamp: new Date(),
    });

    await order.save();

    req.server.io.emit("orderModified", {
      branchId,
      orderId: order._id,
      changes: validation.changes,
      newTotal: order.totalPrice,
      modifiedAt: order.modifiedAt,
    });

    return reply.send({
      status: "SUCCESS",
      data: order.toObject(),
    });
  } catch (error) {
    console.error("[ModifyOrder] Error:", error);
    return reply.code(500).send({
      status: "ERROR",
      message: "Order modification failed",
      code: "MODIFICATION_FAILED",
      systemError: error.message,
    });
  }
};

export const markOrderAsPacked = async (req, reply) => {
  try {
    const { orderId } = req.params;

    if (req.user.role !== "Branch") {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch access required" });
    }
    if (
      req.user.userId !==
      (await Order.findById(orderId).select("branch")).branch.toString()
    ) {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch does not own this order" });
    }

    const order = await Order.findById(orderId).populate(
      "items.item",
      "name price"
    );
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.status !== "accepted") {
      return reply
        .status(400)
        .send({ message: "Order must be accepted first" });
    }

    order.status = "packed";
    order.statusHistory.push({ status: "packed" });
    await order.save();

    const lastModification =
      order.modificationHistory.length > 0
        ? order.modificationHistory.slice(-1)[0].changes
        : [];
    req.server.io.emit("orderPackedWithUpdates", {
      customerId: order.customer.toString(),
      orderId: order._id,
      items: order.items.map((item) => ({
        item: item.item._id,
        name: item.item.name,
        count: item.count,
        price: item.price,
      })),
      totalPrice: order.totalPrice,
      changes: lastModification,
      message:
        "Your order is packed! Here are the updated details based on availability.",
    });

    if (order.deliveryEnabled) {
      const branch = await Branch.findById(order.branch).populate(
        "deliveryPartners",
        "_id"
      );
      branch.deliveryPartners.forEach((partner) => {
        req.server.io.emit("orderReadyForAssignment", {
          partnerId: partner._id.toString(),
          order: order.toObject(),
        });
      });
    } else {
      req.server.io.emit("orderPackedForPickup", {
        customerId: order.customer.toString(),
        message: "Order is packed! Come and collect the order",
        order: order.toObject(),
      });
    }

    return reply.send(order);
  } catch (err) {
    console.error("Pack Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order packing failed", error: err.message });
  }
};

export const createOrder = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { items, branch, deliveryEnabled } = req.body;

    if (!items?.length || !branch) {
      return reply.status(400).send({ message: "Missing required fields" });
    }

    const [customer, branchData] = await Promise.all([
      Customer.findById(userId),
      Branch.findById(branch),
    ]);

    if (!customer)
      return reply.status(404).send({ message: "Customer not found" });
    if (!branchData)
      return reply.status(404).send({ message: "Branch not found" });

    const productIds = items.map((i) => i.id);
    const products = await Product.find({ _id: { $in: productIds } });
    const itemsWithPrices = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.id);
      if (!product) throw new Error(`Product ${item.id} not found`);
      return { item: item.id, count: Number(item.count), price: product.price };
    });
    const totalPrice = itemsWithPrices.reduce(
      (sum, item) => sum + item.price * item.count,
      0
    );

    // Real-time check for delivery availability, only approved partners
    const availablePartners = await DeliveryPartner.find({
      branch,
      status: "approved",
      availability: true,
    }).limit(1);
    const isDeliveryAvailable =
      branchData.deliveryServiceAvailable && availablePartners.length > 0;

    // Set deliveryEnabled based on request and availability
    const finalDeliveryEnabled =
      typeof deliveryEnabled === "boolean" && isDeliveryAvailable
        ? deliveryEnabled
        : false;

    const newOrder = new Order({
      customer: userId,
      items: itemsWithPrices,
      branch,
      totalPrice,
      status: "accepted",
      deliveryEnabled: finalDeliveryEnabled,
      statusHistory: [{ status: "placed" }, { status: "accepted" }],
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

    const savedOrder = await newOrder.save();
    req.server.io.emit("newOrder", {
      branchId: branch,
      ...savedOrder.toObject(),
    });

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

    req.server.io.emit("orderAccepted", {
      branchId: order.branch.toString(),
      ...order.toObject(),
    });
    return reply.send(order);
  } catch (err) {
    console.error("Accept Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order acceptance failed", error: err.message });
  }
};

export const assignDeliveryPartner = async (req, reply) => {
  try {
    const { orderId, partnerId } = req.params;

    if (req.user.role !== "Branch") {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch access required" });
    }

    const [order, partner] = await Promise.all([
      Order.findById(orderId),
      DeliveryPartner.findById(partnerId),
    ]);

    if (!order || !partner) {
      return reply.status(404).send({ message: "Order/Partner not found" });
    }
    if (order.branch.toString() !== req.user.userId) {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch does not own this order" });
    }
    if (order.status !== "packed") {
      return reply.status(400).send({ message: "Order must be packed first" });
    }
    if (!order.deliveryEnabled) {
      return reply
        .status(400)
        .send({ message: "Delivery not enabled for this order" });
    }

    order.status = "assigned";
    order.deliveryPartner = partnerId;
    order.statusHistory.push({ status: "assigned" });

    if (!partner.currentOrders.includes(orderId)) {
      partner.currentOrders.push(orderId);
    }

    await Promise.all([order.save(), partner.save()]);
    req.server.io.emit("orderAssigned", {
      branchId: order.branch.toString(),
      partnerId,
      customerId: order.customer.toString(),
      ...order.toObject(),
    });

    return reply.send(order);
  } catch (err) {
    console.error("Assignment Error:", err);
    return reply
      .status(500)
      .send({ message: "Partner assignment failed", error: err.message });
  }
};

export const orderCancel = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId, role } = req.user;

    if (role !== "Branch") {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch access required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (!["placed", "accepted", "packed"].includes(order.status)) {
      return reply
        .status(400)
        .send({ message: "Order cannot be cancelled at this stage" });
    }
    if (order.branch.toString() !== userId) {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch does not own this order" });
    }

    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled" });
    await order.save();

    req.server.io.emit("orderCancelled", {
      branchId: order.branch.toString(),
      customerId: order.customer.toString(),
      message: "Your order has been cancelled",
      order: order.toObject(),
    });

    return reply.send(order);
  } catch (err) {
    console.error("Cancel Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Order cancellation failed", error: err.message });
  }
};

export const updateOrderStatus = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const { userId } = req.user;

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.deliveryPartner?.toString() !== userId) {
      return reply.status(403).send({ message: "Unauthorized action" });
    }

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

    req.server.io.emit("statusUpdate", {
      orderId,
      ...order.toObject(),
    });

    if (["delivered", "cancelled"].includes(status)) {
      const partner = await DeliveryPartner.findById(userId);
      partner.currentOrders = partner.currentOrders.filter(
        (id) => id.toString() !== orderId
      );
      if (partner.currentOrders.length === 0) {
        partner.availability = true;
      }
      await partner.save();
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
    const order = await Order.findById(req.params.orderId).populate([
      { path: "customer" },
      {
        path: "branch",
        populate: {
          path: "deliveryPartners",
          select: "name phone availability",
        },
      },
      { path: "deliveryPartner" },
      { path: "items.item" },
    ]);

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

// New function: Check delivery availability
export const getDeliveryAvailability = async (req, reply) => {
  try {
    const { branchId } = req.params;

    // Fetch branch data
    const branch = await Branch.findById(branchId);
    if (!branch) {
      console.error(`Branch not found for branchId: ${branchId}`);
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Check for available delivery partners (mirrors createOrder logic)
    const availablePartners = await DeliveryPartner.find({
      branch: branchId,
      status: "approved",
      availability: true,
    }).limit(1); // Limit to 1 for efficiency, we just need to know if any exist

    // Compute isDeliveryAvailable
    const isDeliveryAvailable =
      branch.deliveryServiceAvailable && availablePartners.length > 0;

    return reply.status(200).send({ isDeliveryAvailable });
  } catch (err) {
    console.error("Delivery Availability Check Error:", err);
    return reply.status(500).send({
      message: "Failed to check delivery availability",
      error: err.message,
    });
  }
};
