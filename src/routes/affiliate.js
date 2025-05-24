import { verifyToken } from "../middleware/auth.js";
import {
  getUploadUrl,
  createAffiliateProduct,
  getAffiliateProducts,
  getAffiliateProductById,
  updateAffiliateProduct,
  deleteAffiliateProduct
} from "../controllers/affiliate/affiliate.js";

export const affiliateRoutes = async (fastify, options) => {
  // Middleware for protected routes
  fastify.addHook("onRequest", verifyToken);

  // Get pre-signed URL for affiliate product image upload
  fastify.get("/affiliate/upload-url", getUploadUrl);

  // Create a new affiliate product
  fastify.post("/affiliate/products", createAffiliateProduct);

  // Get all affiliate products (with optional filtering)
  fastify.get("/affiliate/products", getAffiliateProducts);

  // Get affiliate product by ID
  fastify.get("/affiliate/products/:id", getAffiliateProductById);

  // Update affiliate product
  fastify.patch("/affiliate/products/:id", updateAffiliateProduct);

  // Delete (deactivate) affiliate product
  fastify.delete("/affiliate/products/:id", deleteAffiliateProduct);
};
