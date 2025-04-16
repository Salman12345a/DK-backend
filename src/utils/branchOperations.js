import Branch from "../models/branch.js";
import Wallet from "../models/wallet.js";

// Constants
export const MINIMUM_BALANCE = -100;
export const AUTO_CLOSE_HOUR = 22; // 10 PM
export const AUTO_CLOSE_MINUTE = 0;

/**
 * Check if a branch can operate based on its wallet balance
 * @param {string} branchId - The ID of the branch
 * @returns {Promise<{canOperate: boolean, reason: string, balance: number}>}
 */
export const checkBranchOperationalStatus = async (branchId) => {
  try {
    const [branch, wallet] = await Promise.all([
      Branch.findById(branchId),
      Wallet.findOne({ branchId }),
    ]);

    if (!branch) {
      throw new Error("Branch not found");
    }

    if (!wallet) {
      throw new Error("Wallet not found for branch");
    }

    // First check if branch is approved
    if (branch.status !== "approved") {
      return {
        canOperate: false,
        reason: "Branch is not approved to operate",
        balance: wallet.balance,
        storeStatus: branch.storeStatus,
      };
    }

    const currentBalance = wallet.balance;

    // Check balance threshold
    if (currentBalance <= MINIMUM_BALANCE) {
      return {
        canOperate: false,
        reason: "Wallet balance is below minimum threshold",
        balance: currentBalance,
        storeStatus: "closed",
      };
    }

    return {
      canOperate: true,
      reason: "Branch is operational",
      balance: currentBalance,
      storeStatus: branch.storeStatus,
    };
  } catch (error) {
    console.error("Error checking branch operational status:", error);
    throw error;
  }
};

/**
 * Update branch store status
 * @param {string} branchId - The ID of the branch
 * @param {string} storeStatus - The new store status ('open' or 'closed')
 * @returns {Promise<Object>} Updated branch object
 */
export const updateStoreStatus = async (branchId, storeStatus) => {
  try {
    const branch = await Branch.findById(branchId);
    if (!branch) {
      throw new Error("Branch not found");
    }

    // Check if branch is approved before allowing status change
    if (branch.status !== "approved") {
      throw new Error("Cannot update store status: Branch is not approved");
    }

    // If trying to open the store, check wallet balance
    if (storeStatus === "open") {
      const status = await checkBranchOperationalStatus(branchId);
      if (status.balance <= MINIMUM_BALANCE) {
        throw new Error(
          "Cannot open store: Wallet balance is below minimum threshold"
        );
      }
    }

    // Update the store status
    return await Branch.findByIdAndUpdate(
      branchId,
      {
        storeStatus,
        $push: {
          statusHistory: {
            status: storeStatus,
            timestamp: new Date(),
            reason: storeStatus === "open" ? "Store opened" : "Store closed",
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );
  } catch (error) {
    console.error("Error updating store status:", error);
    throw error;
  }
};

/**
 * Attempt to open a store
 * @param {string} branchId - The ID of the branch
 * @returns {Promise<{success: boolean, message: string, branch?: Object}>}
 */
export const attemptOpenStore = async (branchId) => {
  try {
    const status = await checkBranchOperationalStatus(branchId);

    if (!status.canOperate) {
      return {
        success: false,
        message: status.reason,
      };
    }

    const updatedBranch = await updateStoreStatus(branchId, "open");
    return {
      success: true,
      message: "Store opened successfully",
      branch: updatedBranch,
    };
  } catch (error) {
    console.error("Error attempting to open store:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Get detailed branch status including wallet information
 * @param {string} branchId - The ID of the branch
 * @returns {Promise<Object>} Detailed status object
 */
export const getBranchDetailedStatus = async (branchId) => {
  try {
    const [branch, wallet] = await Promise.all([
      Branch.findById(branchId),
      Wallet.findOne({ branchId }),
    ]);

    if (!branch || !wallet) {
      throw new Error("Branch or wallet not found");
    }

    return {
      branchId,
      status: branch.status,
      storeStatus: branch.storeStatus,
      currentBalance: wallet.balance,
      canOperate:
        branch.status === "approved" && wallet.balance > MINIMUM_BALANCE,
      statusHistory: branch.statusHistory || [],
    };
  } catch (error) {
    console.error("Error getting branch detailed status:", error);
    throw error;
  }
};
