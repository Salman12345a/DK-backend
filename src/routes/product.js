import {
  getAllCategories,
  getBranchCategories,
  createBranchCategory,
  importDefaultCategories,
  updateBranchCategory,
  deleteBranchCategory,
  deactivateImportedCategory,
  deactivateMultipleImportedCategories,
  removeImportedCategories,
  deleteCustomCategory,
} from "../controllers/product/category.js";

import {
  getProductByCategoryId,
  getBranchProducts,
  getBranchProductsByCategory,
  getBranchCategoryProduct,
  createBranchProduct,
  importDefaultProducts,
  updateBranchProduct,
  deleteBranchProduct,
  disableProductsFromOrder,
  modifyImportedDefaultProduct,
  deactivateImportedProducts,
  deleteCustomProduct,
  getDisabledBranchProducts,
  enableProduct,
} from "../controllers/product/product.js";

import {
  getAllDefaultCategories,
  createDefaultCategory,
  updateDefaultCategory,
  deleteDefaultCategory,
} from "../controllers/product/defaultCategory.js";

import {
  getAllDefaultProducts,
  getDefaultProductsByCategory,
  createDefaultProduct,
  updateDefaultProduct,
  deleteDefaultProduct,
} from "../controllers/product/defaultProduct.js";

import {
  uploadCategoryImage,
  uploadProductImage,
  getCategoryImageUploadUrl,
  updateCategoryImageUrl,
  getProductImageUploadUrl,
  updateProductImageUrl,
} from "../controllers/product/upload.js";

// Import for file handling
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { uploadToS3 } from "../utils/s3Upload.js";
import { verifyToken, checkBranchRole } from "../middleware/auth.js";

// Multer configuration - keep as fallback if needed
import multer from "fastify-multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Helper function to handle file uploads with built-in multipart
const handleFileUpload = async (request) => {
  const data = await request.file();
  const filename = `${Date.now()}_${randomUUID()}${path.extname(
    data.filename
  )}`;
  const filepath = join("./uploads", filename);
  await writeFile(filepath, await data.toBuffer());

  return {
    path: filepath,
    filename: filename,
    mimetype: data.mimetype,
    originalname: data.filename,
  };
};

// Original category routes (for backward compatibility)
export const categoryRoutes = async (fastify, options) => {
  fastify.get("/categories", getAllCategories);
};

// Original product routes (for backward compatibility)
export const productRoutes = async (fastify, options) => {
  fastify.get("/products/:categoryId", getProductByCategoryId);
};

