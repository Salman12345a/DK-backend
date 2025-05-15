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
          message: "No active default categories found with the provided IDs." 
        });
      }
    } else {
      // Get all active default categories
      defaultCategories = await DefaultCategory.find({ isActive: true });
      
      if (defaultCategories.length === 0) {
        return reply.status(404).send({ 
          message: "No active default categories found in the system." 
        });
      }
    }

    // Process each default category for import
    const importResults = [];

    for (const defaultCategory of defaultCategories) {
      try {
        // Check if a category with the same name already exists for this branch
        const existingCategory = await Category.findOne({
          name: defaultCategory.name,
          branchId
        });

        if (existingCategory) {
          // Update the existing category with the latest default category data
          existingCategory.image = defaultCategory.imageUrl; // For backwards compatibility
          existingCategory.imageUrl = defaultCategory.imageUrl;
          existingCategory.createdFromTemplate = true;
          existingCategory.defaultCategoryId = defaultCategory._id;
          existingCategory.isActive = true;

          await existingCategory.save();
          
          importResults.push({
            name: defaultCategory.name,
            status: "updated",
            id: existingCategory._id,
            originalId: defaultCategory._id
          });
          continue;
        }

        // Create new category if it doesn't exist
        const newCategory = new Category({
          name: defaultCategory.name,
          branchId,
          image: defaultCategory.imageUrl, // For backwards compatibility
          imageUrl: defaultCategory.imageUrl,
          createdFromTemplate: true,
          createdBy: "system",
          defaultCategoryId: defaultCategory._id,
        });

        await newCategory.save();
        importResults.push({
          name: defaultCategory.name,
          status: "imported",
          id: newCategory._id,
          originalId: defaultCategory._id
        });
      } catch (error) {
        importResults.push({
          name: defaultCategory.name,
          status: "error",
          reason: error.message || "Unknown error during import",
          id: defaultCategory._id
        });
      }
    }

    return reply.send({
      message: selectionMode === "selected" 
        ? "Selected default categories import completed" 
        : "Default categories import completed",
      totalImported: importResults.filter((r) => r.status === "imported").length,
      totalUpdated: importResults.filter((r) => r.status === "updated").length,
      totalErrors: importResults.filter((r) => r.status === "error").length,
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

// Deactivate (soft delete) an imported default category
export const deactivateImportedCategory = async (req, reply) => {
  try {
    const { id, branchId } = req.params;
    
    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }
    
    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }
    
    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }
    
    // Find the category
    const category = await Category.findById(id);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }
    
    // Verify it belongs to the specified branch
    if (category.branchId.toString() !== branchId) {
      return reply.status(403).send({ 
        message: "This category does not belong to the specified branch" 
      });
    }
    
    // Verify it's an imported default category
    if (!category.createdFromTemplate || category.createdBy !== "system") {
      return reply.status(400).send({ 
        message: "This operation is only allowed for imported default categories" 
      });
    }
    
    // Delete the category instead of deactivating it
    await Category.findByIdAndDelete(id);
    
    return reply.send({ 
      message: "Imported category removed successfully",
      categoryId: id,
      categoryName: category.name
    });
  } catch (error) {
    return reply.status(500).send({ 
      message: "Error removing imported category", 
      error: error.message 
    });
  }
};

// Bulk deactivate multiple imported default categories
export const deactivateMultipleImportedCategories = async (req, reply) => {
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
    
    // Validate category IDs
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return reply.status(400).send({ 
        message: "Please provide an array of category IDs to remove" 
      });
    }
    
    const validIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return reply.status(400).send({ 
        message: "No valid category IDs provided" 
      });
    }
    
    // Find all categories that match the criteria:
    // 1. Belong to the specified branch
    // 2. Are in the provided list of IDs
    // 3. Are imported default categories (createdFromTemplate: true, createdBy: "system")
    const categories = await Category.find({
      _id: { $in: validIds },
      branchId: branchId,
      createdFromTemplate: true,
      createdBy: "system"
    });
    
    if (categories.length === 0) {
      return reply.status(404).send({ 
        message: "No matching imported default categories found for this branch" 
      });
    }
    
    // Delete all matching categories
    const deletionResults = [];
    for (const category of categories) {
      await Category.findByIdAndDelete(category._id);
      deletionResults.push({
        id: category._id,
        name: category.name,
        status: "removed"
      });
    }
    
    // Report on any IDs that were not found or not imported categories
    const notProcessedIds = validIds.filter(id => 
      !deletionResults.some(result => result.id.toString() === id)
    );
    
    return reply.send({
      message: "Bulk removal of imported categories completed",
      totalRemoved: deletionResults.length,
      totalNotProcessed: notProcessedIds.length,
      removed: deletionResults,
      notProcessed: notProcessedIds
    });
  } catch (error) {
    return reply.status(500).send({ 
      message: "Error removing imported categories", 
      error: error.message 
    });
  }
};

// Remove imported default categories (single or multiple)
export const removeImportedCategories = async (req, reply) => {
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
    
    // Validate category IDs
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return reply.status(400).send({ 
        message: "Please provide an array of category IDs to remove" 
      });
    }
    
    const validIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return reply.status(400).send({ 
        message: "No valid category IDs provided" 
      });
    }
    
    // Find all categories that match the criteria:
    // 1. Belong to the specified branch
    // 2. Are in the provided list of IDs
    // 3. Are imported default categories (createdFromTemplate: true, createdBy: "system")
    const categories = await Category.find({
      _id: { $in: validIds },
      branchId: branchId,
      createdFromTemplate: true,
      createdBy: "system"
    });
    
    if (categories.length === 0) {
      return reply.status(404).send({ 
        message: "No matching imported default categories found for this branch" 
      });
    }
    
    // Delete all matching categories
    const deletionResults = [];
    for (const category of categories) {
      await Category.findByIdAndDelete(category._id);
      deletionResults.push({
        id: category._id,
        name: category.name,
        status: "removed"
      });
    }
    
    // Report on any IDs that were not found or not imported categories
    const notProcessedIds = validIds.filter(id => 
      !deletionResults.some(result => result.id.toString() === id)
    );
    
    return reply.send({
      message: categories.length === 1 
        ? "Category removed successfully" 
        : "Bulk removal of imported categories completed",
      totalRemoved: deletionResults.length,
      totalNotProcessed: notProcessedIds.length,
      removed: deletionResults,
      notProcessed: notProcessedIds
    });
  } catch (error) {
    return reply.status(500).send({ 
      message: "Error removing imported categories", 
      error: error.message 
    });
  }
};

// Delete a custom category
export const deleteCustomCategory = async (req, reply) => {
  try {
    const { id, branchId } = req.params;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }
    
    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }
    
    // Find the category
    const category = await Category.findById(id);
    if (!category) {
      return reply.status(404).send({ message: "Category not found" });
    }
    
    // Verify it belongs to the specified branch
    if (category.branchId.toString() !== branchId) {
      return reply.status(403).send({ 
        message: "This category does not belong to the specified branch" 
      });
    }
    
    // Verify it's a custom category
    if (category.createdFromTemplate || category.createdBy === "system") {
      return reply.status(400).send({ 
        message: "This operation is only allowed for custom categories" 
      });
    }
    
    // Delete the category
    await Category.findByIdAndDelete(id);
    
    return reply.send({ 
      message: "Custom category deleted successfully",
      categoryId: id,
      categoryName: category.name
    });
  } catch (error) {
    return reply.status(500).send({ 
      message: "Error deleting custom category", 
      error: error.message 
    });
  }
};
