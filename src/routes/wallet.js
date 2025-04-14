import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import {
  getWalletBalance,
  getWalletTransactions,
  postWalletPayment,
  getWalletPayments,
  getWalletStatistics,
  setupWalletListener,
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

  // Initialize WebSocket listener
  setupWalletListener(fastify.io);
};