// Branch-specific category routes
export const branchCategoryRoutes = async (fastify, options) => {
  // Get all categories for a branch
  fastify.get("/branch/:branchId/categories", getBranchCategories);

  // Create a new category for a branch
  fastify.post("/branch/:branchId/categories", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return createBranchCategory(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Import default categories to a branch
  fastify.post(
    "/branch/:branchId/categories/import-default",
    importDefaultCategories
  );

  // Update a branch category
  fastify.put("/branch/categories/:id", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return updateBranchCategory(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Delete a branch category
  fastify.delete("/branch/categories/:id", deleteBranchCategory);

  // Delete a custom category
  fastify.delete("/branch/:branchId/categories/custom", deleteCustomCategory);

  // Remove imported default categories (single or bulk)
  fastify.put("/branch/:branchId/categories/remove-imported", removeImportedCategories);

  // Get pre-signed URL for category image upload
  fastify.get(
    "/branch/:branchId/categories/:categoryId/image-upload-url",
    getCategoryImageUploadUrl
  );

  // Update category image URL after successful upload
  fastify.post(
    "/branch/categories/:categoryId/image-url",
    updateCategoryImageUrl
  );

  // Keep the old upload endpoint for backward compatibility
  fastify.post(
    "/branch/:branchId/categories/:categoryId/image",
    async (request, reply) => {
      try {
        if (request.isMultipart()) {
          const file = await handleFileUpload(request);
          request.file = file;
        }
        return uploadCategoryImage(request, reply);
      } catch (error) {
        reply
          .status(500)
          .send({ message: "Error processing upload", error: error.message });
      }
    }
  );
};

// Branch-specific product routes
export const branchProductRoutes = async (fastify, options) => {
  // Global authentication hook for all branch product routes
  fastify.addHook("preHandler", async (request, reply) => {
    const isAuthenticated = await verifyToken(request, reply);
    if (!isAuthenticated) {
      return reply.code(401).send({ 
        status: "ERROR", 
        message: "Authentication required", 
        code: "AUTHENTICATION_REQUIRED" 
      });
    }
  });
  // Get all products for a branch
  fastify.get("/branch/:branchId/products", getBranchProducts);
  
  // Get all disabled products for a branch
  fastify.get("/branch/:branchId/products/disabled", {
    schema: {
      params: {
        type: "object",
        properties: {
          branchId: { type: "string" }
        },
        required: ["branchId"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            data: {
              type: "object",
              properties: {
                count: { type: "number" },
                products: { type: "array" }
              }
            }
          }
        },
        400: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        404: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" },
            systemError: { type: "string" }
          }
        }
      }
    },
    handler: getDisabledBranchProducts
  });
  
  // Enable a disabled product
  fastify.patch("/branch/products/:productId/enable", {
    schema: {
      params: {
        type: "object",
        properties: {
          productId: { type: "string" }
        },
        required: ["productId"]
      },
      headers: {
        type: "object",
        properties: {
          Authorization: { type: "string" }
        },
        required: ["Authorization"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                product: { type: "object" },
                enabled: { type: "boolean" },
                enabledAt: { type: "string", format: "date-time" }
              }
            }
          }
        },
        400: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        401: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        403: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        404: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            status: { type: "string" },
            message: { type: "string" },
            code: { type: "string" },
            systemError: { type: "string" }
          }
        }
      }
    },
    handler: enableProduct
  });
  
  // Get a specific product by branch, category, and product ID
  fastify.get("/branch/:branchId/categories/:categoryId/products/:productId", getBranchCategoryProduct);

  // Get products for a branch by category
  fastify.get(
    "/branch/:branchId/categories/:categoryId/products",
    {
      schema: {
        params: {
          type: "object",
          properties: {
            branchId: { type: "string" },
            categoryId: { type: "string" }
          },
          required: ["branchId", "categoryId"]
        },
        querystring: {
          type: "object",
          properties: {
            showAll: { type: "string", enum: ["true", "false"] }
          }
        },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              data: {
                type: "object",
                properties: {
                  categoryName: { type: "string" },
                  totalProducts: { type: "number" },
                  products: { type: "array" }
                }
              }
            }
          },
          400: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              code: { type: "string" }
            }
          },
          404: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              code: { type: "string" }
            }
          },
          500: {
            type: "object",
            properties: {
              status: { type: "string" },
              message: { type: "string" },
              code: { type: "string" },
              systemError: { type: "string" }
            }
          }
        }
      },
      handler: getBranchProductsByCategory
    }
  );

  // Create a new product for a branch
  fastify.post("/branch/:branchId/products", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return createBranchProduct(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Import default products to a branch
  fastify.post(
    "/branch/:branchId/categories/:categoryId/import-products",
    importDefaultProducts
  );

  // Modify imported default product for a branch
  fastify.put(
    "/branch/:branchId/imported-products/:productId/modify",
    async (request, reply) => {
      try {
        // Check content type to determine if it's a multipart request
        const contentType = request.headers['content-type'] || '';
        
        // Only process as multipart if explicitly specified
        if (contentType.includes('multipart/form-data')) {
          if (request.isMultipart()) {
            const file = await handleFileUpload(request);
            request.file = file;
          }
        }
        
        return modifyImportedDefaultProduct(request, reply);
      } catch (error) {
        reply
          .status(500)
          .send({ message: "Error processing request", error: error.message });
      }
    }
  );

  // Update a branch product(important for implementation)
  fastify.put("/branch/products/:id", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return updateBranchProduct(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Delete a branch product(important for implementation)
  fastify.delete("/branch/products/:id", deleteBranchProduct);

  // Get pre-signed URL for product image upload(important for implementation)
  fastify.get(
    "/branch/:branchId/products/:productId/image-upload-url",
    getProductImageUploadUrl
  );

  // Update product image URL after successful upload(important for implementation)
  fastify.post(
    "/branch/products/:productId/image-url",
    updateProductImageUrl
  );

  // Keep the old upload endpoint for backward compatibility
  fastify.post(
    "/branch/:branchId/products/:productId/image",
    async (request, reply) => {
      try {
        if (request.isMultipart()) {
          const file = await handleFileUpload(request);
          request.file = file;
        }
        return uploadProductImage(request, reply);
      } catch (error) {
        reply
          .status(500)
          .send({ message: "Error processing upload", error: error.message });
      }
    }
  );

  // Disable products from order
  fastify.put("/branch/:branchId/products/disable", disableProductsFromOrder);

  // Remove imported default products (single or bulk)
  fastify.put("/branch/:branchId/products/remove-imported", deactivateImportedProducts);

  // Delete a custom product (single or multiple)
  fastify.delete("/branch/:branchId/products/custom", deleteCustomProduct);
};

// Admin default category routes
export const defaultCategoryRoutes = async (fastify, options) => {
  // Get all default categories
  fastify.get("/admin/default-categories", getAllDefaultCategories);

  // Create a new default category
  fastify.post("/admin/default-categories", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return createDefaultCategory(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Update a default category
  fastify.put("/admin/default-categories/:id", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return updateDefaultCategory(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Delete a default category
  fastify.delete("/admin/default-categories/:id", deleteDefaultCategory);
};

// Admin default product routes
export const defaultProductRoutes = async (fastify, options) => {
  // Get all default products
  fastify.get("/admin/default-products", getAllDefaultProducts);

  // Get default products by category
  fastify.get(
    "/admin/default-categories/:categoryId/products",
    getDefaultProductsByCategory
  );

  // Create a new default product
  fastify.post("/admin/default-products", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return createDefaultProduct(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Update a default product
  fastify.put("/admin/default-products/:id", async (request, reply) => {
    try {
      if (request.isMultipart()) {
        const file = await handleFileUpload(request);
        request.file = file;
      }
      return updateDefaultProduct(request, reply);
    } catch (error) {
      reply
        .status(500)
        .send({ message: "Error processing upload", error: error.message });
    }
  });

  // Delete a default product
  fastify.delete("/admin/default-products/:id", deleteDefaultProduct);
};
