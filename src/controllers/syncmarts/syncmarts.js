import Branch from "../../models/branch.js";

export const getSyncmartStatus = async (req, reply) => {
  if (!req.user || !req.user.userId) {
    req.log.error("User data missing or malformed:", req.user);
    return reply.code(401).send({ message: "Unauthorized" });
  }

  const { userId } = req.user;

  try {
    req.log.info(`Fetching store status for userId: ${userId}`);

    const branch = await Branch.findById(userId).select(
      "storeStatus deliveryServiceAvailable"
    );

    if (!branch) {
      req.log.warn(`Branch not found for userId: ${userId}`);
      return reply.code(404).send({ message: "SyncMart not found" });
    }

    return reply.send({
      message: "Store status retrieved successfully",
      storeStatus: branch.storeStatus,
      deliveryServiceAvailable: branch.deliveryServiceAvailable,
    });
  } catch (err) {
    req.log.error(`Error retrieving store status for userId: ${userId}`, err);
    return reply.code(500).send({ message: "Internal server error" });
  }
};
