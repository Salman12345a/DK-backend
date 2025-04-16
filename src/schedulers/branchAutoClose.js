import cron from "node-cron";
import {
  MINIMUM_BALANCE,
  AUTO_CLOSE_HOUR,
  AUTO_CLOSE_MINUTE,
} from "../utils/branchOperations.js";
import {
  updateBranchStatus,
  checkBranchOperationalStatus,
} from "../utils/branchOperations.js";
import Branch from "../models/branch.js";
import Wallet from "../models/wallet.js";

/**
 * Schedule automatic branch closure
 * Runs daily at specified time (10 PM by default)
 */
export const scheduleBranchAutoClose = (io = null) => {
  // Schedule for 10 PM daily
  const cronSchedule = `${AUTO_CLOSE_MINUTE} ${AUTO_CLOSE_HOUR} * * *`;

  cron.schedule(
    cronSchedule,
    async () => {
      console.log("Running auto-close scheduler...");
      try {
        // Find all open branches
        const openBranches = await Branch.find({
          isOpen: true,
          isManuallyClosed: false,
        });

        console.log(`Found ${openBranches.length} open branches to check`);

        for (const branch of openBranches) {
          try {
            const status = await checkBranchOperationalStatus(branch._id);

            if (status.balance <= MINIMUM_BALANCE) {
              console.log(
                `Auto-closing branch ${branch._id} due to low balance: ${status.balance}`
              );

              // Update branch status
              await updateBranchStatus(branch._id, false, false);

              // Notify through WebSocket if io is provided
              if (io) {
                io.to(`branch_${branch._id}`).emit("branchStatusUpdate", {
                  branchId: branch._id,
                  status: "closed",
                  reason: "Automatic closure due to low balance",
                  balance: status.balance,
                });

                // Also notify admin room
                io.to("admin").emit("branchAutoClosed", {
                  branchId: branch._id,
                  balance: status.balance,
                  timestamp: new Date(),
                });
              }
            }
          } catch (branchError) {
            console.error(
              `Error processing branch ${branch._id}:`,
              branchError
            );
            // Continue with next branch
            continue;
          }
        }

        console.log("Auto-close scheduler completed successfully");
      } catch (error) {
        console.error("Error in auto-close scheduler:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata", // Adjust timezone as needed
    }
  );
};

export default scheduleBranchAutoClose;
