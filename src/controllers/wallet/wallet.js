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

    // Force refresh from database instead of using potentially stale cached data
    await Wallet.findOne({ branchId }).lean(); // Flush any pending changes

    // Get fresh wallet data with no caching
    const wallet = await Wallet.findOne({ branchId }, {}, { lean: true })
      .select("balance transactions")
      .exec();

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
      return reply.status(200).send({ balance: 0, isNew: true });
    }

    console.log(
      `Retrieved wallet for branch: ${branchId}, current balance: ${wallet.balance}, transaction count: ${wallet.transactions.length}`
    );
    return reply.status(200).send({
      balance: wallet.balance,
      transactionCount: wallet.transactions.length,
      isNew: false,
    });
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

    // Get wallet as non-lean document for modifications
    let wallet = await Wallet.findOne({ branchId });
    if (!wallet) {
      wallet = new Wallet({ branchId, balance: 0, transactions: [] });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      amount,
      type: "payment",
      timestamp: new Date(),
    });

    await wallet.save();
    return reply
      .status(200)
      .send({ message: "Payment added", newBalance: wallet.balance });
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

export const manualWalletUpdate = async (request, reply) => {
  try {
    const { branchId } = request.params;
    const { orderId, totalPrice } = request.body;

    if (!orderId || totalPrice === undefined) {
      return reply.status(400).send({ error: "Missing orderId or totalPrice" });
    }

    // Calculate platform charge based on order value
    const charge = calculatePlatformCharge(totalPrice);
    console.log(
      `Manual update: calculated charge ${charge} for order ${orderId} with value ${totalPrice}`
    );

    // Create transaction object
    const transaction = {
      orderId,
      amount: charge,
      type: "platform_charge",
      timestamp: new Date(),
    };

    // Get current wallet state
    let currentWallet = await Wallet.findOne({ branchId });
    console.log(
      `Before update: Wallet ${currentWallet ? "exists" : "does not exist"}`
    );
    if (currentWallet) {
      console.log(
        `Current balance: ${currentWallet.balance}, transactions: ${currentWallet.transactions.length}`
      );
    }

    // Directly update the wallet - avoid findOneAndUpdate to ensure we see exactly what's happening
    let wallet;
    if (!currentWallet) {
      // Create new wallet
      wallet = new Wallet({
        branchId,
        balance: -charge, // Start with negative charge
        transactions: [transaction],
      });
      console.log(`Creating new wallet with initial balance: ${-charge}`);
    } else {
      // Update existing wallet
      currentWallet.balance -= charge;
      currentWallet.transactions.push(transaction);
      wallet = currentWallet;
      console.log(`Updating existing wallet, new balance: ${wallet.balance}`);
    }

    // Save the changes
    await wallet.save();

    // Verify the update
    const verifiedWallet = await Wallet.findOne({ branchId }).lean();

    return reply.status(200).send({
      success: true,
      message: "Wallet manually updated",
      details: {
        branchId,
        newBalance: verifiedWallet.balance,
        charge,
        transactionCount: verifiedWallet.transactions.length,
        latestTransaction:
          verifiedWallet.transactions[verifiedWallet.transactions.length - 1],
      },
    });
  } catch (error) {
    request.log.error({
      msg: "Error in manual wallet update",
      error: error.message,
    });
    return reply
      .status(500)
      .send({ error: "Failed to update wallet manually" });
  }
};
