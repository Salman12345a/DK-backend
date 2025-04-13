import Wallet from "../models/wallet.js";
import Branch from "../models/branch.js";

export const calculatePlatformCharge = (orderValue) => {
  if (orderValue <= 1000) return 2;
  if (orderValue <= 1999) return 4;
  if (orderValue <= 2999) return 6;
  return 8; // Default for > 2999
};

/**
 * Updates a branch wallet with platform charges when an order is delivered
 * @param {string} branchId - The ID of the branch
 * @param {string} orderId - The ID of the order
 * @param {number} totalPrice - The total order price
 * @param {object} io - Socket.io instance for notifications (optional)
 * @returns {Promise<{success: boolean, wallet: object, charge: number}>} - Result with updated wallet
 */
export const updateWalletWithOrderCharge = async (
  branchId,
  orderId,
  totalPrice,
  io = null
) => {
  try {
    console.log(
      `Updating wallet for branch ${branchId} with order ${orderId}, price ${totalPrice}`
    );

    // Calculate platform charge based on order value
    const charge = calculatePlatformCharge(totalPrice);

    // Create transaction object
    const transaction = {
      orderId,
      amount: charge,
      type: "platform_charge",
      timestamp: new Date(),
    };

    // Atomically update the wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { branchId },
      {
        $inc: { balance: -charge },
        $push: { transactions: transaction },
      },
      {
        new: true, // Return updated document
        upsert: true, // Create if doesn't exist
        setDefaultsOnInsert: true, // Apply defaults when upserting
      }
    );

    console.log(
      `Wallet update successful: New balance ${updatedWallet.balance}, charge ${charge}`
    );

    // Send socket notification if io is provided
    if (io) {
      try {
        const branch = await Branch.findById(branchId);

        // Emit to branch-specific room if possible
        if (branch && branch.phone) {
          io.to(`syncmart_${branch.phone}`).emit("walletUpdated", {
            branchId,
            newBalance: updatedWallet.balance,
            transaction: transaction,
          });
        }

        // Also emit to general wallet room
        io.to(`wallet_${branchId}`).emit("walletUpdated", {
          branchId,
          newBalance: updatedWallet.balance,
          transaction: transaction,
        });

        console.log(`Wallet update notification sent`);
      } catch (notifyError) {
        console.error(
          "Error sending wallet notification:",
          notifyError.message
        );
        // Don't throw - notification failure shouldn't affect the update
      }
    }

    return {
      success: true,
      wallet: updatedWallet,
      charge: charge,
    };
  } catch (error) {
    console.error(
      "Error in updateWalletWithOrderCharge:",
      error.message,
      error.stack
    );
    return {
      success: false,
      error: error.message,
    };
  }
};
