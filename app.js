import "dotenv/config";
import Fastify from "fastify";
import { connectDB } from "./src/config/connect.js";
import { buildAdminRouter } from "./src/config/setup.js";
import { registerRoutes } from "./src/routes/index.js";
import { PORT } from "./src/config/config.js";
import fastifySocketIO from "fastify-socket.io";

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    const app = Fastify({
      logger: true,
      ignoreTrailingSlash: true,
    });

    app.setErrorHandler((error, request, reply) => {
      app.log.error(error);
      reply.status(500).send({
        error: error.name,
        message: error.message,
      });
    });

    app.register(fastifySocketIO, {
      cors: {
        origin:
          process.env.NODE_ENV === "development"
            ? "*"
            : [process.env.FRONTEND_URL],
        methods: ["GET", "POST"],
      },
      pingInterval: 10000,
      pingTimeout: 5000,
      transports: ["websocket", "polling"],
    });

    app.decorateReply("redirectFixed", function (url, code = 302) {
      return this.redirect(url, code);
    });

    console.log("Building AdminJS router...");
    await buildAdminRouter(app);
    console.log("Registering routes...");
    await registerRoutes(app);

    await app.ready();
    console.log(
      "Server ready with plugins:",
      Array.from(app.pluginNames || [])
    );

    await app.listen({
      port: PORT,
      host: process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
    });
    console.log(`Server running at http://localhost:${PORT}/admin`);

    const io = app.io;
    io.on("connection", (socket) => {
      console.log("A User Connected:", socket.id);

      socket.on("joinRoom", (orderId) => {
        socket.join(orderId);
        console.log(`User joined room ${orderId}`);
      });

      socket.on("joinCustomerRoom", (customerId) => {
        const room = `customer_${customerId}`;
        socket.join(room);
        console.log(`Customer ${socket.id} joined room: ${room}`);
      });

      socket.on("joinSyncmartRoom", (phone) => {
        const room = `syncmart_${phone}`;
        socket.join(room);
        console.log(
          `Client ${socket.id} joined syncmart room: ${room} for phone: ${phone}`
        );
      });

      socket.on("branchRegistered", (data) => {
        console.log(
          "Received branchRegistered from client (unexpected):",
          data
        );
      });

      socket.on("branchStatusUpdated", (data) => {
        console.log(
          "Received branchStatusUpdated from client (unexpected):",
          data
        );
      });

      socket.on("discount", () => {
        console.log("Discount event received");
      });

      socket.on("syncmart:status", (data) => {
        io.emit("syncmart:status", data);
      });

      socket.on("syncmart:delivery-service-available", (data) => {
        io.emit("syncmart:delivery-service-available", data);
      });

      socket.on("orderPackedWithUpdates", (data) => {
        console.log(
          "Order Packed Notification:",
          JSON.stringify(data, null, 2)
        );
        io.to(`customer_${data.customerId}`).emit(
          "orderPackedWithUpdates",
          data
        );
      });

      socket.on("orderModified", (data) => {
        io.to(`branch_${data.branchId}`).emit("orderModified", data);
      });

      socket.on("newOrder", (data) => {
        io.to(`branch_${data.branchId}`).emit("newOrder", data);
      });

      socket.on("orderAccepted", (data) => {
        io.to(`branch_${data.branchId}`).emit("orderAccepted", data);
      });

      socket.on("orderReadyForAssignment", (data) => {
        io.to(`partner_${data.partnerId}`).emit(
          "orderReadyForAssignment",
          data
        );
      });

      socket.on("orderPackedForPickup", (data) => {
        console.log("Emitting orderPackedForPickup:", data);
        io.to(`customer_${data.customerId}`).emit("orderPackedForPickup", data);
        io.to(data.orderId).emit("orderStatusUpdate", {
          orderId: data.orderId,
          status: "packed",
          manuallyCollected: data.manuallyCollected || false,
        });
      });

      socket.on("orderAssigned", (data) => {
        io.to(`branch_${data.branchId}`).emit("orderAssigned", data);
        io.to(`partner_${data.partnerId}`).emit("newAssignment", data);
        io.to(`customer_${data.customerId}`).emit("orderAssigned", data);
      });

      socket.on("orderCancelled", (data) => {
        io.to(`branch_${data.branchId}`).emit("orderCancelled", data);
        io.to(`customer_${data.customerId}`).emit("orderCancelled", data);
      });

      socket.on("statusUpdate", (data) => {
        console.log("Received statusUpdate from client:", data);
        io.to(data.orderId).emit("orderStatusUpdate", {
          orderId: data.orderId,
          status: data.status,
          manuallyCollected: data.manuallyCollected || false,
        });
      });

      socket.on("walletUpdated", (data) => {
        console.log("Wallet updated event received:", data);
        // Forward to relevant rooms
        if (data.branchId) {
          io.to(`wallet_${data.branchId}`).emit("walletUpdated", data);
          console.log(`Forwarded walletUpdated to wallet_${data.branchId}`);
        }
      });

      socket.on("walletUpdateTrigger", (data) => {
        console.log("Received walletUpdateTrigger in app.js:", data);
        // Forward this event to all connected clients
        io.emit("walletUpdateTrigger", data);

        // Ensure the wallet listener service receives this event directly
        socket.broadcast.emit("walletUpdateTrigger", data);

        // Additional logging
        console.log(
          `Broadcasting walletUpdateTrigger for branchId: ${data.branchId}, total price: ${data.totalPrice}`
        );
      });

      socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
      });
    });

    process.on("SIGINT", () => {
      io.close();
      app.close();
      console.log("Server stopped");
      process.exit(0);
    });
  } catch (error) {
    console.error("Startup error:", error);
    process.exit(1);
  }
};

start();
