import { DefaultCategory } from "../../models/index.js";
import {
  uploadToS3,
  generateCategoryKey,
  getS3Url,
} from "../../utils/s3Upload.js";
import mongoose from "mongoose";

// Get all default categories
export const getAllDefaultCategories = async (req, reply) => {
  try {
    const defaultCategories = await DefaultCategory.find({ isActive: true });
    return reply.send(defaultCategories);
  } catch (error) {
    return reply.status(500).send({
      message: "Error fetching default categories",
      error: error.message,
    });
  }
};

// Create a new default category
export const createDefaultCategory = async (req, reply) => {
  try {
    const { name, description } = req.body;

    // Check if category with the same name already exists
    const existingCategory = await DefaultCategory.findOne({ name });
    if (existingCategory) {
      return reply
        .status(400)
        .send({ message: "A default category with this name already exists" });
    }

    // Require image for default category
    if (!req.file) {
      return reply.status(400).send({ message: "Image is required for default category" });
    }

    // Create new category without image first to get ID
    const newCategory = new DefaultCategory({
      name,
      description,
      imageUrl: "", // Temporary, will be updated after S3 upload
    });

    await newCategory.save();

    // Upload image to S3 if provided
    if (req.file) {
      const key = generateCategoryKey(newCategory._id);
      const imageUrl = await uploadToS3(req.file, key);

      // Update category with image URL
      newCategory.imageUrl = imageUrl;
      await newCategory.save();
    }

    // Ensure imageUrl is set
    if (!newCategory.imageUrl) {
      return reply.status(400).send({ message: "Image upload failed for default category" });
    }

    return reply.status(201).send(newCategory);
  } catch (error) {
    return reply.status(500).send({
      message: "Error creating default category",
      error: error.message,
    });
  }
};

// Update a default category
export const updateDefaultCategory = async (req, reply) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Find the category
    const category = await DefaultCategory.findById(id);
    if (!category) {
      return reply.status(404).send({ message: "Default category not found" });
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    // Require image if not already set and not being updated
    if (!category.imageUrl && !req.file) {
      return reply.status(400).send({ message: "Image is required for default category" });
    }

    // Upload new image if provided
    if (req.file) {
      const key = generateCategoryKey(category._id);
      const imageUrl = await uploadToS3(req.file, key);
      category.imageUrl = imageUrl;
    }

    await category.save();
    return reply.send(category);
  } catch (error) {
    return reply.status(500).send({
      message: "Error updating default category",
      error: error.message,
    });
  }
};

// Delete a default category
export const deleteDefaultCategory = async (req, reply) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Find and delete the category
    const category = await DefaultCategory.findByIdAndDelete(id);
    if (!category) {
      return reply.status(404).send({ message: "Default category not found" });
    }

    return reply.send({ message: "Default category deleted successfully" });
  } catch (error) {
    return reply.status(500).send({
      message: "Error deleting default category",
      error: error.message,
    });
  }
};
