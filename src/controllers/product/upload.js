import {
  uploadToS3,
  generateCategoryKey,
  generateProductKey,
  generatePresignedUrl,
} from "../../utils/s3Upload.js";
import { Category, Product } from "../../models/index.js";
import mongoose from "mongoose";

// Upload category image
export const uploadCategoryImage = async (req, reply) => {
  try {
    const { categoryId, branchId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // If branchId is provided, validate it
    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }

    // Check if this category belongs to the branch (if both are provided)
    if (
      branchId &&
      category.branchId &&
      category.branchId.toString() !== branchId
    ) {
      return reply
        .status(403)
        .send({ message: "Category doesn't belong to this branch" });
    }

    // Ensure an image file is provided
    if (!req.file) {
      return reply.status(400).send({ message: "No image file provided" });
    }

    // Validate image type
    const allowedMimetypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimetypes.includes(req.file.mimetype)) {
      return reply
        .status(400)
        .send({
          message: "Invalid image format. Only JPEG, JPG, and PNG are allowed.",
        });
    }

    // Generate S3 key and upload
    const key = generateCategoryKey(
      categoryId,
      !!category.branchId,
      category.branchId ? category.branchId.toString() : null
    );

    const imageUrl = await uploadToS3(req.file, key);

    // Update category with new image URL
    category.imageUrl = imageUrl;
    category.image = imageUrl; // For backwards compatibility
    await category.save();

    return reply.send({
      message: "Category image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error uploading category image",
        error: error.message,
      });
  }
};

// Upload product image
export const uploadProductImage = async (req, reply) => {
  try {
    const { productId, branchId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // If branchId is provided, validate it
    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    // Check if this product belongs to the branch (if both are provided)
    if (
      branchId &&
      product.branchId &&
      product.branchId.toString() !== branchId
    ) {
      return reply
        .status(403)
        .send({ message: "Product doesn't belong to this branch" });
    }

    // Ensure an image file is provided
    if (!req.file) {
      return reply.status(400).send({ message: "No image file provided" });
    }

    // Validate image type
    const allowedMimetypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimetypes.includes(req.file.mimetype)) {
      return reply
        .status(400)
        .send({
          message: "Invalid image format. Only JPEG, JPG, and PNG are allowed.",
        });
    }

    // Generate S3 key and upload
    const key = generateProductKey(
      productId,
      !!product.branchId,
      product.branchId ? product.branchId.toString() : null
    );

    const imageUrl = await uploadToS3(req.file, key);

    // Update product with new image URL
    product.imageUrl = imageUrl;
    product.image = imageUrl; // For backwards compatibility
    await product.save();

    return reply.send({
      message: "Product image uploaded successfully",
      imageUrl,
    });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error uploading product image", error: error.message });
  }
};

// Get pre-signed URL for category image upload
export const getCategoryImageUploadUrl = async (req, reply) => {
  try {
    const { categoryId, branchId } = req.params;
    const { contentType } = req.query;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }

    // Validate content type
    const allowedMimetypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimetypes.includes(contentType)) {
      return reply.status(400).send({
        message: "Invalid content type. Only JPEG, JPG, and PNG are allowed.",
      });
    }

    // Generate S3 key and pre-signed URL
    const key = generateCategoryKey(
      categoryId,
      !!category.branchId,
      category.branchId ? category.branchId.toString() : null
    );

    const uploadUrl = await generatePresignedUrl(key, contentType);

    return reply.send({
      uploadUrl,
      key,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error generating upload URL",
      error: error.message,
    });
  }
};

// Update category image URL after successful upload
export const updateCategoryImageUrl = async (req, reply) => {
  try {
    const { categoryId } = req.params;
    const { key } = req.body;

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Find and update category
    const category = await Category.findById(categoryId);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }

    const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGIONS}.amazonaws.com/${key}`;
    category.imageUrl = imageUrl;
    category.image = imageUrl; // For backwards compatibility
    await category.save();

    return reply.send({
      message: "Category image URL updated successfully",
      imageUrl,
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error updating category image URL",
      error: error.message,
    });
  }
};

// Get pre-signed URL for product image upload
export const getProductImageUploadUrl = async (req, reply) => {
  try {
    const { productId, branchId } = req.params;
    const { contentType } = req.query;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    // Validate content type
    const allowedMimetypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimetypes.includes(contentType)) {
      return reply.status(400).send({
        message: "Invalid content type. Only JPEG, JPG, and PNG are allowed.",
      });
    }

    // Generate S3 key and pre-signed URL
    const key = generateProductKey(
      productId,
      !!product.branchId,
      product.branchId ? product.branchId.toString() : null
    );

    const uploadUrl = await generatePresignedUrl(key, contentType);

    return reply.send({
      uploadUrl,
      key,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error generating upload URL",
      error: error.message,
    });
  }
};

// Update product image URL after successful upload
export const updateProductImageUrl = async (req, reply) => {
  try {
    const { productId } = req.params;
    const { key } = req.body;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // Find and update product
    const product = await Product.findById(productId);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    const imageUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGIONS}.amazonaws.com/${key}`;
    product.imageUrl = imageUrl;
    product.image = imageUrl; // For backwards compatibility
    await product.save();

    return reply.send({
      message: "Product image URL updated successfully",
      imageUrl,
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error updating product image URL",
      error: error.message,
    });
  }
};
