import { registerDeliveryPartner } from "../controllers/deliveryPartner/deliveryPartner.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";
import { uploadFiles } from "../middleware/upload.js";

export const deliveryPartnerRoutes = async (fastify, options) => {
  fastify.post(
    "/delivery-partner/register",
    {
      preHandler: [verifyToken, checkBranchRole, uploadFiles],
      config: { rawBody: true }, // Disable default body parsing
    },
    registerDeliveryPartner
  );
};
