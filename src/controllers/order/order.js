import Order from "../../models/order.js";
import Branch from "../../models/branch.js";
import { Customer, DeliveryPartner } from "../../models/user.js";
import Product from "../../models/products.js";
import { updateWalletWithOrderCharge } from "../../utils/walletUtils.js";
import mongoose from "mongoose";

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
    
    // Check if product is loose or packed
    // First check if the item already has isPacket stored
    const isLooseProduct = origItem.isPacket === false || origItem.item.isPacket === false;
    
    if (modItem.count === 0) {
      changes.push(`Removed ${origItem.item.name} (${origItem.count}x)`);
    } else if (modItem.count < origItem.count) {
      changes.push(
        `Reduced ${origItem.item.name} from ${origItem.count} to ${modItem.count}`
      );
      
      // For loose products, handle quantity
      if (isLooseProduct) {
        const quantity = Number(modItem.quantity || modItem.customQuantity || modItem.count);
        if (isNaN(quantity) || quantity <= 0) {
          return { 
            valid: false, 
            message: `Valid quantity is required for loose product: ${origItem.item.name}` 
          };
        }
        
        updatedItems.push({
          item: origItem.item._id,
          count: modItem.count,
          quantity: quantity,
          unit: origItem.unit || origItem.item.unit,
          isPacket: false,
          price: origItem.price,
        });
        newTotal += origItem.price * quantity;
      } else {
        // For packed products
        updatedItems.push({
          item: origItem.item._id,
          count: modItem.count,
          quantity: origItem.quantity || origItem.item.quantity,
          unit: origItem.unit || origItem.item.unit,
          isPacket: true,
          price: origItem.price,
        });
        newTotal += origItem.price * modItem.count;
      }
    } else {
      // For loose products, handle quantity
      if (isLooseProduct) {
        const quantity = Number(modItem.quantity || modItem.customQuantity || origItem.quantity || origItem.customQuantity || modItem.count);
        if (isNaN(quantity) || quantity <= 0) {
          return { 
            valid: false, 
            message: `Valid quantity is required for loose product: ${origItem.item.name}` 
          };
        }
        
        updatedItems.push({
          item: origItem.item._id,
          count: modItem.count,
          quantity: quantity,
          unit: origItem.unit || origItem.item.unit,
          isPacket: false,
          price: origItem.price,
        });
        newTotal += origItem.price * quantity;
      } else {
        // For packed products
        updatedItems.push({
          item: origItem.item._id,
          count: modItem.count,
          quantity: origItem.quantity || origItem.item.quantity,
          unit: origItem.unit || origItem.item.unit,
          isPacket: true,
          price: origItem.price,
        });
        newTotal += origItem.price * modItem.count;
      }
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

// Helper function to update product availability
const updateProductAvailability = async (productIds, branchId) => {
  if (!productIds || productIds.length === 0) return;
  
  try {
    const currentTime = new Date();
    const updateResult = await Product.updateMany(
      { 
        _id: { $in: productIds },
        branchId: branchId 
      },
      { 
        $set: { 
          isAvailable: false,
          disabledReason: "Removed from order due to inventory shortage",
          lastDisabledAt: currentTime,
          lastModifiedBy: "branch_admin"
        } 
      }
    );
    
    console.log(`[UpdateProductAvailability] Disabled ${updateResult.modifiedCount} products`);
    return updateResult.modifiedCount;
  } catch (error) {
    console.error("[UpdateProductAvailability] Error:", error);
    // Don't throw the error - we don't want to fail the order modification
    // if product updates fail
    return 0;
  }
};

export const modifyOrder = async (req, reply) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { orderId } = req.params;
    const { modifiedItems } = req.body;
    const branchId = req.user.userId;

    if (!modifiedItems || !Array.isArray(modifiedItems)) {
      await session.abortTransaction();
      session.endSession();
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
    }).populate("items.item", "name price isPacket");

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return reply.code(404).send({
        status: "ERROR",
        message: "Order not found or not modifiable",
        code: "ORDER_NOT_MODIFIABLE",
      });
    }

    const validation = validateModifications(order.items, modifiedItems);
    if (!validation.valid) {
      await session.abortTransaction();
      session.endSession();
      return reply.code(400).send({
        status: "ERROR",
        message: validation.message,
        code: "MODIFICATION_VALIDATION_FAILED",
      });
    }

    // Identify products with count set to 0 (removed products)
    const removedProductIds = modifiedItems
      .filter(item => item.count === 0)
      .map(item => item.item);
      
    // Update order details
    order.items = validation.updatedItems;
    order.totalPrice = validation.newTotal;
    order.modifiedAt = new Date();
    order.modificationHistory.push({
      modifiedBy: branchId,
      changes: validation.changes,
      timestamp: new Date(),
    });

    await order.save({ session });
    
    // Update product availability for removed products
    if (removedProductIds.length > 0) {
      await updateProductAvailability(removedProductIds, branchId);
    }
    
    await session.commitTransaction();
    session.endSession();

    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());
    req.server.io.emit("orderModified", {
      branchId,
      orderId: order._id,
      changes: validation.changes,
      newTotal: order.totalPrice,
      modifiedAt: order.modifiedAt,
    });

    // Added: Notify customer immediately
    req.server.io
      .to(`customer_${order.customer.toString()}`)
      .emit("orderModifiedForCustomer", {
        customerId: order.customer.toString(),
        orderId: order._id,
        branchId,
        changes: validation.changes,
        newTotal: order.totalPrice,
        modifiedAt: order.modifiedAt,
        message: "Your order was updated by the branch with these changes.",
      });

    return reply.send({
      status: "SUCCESS",
      data: order.toObject(),
    });
  } catch (error) {
    console.error("[ModifyOrder] Error:", error);
    await session.abortTransaction();
    session.endSession();
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
    const order = await Order.findById(orderId).populate(
      "items.item",
      "name price"
    );
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.branch.toString() !== req.user.userId) {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Branch does not own this order" });
    }
    if (order.status !== "accepted") {
      return reply
        .status(400)
        .send({ message: "Order must be accepted first" });
    }

    order.status = "packed";
    order.statusHistory.push({ status: "packed", timestamp: new Date() });
    await order.save();

    console.log(`Order ${orderId} marked as packed`);

    // Emit to orderId room for frontend sync
    req.server.io.to(orderId).emit("orderStatusUpdate", {
      orderId,
      status: "packed",
      manuallyCollected: order.manuallyCollected || false,
      ...order.toObject(),
    });

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
    
    // Process items based on whether they are packed or loose products
    const itemsWithPrices = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.id);
      if (!product) throw new Error(`Product ${item.id} not found`);
      
      // For loose products (isPacket = false), validate and use quantity
      if (!product.isPacket) {
        const quantity = Number(item.quantity || item.customQuantity || item.count);
        
        // Validate quantity for loose products
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Valid quantity is required for loose product: ${product.name}`);
        }
        
        return { 
          item: item.id, 
          count: Number(item.count), 
          quantity: quantity,
          unit: product.unit, // Store the unit of measurement
          isPacket: false, // Store that this is a loose product
          price: product.price 
        };
      } 
      // For packed products (isPacket = true), use the standard count
      else {
        return { 
          item: item.id, 
          count: Number(item.count), 
          quantity: product.quantity, // Store the product's quantity information
          unit: product.unit, // Store the unit of measurement
          isPacket: true, // Store that this is a packed product
          price: product.price 
        };
      }
    });
    
    // Calculate total price based on product type
    const totalPrice = itemsWithPrices.reduce((sum, item) => {
      const product = products.find((p) => p._id.toString() === item.item);
      
      // For loose products, use quantity for price calculation
      if (!product.isPacket) {
        return sum + (item.price * item.quantity);
      }
      // For packed products, use count for price calculation
      else {
        return sum + (item.price * item.count);
      }
    }, 0);
    

    const availablePartners = await DeliveryPartner.find({
      branch,
      status: "approved",
      availability: true,
    }).limit(1);
    const isDeliveryAvailable =
      branchData.deliveryServiceAvailable && availablePartners.length > 0;
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
    req.server.io
      .to(savedOrder._id)
      .emit("orderStatusUpdate", savedOrder.toObject());
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

    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());
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
    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());
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

    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());
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
    order.statusHistory.push({ status, timestamp: new Date() });
    await order.save();

    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());

    // Process wallet update when order is delivered
    let walletUpdateResult = null;
    if (status === "delivered") {
      walletUpdateResult = await updateWalletWithOrderCharge(
        order.branch.toString(),
        order._id.toString(),
        order.totalPrice,
        req.server.io
      );

      if (!walletUpdateResult.success) {
        req.log.error({
          msg: "Failed to update wallet for delivered order",
          error: walletUpdateResult.error,
          orderId: order._id,
        });
      } else {
        req.log.info({
          msg: "Wallet updated successfully for delivered order",
          branchId: order.branch,
          newBalance: walletUpdateResult.wallet.balance,
          charge: walletUpdateResult.charge,
        });
      }
    }

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

    // Include wallet update info in response if available
    const response = order.toObject();
    if (walletUpdateResult && walletUpdateResult.success) {
      response.walletUpdate = {
        branchId: order.branch,
        newBalance: walletUpdateResult.wallet.balance,
        charge: walletUpdateResult.charge,
      };
    }

    return reply.send(response);
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

    if (order) {
      // Create a JSON representation that we can modify
      const orderObj = order.toObject();
      
      // Calculate finalPrice for each item
      if (orderObj.items && Array.isArray(orderObj.items)) {
        orderObj.items = orderObj.items.map(item => {
          // Check if the item is a packet or loose product
          const isPacket = item.isPacket !== undefined ? item.isPacket : 
                          (item.item && item.item.isPacket !== undefined ? item.item.isPacket : true);
          
          // Calculate finalPrice based on product type
          if (!isPacket) {
            // For loose products, use quantity
            const quantity = Number(item.quantity || 0);
            item.finalPrice = item.price * quantity;
          } else {
            // For packed products, use count
            item.finalPrice = item.price * item.count;
          }
          
          return item;
        });
      }
      
      return reply.send(orderObj);
    } else {
      return reply.status(404).send({ message: "Order not found" });
    }
  } catch (err) {
    console.error("Fetch Order Error:", err);
    return reply
      .status(500)
      .send({ message: "Failed to fetch order", error: err.message });
  }
};

export const getDeliveryAvailability = async (req, reply) => {
  try {
    const { branchId } = req.params;
    const branch = await Branch.findById(branchId);
    if (!branch) {
      console.error(`Branch not found for branchId: ${branchId}`);
      return reply.status(404).send({ message: "Branch not found" });
    }

    const availablePartners = await DeliveryPartner.find({
      branch: branchId,
      status: "approved",
      availability: true,
    }).limit(1);
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

export const markOrderAsCollected = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.user;

    const order = await Order.findById(orderId);
    if (!order) return reply.status(404).send({ message: "Order not found" });
    if (order.customer.toString() !== userId) {
      return reply
        .status(403)
        .send({ message: "Unauthorized: Not your order" });
    }
    if (order.deliveryEnabled) {
      return reply.status(400).send({ message: "Not a pickup order" });
    }
    if (order.status !== "packed") {
      return reply.status(400).send({ message: "Order must be packed first" });
    }
    if (order.manuallyCollected) {
      return reply.status(400).send({ message: "Order already collected" });
    }

    order.status = "delivered";
    order.manuallyCollected = true;
    order.statusHistory.push({ status: "delivered", timestamp: new Date() });
    order.updatedAt = new Date();
    await order.save();

    req.server.io.to(orderId).emit("orderStatusUpdate", order.toObject());

    // Update wallet directly with platform charge
    let walletUpdateResult = null;
    try {
      walletUpdateResult = await updateWalletWithOrderCharge(
        order.branch.toString(),
        order._id.toString(),
        order.totalPrice,
        req.server.io
      );

      if (!walletUpdateResult.success) {
        req.log.error({
          msg: "Failed to update wallet for collected order",
          error: walletUpdateResult.error,
          orderId: order._id,
        });
      } else {
        req.log.info({
          msg: "Wallet updated successfully for collected order",
          branchId: order.branch,
          newBalance: walletUpdateResult.wallet.balance,
          charge: walletUpdateResult.charge,
        });
      }
    } catch (walletErr) {
      console.error("Failed to update wallet:", walletErr);
      // Don't fail the order status update if wallet update fails
    }

    // Include wallet update info in response if available
    const response = order.toObject();
    if (walletUpdateResult && walletUpdateResult.success) {
      response.walletUpdate = {
        branchId: order.branch,
        newBalance: walletUpdateResult.wallet.balance,
        charge: walletUpdateResult.charge,
      };
    }

    return reply.send(response);
  } catch (err) {
    console.error("Mark Order As Collected Error:", err);
    return reply.status(500).send({
      message: "Failed to mark order as collected",
      error: err.message,
    });
  }
};

export const getBranchSalesLast24Hours = async (req, reply) => {
  try {
    const { branchId } = req.params;

    // Check authorization - ensure user is branch owner or admin
    if (req.user.role === "Branch" && req.user.userId !== branchId) {
      return reply.code(403).send({
        status: "ERROR",
        message:
          "Unauthorized: You can only access sales data for your own branch",
        code: "UNAUTHORIZED_ACCESS",
      });
    }

    // Calculate 24 hours ago from now
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Query completed orders in the last 24 hours
    const completedOrders = await Order.find({
      branch: branchId,
      status: { $in: ["delivered"] },
      updatedAt: { $gte: twentyFourHoursAgo },
    });

    // Calculate total sales
    const totalSales = completedOrders.reduce(
      (sum, order) => sum + order.totalPrice,
      0
    );

    // Count total orders
    const orderCount = completedOrders.length;

    // Get item-wise sales breakdown
    const itemSales = {};
    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemId = item.item.toString();
        if (!itemSales[itemId]) {
          itemSales[itemId] = {
            quantity: 0,
            revenue: 0,
          };
        }
        itemSales[itemId].quantity += item.count;
        itemSales[itemId].revenue += item.price * item.count;
      });
    });

    return reply.code(200).send({
      status: "SUCCESS",
      data: {
        branchId,
        timeRange: {
          from: twentyFourHoursAgo,
          to: new Date(),
        },
        orderCount,
        totalSales,
        itemSales,
        currency: "INR", // Default currency, can be made dynamic if needed
      },
    });
  } catch (error) {
    console.error("[24HourSales] Error:", error);
    return reply.code(500).send({
      status: "ERROR",
      message: "Failed to fetch sales data",
      code: "SALES_FETCH_FAILED",
      systemError: error.message,
    });
  }
};
