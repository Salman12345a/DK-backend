import { Category, DefaultCategory, Branch } from "../../models/index.js";
import {
  uploadToS3,
  generateCategoryKey,
  getS3Url,
} from "../../utils/s3Upload.js";
import mongoose from "mongoose";

// Get all categories (global, no branch filtering - for backward compatibility)
export const getAllCategories = async (req, reply) => {
  try {
    const categories = await Category.find();
    return reply.send(categories);
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

// Get categories for a specific branch
export const getBranchCategories = async (req, reply) => {
  try {
    const { branchId } = req.params;

    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Get categories for this branch that are active
    const categories = await Category.find({
      branchId,
      isActive: true,
    });

    return reply.send(categories);
  } catch (error) {
    return reply.status(500).send({
      message: "Error fetching branch categories",
      error: error.message,
    });
  }
};

// Create a new category for a branch
export const createBranchCategory = async (req, reply) => {
  try {
    const { branchId, name, createdBy } = req.body;

    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Check if category with same name already exists for this branch
    const existingCategory = await Category.findOne({ name, branchId });
    if (existingCategory) {
      return reply.status(400).send({
        message: "A category with this name already exists for this branch",
      });
    }

    // Create new category WITHOUT image first to get ID
    // The client should use the returned ID to upload an image using the pre-signed URL flow
    const newCategory = new Category({
      name,
      branchId,
      image: "", // Will be updated after S3 upload
      imageUrl: "", // Will be updated after S3 upload
      createdBy: createdBy || "branch_admin",
      createdFromTemplate: false,
    });

    await newCategory.save();

    // Do NOT handle image upload here. The client should use the pre-signed URL endpoints after creation.

    return reply.status(201).send(newCategory);
  } catch (error) {
    return reply.status(500).send({
      message: "Error creating branch category",
      error: error.message,
    });
  }
};

// Import default categories to a branch
export const importDefaultCategories = async (req, reply) => {
  try {
    const { branchId } = req.params;
    const { categoryIds } = req.body || {};

    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Get default categories based on provided IDs or all active ones
    let defaultCategories;
    let selectionMode = "all";
    
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      // Validate that all provided IDs are valid ObjectIds
      const validIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return reply.status(400).send({ 
          message: "Invalid category IDs provided. Please provide valid category IDs." 
        });
      }
      
      // Get only the selected active default categories
      defaultCategories = await DefaultCategory.find({ 
        _id: { $in: validIds },
        isActive: true 
      });
      selectionMode = "selected";
      
      if (defaultCategories.length === 0) {
        return reply.status(404).send({ 
          message: "None of the selected default categories were found or active" 
        });
      }
    } else {
      // Backward compatibility: Get all active default categories
      defaultCategories = await DefaultCategory.find({ isActive: true });
      
      if (defaultCategories.length === 0) {
        return reply.status(404).send({ 
          message: "No default categories found to import" 
        });
      }
    }

    const importResults = [];

    // Import each default category to the branch
    for (const defaultCategory of defaultCategories) {
      // Check if this category already exists for the branch
      const existingCategory = await Category.findOne({
        name: defaultCategory.name,
        branchId,
      });

      if (existingCategory) {
        importResults.push({
          name: defaultCategory.name,
          status: "skipped",
          reason: "Category already exists for this branch",
        });
        continue;
      }

      // Create new branch category from the template
      const newCategory = new Category({
        name: defaultCategory.name,
        branchId,
        image: defaultCategory.imageUrl, // For backwards compatibility
        imageUrl: defaultCategory.imageUrl,
        createdFromTemplate: true,
        createdBy: "system",
      });

      await newCategory.save();
      importResults.push({
        name: defaultCategory.name,
        status: "imported",
        id: newCategory._id,
      });
    }

    return reply.send({
      message: selectionMode === "selected" 
        ? "Selected default categories import completed" 
        : "Default categories import completed",
      totalImported: importResults.filter((r) => r.status === "imported").length,
      totalSkipped: importResults.filter((r) => r.status === "skipped").length,
      results: importResults,
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error importing default categories",
      error: error.message,
    });
  }
};

// Update a branch category
export const updateBranchCategory = async (req, reply) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Find the category
    const category = await Category.findById(id);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }

    // Update fields
    if (name) category.name = name;
    if (isActive !== undefined) category.isActive = isActive;

    // Upload new image if provided
    if (req.file) {
      const key = generateCategoryKey(category._id, true, category.branchId);
      const imageUrl = await uploadToS3(req.file, key);
      category.imageUrl = imageUrl;
      category.image = imageUrl; // For backwards compatibility
    }

    await category.save();
    return reply.send(category);
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error updating category", error: error.message });
  }
};

// Delete a branch category
export const deleteBranchCategory = async (req, reply) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Find and delete the category
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }

    return reply.send({ message: "Category deleted successfully" });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error deleting category", error: error.message });
  }
};
