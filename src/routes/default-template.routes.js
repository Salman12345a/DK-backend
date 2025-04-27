import { DefaultCategory, DefaultProduct } from "../models/index.js";

/**
 * Routes for default templates
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Route options
 */
export default async function (fastify, options) {
  // Get all default categories
  fastify.get("/default-categories", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  imageUrl: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        // Fetch only active categories
        const categories = await DefaultCategory.find({ isActive: true }).sort({
          createdAt: -1,
        });

        return {
          success: true,
          data: categories,
        };
      } catch (error) {
        console.error("Error fetching default categories:", error);
        return reply.code(400).send({
          success: false,
          error: error.message || "Failed to fetch default categories",
        });
      }
    },
  });

  // Get default products by category
  fastify.get("/default-products/by-category/:categoryId", {
    schema: {
      params: {
        type: "object",
        required: ["categoryId"],
        properties: {
          categoryId: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  suggestedPrice: { type: "number" },
                  unit: { type: "string" },
                  defaultCategory: { type: "string" },
                  imageUrl: { type: "string" },
                  isPacket: { type: "boolean" },
                  description: { type: "string" },
                  isActive: { type: "boolean" },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
              },
            },
            category: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string" },
                imageUrl: { type: "string" },
              },
            },
          },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { categoryId } = request.params;

        // Check if category exists
        const category = await DefaultCategory.findById(categoryId);
        if (!category) {
          return reply.code(404).send({
            success: false,
            error: "Category not found",
          });
        }

        // Fetch products for the category
        const products = await DefaultProduct.find({
          defaultCategory: categoryId,
          isActive: true,
        }).sort({ name: 1 });

        return {
          success: true,
          data: products,
          category: {
            _id: category._id,
            name: category.name,
            imageUrl: category.imageUrl,
          },
        };
      } catch (error) {
        console.error("Error fetching products by category:", error);
        return reply.code(400).send({
          success: false,
          error: error.message || "Failed to fetch products by category",
        });
      }
    },
  });
}
