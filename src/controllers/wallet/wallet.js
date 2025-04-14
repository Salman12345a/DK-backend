import Wallet from "../../models/wallet.js";
import Branch from "../../models/branch.js"; // For fetching phone
import {
  calculatePlatformCharge,
  updateWalletWithOrderCharge,
} from "../../utils/walletUtils.js";

// Helper function to find or create a wallet
const findOrCreateWallet = async (branchId, log = console) => {
  let wallet = await Wallet.findOne({ branchId }).lean();
  if (!wallet) {
    const newWallet = new Wallet({
      branchId,
      balance: 0,
      transactions: [],
    });
    await newWallet.save();
    wallet = newWallet.toObject();
    log.info?.(`Created new wallet for branch: ${branchId}`);
  }
  return wallet;
};

export const getWalletBalance = async (request, reply) => {
  try {
    const { branchId } = request.params;

    // Get fresh wallet data
    const wallet = await Wallet.findOne({ branchId }).lean();

    if (!wallet) {
      // Create a new wallet if one doesn't exist
      const newWallet = new Wallet({
        branchId,
        balance: 0,
        transactions: [],
      });
      await newWallet.save();

      console.log(
        `Created new wallet for branch: ${branchId}, initial balance: 0`
      );
      return reply.status(200).send({ balance: 0 });
    }

    console.log(
      `Retrieved wallet for branch: ${branchId}, current balance: ${wallet.balance}`
    );
    return reply.status(200).send({ balance: wallet.balance });
  } catch (error) {
    request.log.error({
      msg: "Error getting wallet balance",
      error: error.message,
    });
    return reply.status(500).send({ error: "Failed to get wallet balance" });
  }
};

export const getWalletTransactions = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const wallet = await findOrCreateWallet(branchId, request.log);
    return reply.status(200).send({ transactions: wallet.transactions });
  } catch (error) {
    request.log.error({
      msg: "Error getting wallet transactions",
      error: error.message,
    });
    return reply
      .status(500)
      .send({ error: "Failed to get wallet transactions" });
  }
};

export const postWalletPayment = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const { amount, paymentMethod } = request.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: "Invalid payment amount" });
    }

    // Create transaction
    const transaction = {
      amount,
      type: "payment",
      timestamp: new Date(),
    };

    // Using findOneAndUpdate with $inc for atomic operation to ensure correct balance
    const updatedWallet = await Wallet.findOneAndUpdate(
      { branchId },
      {
        $inc: { balance: amount }, // Add amount to balance
        $push: { transactions: transaction },
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true, // Apply defaults when upserting
      }
    );

    return reply.status(200).send({
      message: "Payment added",
      newBalance: updatedWallet.balance,
    });
  } catch (error) {
    request.log.error({
      msg: "Error adding wallet payment",
      error: error.message,
    });
    return reply.status(500).send({ error: "Failed to add payment" });
  }
};

export const getWalletPayments = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const wallet = await findOrCreateWallet(branchId, request.log);
    const payments = wallet.transactions.filter((t) => t.type === "payment");
    return reply.status(200).send({ payments });
  } catch (error) {
    request.log.error({
      msg: "Error getting wallet payments",
      error: error.message,
    });
    return reply.status(500).send({ error: "Failed to get wallet payments" });
  }
};

export const getWalletStatistics = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const wallet = await findOrCreateWallet(branchId, request.log);

    const totalCharges = wallet.transactions
      .filter((t) => t.type === "platform_charge")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = wallet.transactions
      .filter((t) => t.type === "payment")
      .reduce((sum, t) => sum + t.amount, 0);
    const netChange = totalPayments - totalCharges;
    return reply.status(200).send({ totalCharges, totalPayments, netChange });
  } catch (error) {
    request.log.error({
      msg: "Error getting wallet statistics",
      error: error.message,
    });
    return reply.status(500).send({ error: "Failed to get wallet statistics" });
  }
};

export const setupWalletListener = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected for wallet updates");

    socket.on(
      "walletUpdateTrigger",
      async ({ branchId, orderId, totalPrice }) => {
        try {
          console.log("Received walletUpdateTrigger:", {
            branchId,
            orderId,
            totalPrice,
          });

          if (!branchId || !orderId || totalPrice === undefined) {
            console.error("Missing required parameters:", {
              branchId,
              orderId,
              totalPrice,
            });
            return;
          }

          // Use the same service function for consistency
          const result = await updateWalletWithOrderCharge(
            branchId,
            orderId,
            totalPrice,
            io
          );

          if (!result.success) {
            console.error(
              "Failed to update wallet via socket trigger:",
              result.error
            );
          } else {
            console.log(
              `Wallet updated via socket trigger. New balance: ${result.wallet.balance}`
            );
          }
        } catch (error) {
          console.error(
            "Error in wallet update trigger:",
            error.message,
            error.stack
          );
        }
      }
    );

    // Allow clients to join a wallet notification room
    socket.on("joinWalletRoom", ({ branchId }) => {
      if (branchId) {
        socket.join(`wallet_${branchId}`);
        console.log(`Socket joined wallet room for branch: ${branchId}`);
      }
    });

    // Force wallet update for testing (keep this for backward compatibility)
    socket.on("forceWalletUpdate", async ({ branchId, charge }) => {
      try {
        console.log(
          `Force updating wallet for branch ${branchId} with charge ${charge}`
        );

        if (!branchId || charge === undefined) {
          console.error("Missing required parameters for force update");
          return;
        }

        const transaction = {
          amount: charge,
          type: "platform_charge",
          timestamp: new Date(),
        };

        const updatedWallet = await Wallet.findOneAndUpdate(
          { branchId },
          {
            $inc: { balance: -charge },
            $push: { transactions: transaction },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        );

        console.log(
          `Force wallet update complete. New balance: ${updatedWallet.balance}`
        );

        io.emit("walletUpdated", {
          branchId,
          newBalance: updatedWallet.balance,
          transaction,
        });
      } catch (error) {
        console.error("Error in force wallet update:", error.message);
      }
    });
  });
};
