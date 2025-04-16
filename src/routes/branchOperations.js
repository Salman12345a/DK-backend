import express from "express";
import {
  checkBranchOperationalStatus,
  updateStoreStatus,
  attemptOpenStore,
  getBranchDetailedStatus,
} from "../utils/branchOperations.js";
import { authenticateToken } from "../middleware/auth.js";
import Branch from "../models/branch.js";

const router = express.Router();

// Middleware to verify branch ownership
const verifyBranchOwnership = async (req, res, next) => {
  try {
    const branchId = req.params.branchId;
    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Check if the authenticated user owns this branch
    if (branch.phone !== req.user.phone) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to manage this branch",
      });
    }

    req.branch = branch;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get branch status details
 * @route GET /api/branch/status/:branchId
 * @access Private (Branch Owner Only)
 */
router.get(
  "/status/:branchId",
  authenticateToken,
  verifyBranchOwnership,
  async (req, res) => {
    try {
      const { branchId } = req.params;
      const status = await getBranchDetailedStatus(branchId);
      res.json(status);
    } catch (error) {
      console.error("Error getting branch status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error getting branch status",
      });
    }
  }
);

/**
 * Close store
 * @route POST /api/branch/store/close/:branchId
 * @access Private (Branch Owner Only)
 */
router.post(
  "/store/close/:branchId",
  authenticateToken,
  verifyBranchOwnership,
  async (req, res) => {
    try {
      const { branchId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Closure reason is required",
        });
      }

      const updatedBranch = await updateStoreStatus(branchId, "closed");

      // Emit WebSocket event if io is available
      if (req.app.get("io")) {
        const io = req.app.get("io");
        io.to(`branch_${branchId}`).emit("storeStatusUpdate", {
          branchId,
          storeStatus: "closed",
          reason,
        });
      }

      res.json({
        success: true,
        message: "Store closed successfully",
        branch: updatedBranch,
      });
    } catch (error) {
      console.error("Error closing store:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error closing store",
      });
    }
  }
);

/**
 * Open store
 * @route POST /api/branch/store/open/:branchId
 * @access Private (Branch Owner Only)
 */
router.post(
  "/store/open/:branchId",
  authenticateToken,
  verifyBranchOwnership,
  async (req, res) => {
    try {
      const { branchId } = req.params;
      const result = await attemptOpenStore(branchId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Emit WebSocket event if io is available
      if (req.app.get("io") && result.success) {
        const io = req.app.get("io");
        io.to(`branch_${branchId}`).emit("storeStatusUpdate", {
          branchId,
          storeStatus: "open",
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error opening store:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error opening store",
      });
    }
  }
);

/**
 * Check if store can operate
 * @route GET /api/branch/store/can-operate/:branchId
 * @access Private (Branch Owner Only)
 */
router.get(
  "/store/can-operate/:branchId",
  authenticateToken,
  verifyBranchOwnership,
  async (req, res) => {
    try {
      const { branchId } = req.params;
      const status = await checkBranchOperationalStatus(branchId);
      res.json(status);
    } catch (error) {
      console.error("Error checking store operation status:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error checking store operation status",
      });
    }
  }
);

export default router;
