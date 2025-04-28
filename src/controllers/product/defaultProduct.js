import { DefaultProduct, DefaultCategory } from "../../models/index.js";
import {
  uploadToS3,
  generateProductKey,
  getS3Url,
} from "../../utils/s3Upload.js";
import mongoose from "mongoose";

// Get all default products
export const getAllDefaultProducts = async (req, reply) => {
  try {
    const defaultProducts = await DefaultProduct.find({
      isActive: true,
    }).populate("defaultCategory", "name imageUrl");
    return reply.send(defaultProducts);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error fetching default products",
        error: error.message,
      });
  }
};

// Get default products by category
export const getDefaultProductsByCategory = async (req, reply) => {
  try {
    const { categoryId } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // First check if the category exists
    const category = await DefaultCategory.findById(categoryId);
    if (!category) {
      return reply.status(404).send({ message: "Default category not found" });
    }

    // Find products for this category
    const products = await DefaultProduct.find({
      defaultCategory: categoryId,
      isActive: true,
    }).populate("defaultCategory", "name imageUrl");

    return reply.send(products);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error fetching default products by category",
        error: error.message,
      });
  }
};

// Create a new default product
export const createDefaultProduct = async (req, reply) => {
  try {
    const {
      name,
      suggestedPrice,
      unit,
      defaultCategory,
      isPacket,
      description,
    } = req.body;

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(defaultCategory)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Check if category exists
    const categoryExists = await DefaultCategory.findById(defaultCategory);
    if (!categoryExists) {
      return reply.status(404).send({ message: "Default category not found" });
    }

    // Check if product with the same name already exists
    const existingProduct = await DefaultProduct.findOne({ name });
    if (existingProduct) {
      return reply
        .status(400)
        .send({ message: "A default product with this name already exists" });
    }

    // Require image for default product
    if (!req.file) {
      return reply.status(400).send({ message: "Image is required for default product" });
    }

    // Create new product without image first to get ID
    const newProduct = new DefaultProduct({
      name,
      suggestedPrice,
      unit,
      defaultCategory,
      isPacket: isPacket || false,
      description: description || "",
      imageUrl: "", // Temporary, will be updated after S3 upload
    });

    await newProduct.save();

    // Upload image to S3 if provided
    if (req.file) {
      const key = generateProductKey(newProduct._id);
      const imageUrl = await uploadToS3(req.file, key);

      // Update product with image URL
      newProduct.imageUrl = imageUrl;
      await newProduct.save();
    }

    // Ensure imageUrl is set
    if (!newProduct.imageUrl) {
      return reply.status(400).send({ message: "Image upload failed for default product" });
    }

    return reply.status(201).send(newProduct);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error creating default product",
        error: error.message,
      });
  }
};

// Update a default product
export const updateDefaultProduct = async (req, reply) => {
  try {
    const { id } = req.params;
    const { name, suggestedPrice, unit, isPacket, description, isActive } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // Find the product
    const product = await DefaultProduct.findById(id);
    if (!product) {
      return reply.status(404).send({ message: "Default product not found" });
    }

    // Update fields
    if (name) product.name = name;
    if (suggestedPrice !== undefined) product.suggestedPrice = suggestedPrice;
    if (unit) product.unit = unit;
    if (isPacket !== undefined) product.isPacket = isPacket;
    if (description !== undefined) product.description = description;
    if (isActive !== undefined) product.isActive = isActive;

    // Require image if not already set and not being updated
    if (!product.imageUrl && !req.file) {
      return reply.status(400).send({ message: "Image is required for default product" });
    }

    // Upload new image if provided
    if (req.file) {
      const key = generateProductKey(product._id);
      const imageUrl = await uploadToS3(req.file, key);
      product.imageUrl = imageUrl;
    }

    await product.save();
    return reply.send(product);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error updating default product",
        error: error.message,
      });
  }
};

// Delete a default product
export const deleteDefaultProduct = async (req, reply) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // Find and delete the product
    const product = await DefaultProduct.findByIdAndDelete(id);
    if (!product) {
      return reply.status(404).send({ message: "Default product not found" });
    }

    return reply.send({ message: "Default product deleted successfully" });
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error deleting default product",
        error: error.message,
      });
  }
};
