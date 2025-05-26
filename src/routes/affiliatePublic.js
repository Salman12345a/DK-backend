import { getPublicAffiliateProducts } from "../controllers/affiliate/affiliate.js";

export const affiliatePublicRoutes = async (fastify, options) => {
  // Public endpoint for getting affiliate products (no authentication required)
  fastify.get("/affiliate/public/products", getPublicAffiliateProducts);
};
