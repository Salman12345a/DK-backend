import { registerDeliveryPartner } from "../controllers/deliveryPartner/deliveryPartner.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import { uploadFiles } from "../middleware/upload.js";
import { DeliveryPartner } from "../models/user.js";

export const deliveryPartnerRoutes = async function (fastify) {
  console.log("Registering deliveryPartnerRoutes");

  fastify.post(
    "/register",
    {
      preHandler: [verifyToken, checkBranchRole, uploadFiles],
    },
    registerDeliveryPartner
  );

  fastify.get(
    "/",
    {
      preHandler: [verifyToken, checkBranchRole],
    },
    async (req, reply) => {
      try {
        const branchId = req.query.branchId;
        if (!branchId) {
          return reply.code(400).send({
            status: "ERROR",
            message: "branchId is required",
            code: "MISSING_BRANCH_ID",
          });
        }

        const partners = await DeliveryPartner.find({
          branch: branchId,
        }).select("_id status name");
        return reply.send(partners); // Add return to prevent further execution
      } catch (error) {
        console.error("Fetch Delivery Partners Error:", error);
        return reply.code(500).send({
          // Add return here too
          status: "ERROR",
          message: "Internal server error",
          code: "SERVER_ERROR",
          systemError: error.message,
        });
      }
    }
  );
};
