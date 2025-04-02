import mongoose from "mongoose";
import Branch from "../models/branch.js";
import { getSyncmartStatus } from "../controllers/syncmarts/syncmarts.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";

export const syncmarts = (fastify, opts, done) => {
  fastify.post(
    "/status", // Changed from "/syncmarts/status"
    { preHandler: [verifyToken] },
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        req.log.error("User data missing or malformed:", req.user);
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { userId } = req.user;
      const { storeStatus } = req.body;

      if (!["open", "closed"].includes(storeStatus)) {
        req.log.warn(`Invalid storeStatus received: ${storeStatus}`);
        return reply.code(400).send({ message: "Invalid storeStatus value" });
      }

      try {
        req.log.info(
          `Updating storeStatus for userId: ${userId} to ${storeStatus}`
        );

        const updatedBranch = await Branch.findByIdAndUpdate(
          userId,
          { storeStatus },
          { new: true }
        );

        if (!updatedBranch) {
          req.log.warn(`Branch not found during update for userId: ${userId}`);
          return reply.code(404).send({ message: "SyncMart not found" });
        }

        req.log.info(
          `Successfully updated storeStatus for userId: ${userId} to ${updatedBranch.storeStatus}`
        );

        const io = fastify.io;
        io.to(userId).emit("syncmart:status", {
          storeStatus: updatedBranch.storeStatus,
        });

        return reply.send({
          message: "Store status updated successfully",
          storeStatus: updatedBranch.storeStatus,
        });
      } catch (err) {
        req.log.error(`Error updating storeStatus for userId: ${userId}`, err);
        return reply.code(500).send({ message: "Internal server error" });
      }
    }
  );

  fastify.patch(
    "/delivery", // Unchanged
    { preHandler: [verifyToken, checkBranchRole] },
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        req.log.error("User data missing or malformed:", req.user);
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { userId } = req.user;
      const { enable } = req.body;

      if (typeof enable !== "boolean") {
        return reply.code(400).send({ message: "Enable must be a boolean" });
      }

      try {
        req.log.info(
          `Processing request for userId: ${userId}, role: ${req.user.role}`
        );
        req.log.info(`DB connection state: ${mongoose.connection.readyState}`);

        const branch = await Branch.findById(userId);
        if (!branch) {
          req.log.warn(`Branch not found for userId: ${userId}`);
          return reply.code(404).send({ message: "SyncMart not found" });
        }

        branch.deliveryServiceAvailable = enable;
        await branch.save();

        const io = fastify.io;
        io.emit("syncmart:delivery-service-available", {
          deliveryServiceAvailable: branch.deliveryServiceAvailable,
        });

        return reply.send({
          message: `Delivery service ${enable ? "enabled" : "disabled"}`,
          deliveryServiceAvailable: branch.deliveryServiceAvailable,
        });
      } catch (err) {
        req.log.error(`Database error for userId: ${userId}`, {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
        return reply.code(500).send({
          message: "Internal server error",
          error:
            process.env.NODE_ENV !== "production" ? err.message : undefined,
        });
      }
    }
  );

  fastify.get(
    "/delivery",
    { preHandler: [verifyToken] },
    async (req, reply) => {
      if (!req.user || !req.user.userId) {
        req.log.error("User data missing or malformed:", req.user);
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const { userId } = req.user;

      try {
        const branch = await Branch.findById(userId);
        if (!branch) {
          req.log.warn(`Branch not found for userId: ${userId}`);
          return reply.code(404).send({ message: "SyncMart not found" });
        }

        return reply.send({
          deliveryServiceAvailable: branch.deliveryServiceAvailable,
        });
      } catch (err) {
        req.log.error(
          `Error fetching delivery status for userId: ${userId}`,
          err
        );
        return reply.code(500).send({ message: "Internal server error" });
      }
    }
  );

  fastify.get(
    "/status", // Changed from "/syncmarts/status"
    { preHandler: [verifyToken] },
    getSyncmartStatus
  );

  done();
};
