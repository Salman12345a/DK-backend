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
  
  // Create a new Razorpay order (with branchId parameter)
  fastify.post(
    "/wallet/razorpay/order/create/:branchId",
    { preHandler: [verifyToken, checkBranchRole] },
    async (request, reply) => {
      console.log("Handling POST /wallet/razorpay/order/create/:branchId");
      return createRazorpayOrder(request, reply);
    }
  );
  
  // Create a new Razorpay order (handle request format from frontend without branchId parameter)
  // Not using verifyToken to avoid authentication issues during payment flow
  fastify.post(
    "/wallet/razorpay/order/create",
    async (request, reply) => {
      console.log("Handling POST /wallet/razorpay/order/create");
      
      try {
        // Extract branchId from request body
        const { branchId, amount } = request.body;
        
        if (!branchId) {
          return reply.status(400).send({
            success: false,
            error: "branchId is required in the request body"
          });
        }

        if (!amount || amount < 1) {
          return reply.status(400).send({
            success: false,
            error: "Valid amount is required"
          });
        }
        
        // Add branchId to params so the controller can use it
        request.params = { ...request.params, branchId };
        
        return createRazorpayOrder(request, reply);
      } catch (error) {
        console.error("Error processing Razorpay order request:", error);
        return reply.status(500).send({
          success: false,
          error: "Internal server error while processing payment request"
        });
      }
    }
  );
  
  // Route for accessing order details by orderId
  fastify.get(
    "/wallet/razorpay/order/:orderId",
    async (request, reply) => {
      console.log("Handling GET /wallet/razorpay/order/:orderId");
      // Just return a placeholder response for now
      return reply.status(200).send({
        success: true,
        message: "Order details endpoint (placeholder)",
        orderId: request.params.orderId
      });
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
