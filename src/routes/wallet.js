import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import {
  getWalletBalance,
  getWalletTransactions,
  postWalletPayment,
  getWalletPayments,
  getWalletStatistics,
  setupWalletListener,
} from "../controllers/wallet/wallet.js";
import {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
} from "../controllers/wallet/razorpay.js";

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
  
  // Razorpay integration endpoints
  
  // Create a new Razorpay order
  fastify.post(
    "/wallet/razorpay/order/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling POST /wallet/razorpay/order/:branchId");
      return createRazorpayOrder(request, reply);
    }
  );
  
  // Verify payment and update wallet
  fastify.post(
    "/wallet/razorpay/verify/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling POST /wallet/razorpay/verify/:branchId");
      return verifyPayment(request, reply);
    }
  );
  
  // Get payment status
  fastify.get(
    "/wallet/razorpay/payment/:paymentId",
    { preHandler: [verifyToken] },
    async (request, reply) => {
      console.log("Handling GET /wallet/razorpay/payment/:paymentId");
      return getPaymentStatus(request, reply);
    }
  );
  
  // Webhook endpoint - does not require auth as it's called by Razorpay
  fastify.post(
    "/wallet/razorpay/webhook",
    { 
      schema: {
        // Disable body parsing to verify raw body for webhook
        body: { type: 'object', additionalProperties: true }
      }
    },
    async (request, reply) => {
      console.log("Handling POST /wallet/razorpay/webhook");
      return handleWebhook(request, reply);
    }
  );
};
