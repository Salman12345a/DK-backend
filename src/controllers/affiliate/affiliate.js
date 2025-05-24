import mongoose from "mongoose";
import AffiliateProduct from "../../models/affiliateProduct.js";
import { generateAffiliatePresignedUrl } from "../../utils/s3UploadAffiliate.js";

// Generate a pre-signed URL for affiliate product image upload
export const getUploadUrl = async (request, reply) => {
  try {
    // Verify admin privileges
    if (request.user.role !== "Admin") {
      return reply.code(403).send({
        status: "error",
        message: "Only admin users can manage affiliate products",
      });
    }

    // Generate a temporary ID for the file naming
    const tempId = new mongoose.Types.ObjectId();
    const contentType = request.query.contentType || "image/jpeg";
    
    // Generate pre-signed URL
    const { uploadUrl, key, imageUrl } = await generateAffiliatePresignedUrl(
      tempId,
      contentType
    );

    return reply.code(200).send({
      status: "success",
      data: {
        uploadUrl,
        key,
        imageUrl,
        tempId: tempId.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to generate upload URL",
      error: error.message,
    });
  }
};

// Create a new affiliate product
export const createAffiliateProduct = async (request, reply) => {
  try {
    // Verify admin privileges
    if (request.user.role !== "Admin") {
      return reply.code(403).send({
        status: "error",
        message: "Only admin users can manage affiliate products",
      });
    }

    const { name, imageUrl, affiliateLink } = request.body;

    // Validate required fields
    if (!name || !imageUrl || !affiliateLink) {
      return reply.code(400).send({
        status: "error",
        message: "Missing required fields: name, imageUrl, and affiliateLink are required",
      });
    }

    // Create new affiliate product
    const newAffiliateProduct = new AffiliateProduct({
      name,
      imageUrl,
      affiliateLink,
      createdBy: request.user.userId, // Use userId from the JWT token
    });

    await newAffiliateProduct.save();

    return reply.code(201).send({
      status: "success",
      message: "Affiliate product created successfully",
      data: newAffiliateProduct,
    });
  } catch (error) {
    console.error("Error creating affiliate product:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to create affiliate product",
      error: error.message,
    });
  }
};

// Get all affiliate products (with optional filtering)
export const getAffiliateProducts = async (request, reply) => {
  try {
    const { isActive, limit = 10, skip = 0 } = request.query;
    
    // Build query based on optional isActive parameter
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Get total count for pagination
    const total = await AffiliateProduct.countDocuments(query);
    
    // Fetch affiliate products with pagination
    const affiliateProducts = await AffiliateProduct.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    return reply.code(200).send({
      status: "success",
      data: {
        total,
        count: affiliateProducts.length,
        affiliateProducts,
      },
    });
  } catch (error) {
    console.error("Error fetching affiliate products:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to fetch affiliate products",
      error: error.message,
    });
  }
};

// Get affiliate product by ID
export const getAffiliateProductById = async (request, reply) => {
  try {
    const { id } = request.params;

    const affiliateProduct = await AffiliateProduct.findById(id);

    if (!affiliateProduct) {
      return reply.code(404).send({
        status: "error",
        message: "Affiliate product not found",
      });
    }

    return reply.code(200).send({
      status: "success",
      data: affiliateProduct,
    });
  } catch (error) {
    console.error("Error fetching affiliate product:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to fetch affiliate product",
      error: error.message,
    });
  }
};

// Update affiliate product
export const updateAffiliateProduct = async (request, reply) => {
  try {
    // Verify admin privileges
    if (request.user.role !== "Admin") {
      return reply.code(403).send({
        status: "error",
        message: "Only admin users can manage affiliate products",
      });
    }

    const { id } = request.params;
    const updates = request.body;
    
    // Find and update the affiliate product
    const affiliateProduct = await AffiliateProduct.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!affiliateProduct) {
      return reply.code(404).send({
        status: "error",
        message: "Affiliate product not found",
      });
    }

    return reply.code(200).send({
      status: "success",
      message: "Affiliate product updated successfully",
      data: affiliateProduct,
    });
  } catch (error) {
    console.error("Error updating affiliate product:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to update affiliate product",
      error: error.message,
    });
  }
};

// Delete (deactivate) affiliate product
export const deleteAffiliateProduct = async (request, reply) => {
  try {
    // Verify admin privileges
    if (request.user.role !== "Admin") {
      return reply.code(403).send({
        status: "error",
        message: "Only admin users can manage affiliate products",
      });
    }

    const { id } = request.params;
    
    // Soft delete by setting isActive to false
    const affiliateProduct = await AffiliateProduct.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!affiliateProduct) {
      return reply.code(404).send({
        status: "error",
        message: "Affiliate product not found",
      });
    }

    return reply.code(200).send({
      status: "success",
      message: "Affiliate product deactivated successfully",
      data: affiliateProduct,
    });
  } catch (error) {
    console.error("Error deactivating affiliate product:", error);
    return reply.code(500).send({
      status: "error",
      message: "Failed to deactivate affiliate product",
      error: error.message,
    });
  }
};
