import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import {
  getWalletBalance,
  getWalletTransactions,
  postWalletPayment,
  getWalletPayments,
  getWalletStatistics,
  setupWalletListener,
  manualWalletUpdate,
} from "../controllers/wallet/wallet.js";

export const walletRoutes = async (fastify) => {
  fastify.addHook("onRequest", (request, reply, done) => {
    console.log(`Incoming request: ${request.method} ${request.url}`);
    done();
  });

  fastify.get(
    "/wallet/balance/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling GET /wallet/balance/:branchId");
      return getWalletBalance(request, reply);
    }
  );

  fastify.get(
    "/wallet/transactions/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling GET /wallet/transactions/:branchId");
      return getWalletTransactions(request, reply);
    }
  );

  fastify.post(
    "/wallet/payments/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling POST /wallet/payments/:branchId");
      return postWalletPayment(request, reply);
    }
  );

  fastify.get(
    "/wallet/payments/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling GET /wallet/payments/:branchId");
      return getWalletPayments(request, reply);
    }
  );

  fastify.get(
    "/wallet/statistics/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling GET /wallet/statistics/:branchId");
      return getWalletStatistics(request, reply);
    }
  );

  // Test route for manual wallet update (for troubleshooting)
  fastify.post(
    "/wallet/test-update/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      try {
        const { branchId } = request.params;
        const { totalPrice = 1399 } = request.body;

        console.log(
          `Manual test update for branch ${branchId} with price ${totalPrice}`
        );

        // Emit the wallet update trigger event
        fastify.io.emit("walletUpdateTrigger", {
          branchId,
          orderId: "test-order-" + Date.now(),
          totalPrice,
        });

        return reply.status(200).send({
          success: true,
          message: "Wallet update trigger emitted",
          details: {
            branchId,
            totalPrice,
            expectedCharge:
              totalPrice <= 1000
                ? 2
                : totalPrice <= 1999
                ? 4
                : totalPrice <= 2999
                ? 6
                : 8,
          },
        });
      } catch (error) {
        request.log.error("Error in test wallet update:", error);
        return reply
          .status(500)
          .send({ error: "Failed to test wallet update" });
      }
    }
  );

  // Direct manual wallet update (bypassing socket events)
  fastify.post(
    "/wallet/manual-update/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling POST /wallet/manual-update/:branchId");
      return manualWalletUpdate(request, reply);
    }
  );

  // Initialize WebSocket listener
  setupWalletListener(fastify.io);
};
