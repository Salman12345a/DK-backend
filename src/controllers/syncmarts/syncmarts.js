import Branch from "../../models/branch.js";
import Wallet from "../../models/wallet.js";

const MINIMUM_BALANCE = -100;

export const getSyncmartStatus = async (req, reply) => {
  if (!req.user || !req.user.userId) {
    req.log.error("User data missing or malformed:", req.user);
    return reply.code(401).send({ message: "Unauthorized" });
  }

  const { userId } = req.user;

  try {
    req.log.info(`Fetching store status for userId: ${userId}`);

    // Get both branch and wallet information
    const [branch, wallet] = await Promise.all([
      Branch.findById(userId).select(
        "storeStatus deliveryServiceAvailable status"
      ),
      Wallet.findOne({ branchId: userId }),
    ]);

    if (!branch) {
      req.log.warn(`Branch not found for userId: ${userId}`);
      return reply.code(404).send({ message: "SyncMart not found" });
    }

    // If wallet doesn't exist, create one with 0 balance
    const branchWallet =
      wallet || (await new Wallet({ branchId: userId, balance: 0 }).save());

    // Check if branch is approved
    if (branch.status !== "approved") {
      return reply.send({
        message: "Store status retrieved successfully",
        storeStatus: "closed",
        deliveryServiceAvailable: false,
        reason: "Branch is not approved",
      });
    }

    // Check wallet balance
    if (branchWallet.balance <= MINIMUM_BALANCE) {
      // If store is open and balance is low, close it
      if (branch.storeStatus === "open") {
        branch.storeStatus = "closed";
        await branch.save();
      }

      return reply.send({
        message: "Store status retrieved successfully",
        storeStatus: "closed",
        deliveryServiceAvailable: false,
        reason: "Wallet balance is below minimum threshold",
        balance: branchWallet.balance,
      });
    }

    return reply.send({
      message: "Store status retrieved successfully",
      storeStatus: branch.storeStatus,
      deliveryServiceAvailable: branch.deliveryServiceAvailable,
      balance: branchWallet.balance,
    });
  } catch (err) {
    req.log.error(`Error retrieving store status for userId: ${userId}`, err);
    return reply.code(500).send({ message: "Internal server error" });
  }
};
