import mongoose from "mongoose";
import {
  Product,
  Category,
  DefaultProduct,
  DefaultCategory,
  Branch,
} from "../../models/index.js";
import { uploadToS3, generateProductKey } from "../../utils/s3Upload.js";

// Get products by category ID (original function for backward compatibility)
export const getProductByCategoryId = async (req, reply) => {
  const { categoryId } = req.params;

  try {
    // Validate if categoryId is a valid ObjectId
    if (!mongoose.isValidObjectId(categoryId)) {
      return reply.status(400).send({ message: "Invalid categoryId format" });
    }

    // Query the products using the correct field name (Category) and ObjectId
    const products = await Product.find({
      Category: new mongoose.Types.ObjectId(categoryId),
    })
      .select("-__v") // Exclude the version key
      .exec();

    // Handle case where no products are found
    if (!products || products.length === 0) {
      return reply
        .status(404)
        .send({ message: "No products found for this category" });
    }

    // Return the found products
    return reply.send(products);
  } catch (error) {
    // Handle any unexpected errors
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

// Get all products for a specific branch
export const getBranchProducts = async (req, reply) => {
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

    // Get all active products for this branch
    const products = await Product.find({
      branchId,
      isAvailable: true,
    }).populate("Category", "name imageUrl");

    return reply.send(products);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error fetching branch products",
        error: error.message,
      });
  }
};

// Get branch products by category
export const getBranchProductsByCategory = async (req, reply) => {
  try {
    const { branchId, categoryId } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      return reply.status(400).send({ message: "Invalid ID format" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Verify category exists for this branch
    const category = await Category.findOne({ _id: categoryId, branchId });
    if (!category) {
      return reply
        .status(404)
        .send({ message: "Category not found for this branch" });
    }

    // Get products for this branch and category
    const products = await Product.find({
      branchId,
      Category: categoryId,
      isAvailable: true,
    }).populate("Category", "name imageUrl");

    return reply.send(products);
  } catch (error) {
    return reply
      .status(500)
      .send({
        message: "Error fetching branch products by category",
        error: error.message,
      });
  }
};

// Create a new product for a branch
export const createBranchProduct = async (req, reply) => {
  try {
    const {
      name,
      price,
      discountPrice,
      quantity,
      unit,
      categoryId,
      branchId,
      isPacket,
      description,
    } = req.body;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      return reply.status(400).send({ message: "Invalid ID format" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Verify category exists for this branch
    const category = await Category.findOne({ _id: categoryId, branchId });
    if (!category) {
      return reply
        .status(404)
        .send({ message: "Category not found for this branch" });
    }

    // Check if product with same name already exists for this branch
    const existingProduct = await Product.findOne({ name, branchId });
    if (existingProduct) {
      return reply
        .status(400)
        .send({
          message: "A product with this name already exists for this branch",
        });
    }

    // Create new product WITHOUT image first to get ID
    // The client should use the returned ID to upload an image using the pre-signed URL flow
    const newProduct = new Product({
      name,
      price,
      discountPrice,
      quantity,
      unit,
      Category: categoryId,
      branchId,
      isPacket: isPacket || false,
      description: description || "",
      image: "", // Will be updated after S3 upload
      imageUrl: "", // Will be updated after S3 upload
      createdFromTemplate: false,
    });

    await newProduct.save();

    // Do NOT handle image upload here. The client should use the pre-signed URL endpoints after creation.

    return reply.status(201).send(newProduct);
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error creating branch product", error: error.message });
  }
};

// Import default products to a branch
export const importDefaultProducts = async (req, reply) => {
  try {
    const { branchId, categoryId } = req.params;
    const { productIds } = req.body || {};

    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Validate category ID if provided
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      return reply.status(400).send({ message: "Invalid category ID" });
    }

    // Verify category exists and belongs to this branch if categoryId is provided
    let category;
    if (categoryId) {
      category = await Category.findOne({ _id: categoryId, branchId });
      if (!category) {
        return reply.status(404).send({ 
          message: "Category not found or does not belong to this branch" 
        });
      }
    }

    // Get default products based on provided IDs or filter by category
    let defaultProducts;
    let selectionMode = "all";
    
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      // Validate that all provided IDs are valid ObjectIds
      const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      
      if (validIds.length === 0) {
        return reply.status(400).send({ 
          message: "Invalid product IDs provided. Please provide valid product IDs." 
        });
      }
      
      // Get only the selected active default products
      defaultProducts = await DefaultProduct.find({ 
        _id: { $in: validIds },
        isActive: true 
      });
      selectionMode = "selected";
      
      if (defaultProducts.length === 0) {
        return reply.status(404).send({ 
          message: "No active default products found with the provided IDs." 
        });
      }
    } else if (categoryId) {
      // Get all active default products for the specified category
      defaultProducts = await DefaultProduct.find({ 
        Category: categoryId,
        isActive: true 
      });
      
      if (defaultProducts.length === 0) {
        return reply.status(404).send({ 
          message: "No active default products found for the specified category." 
        });
      }
    } else {
      // Get all active default products
      defaultProducts = await DefaultProduct.find({ isActive: true });
      
      if (defaultProducts.length === 0) {
        return reply.status(404).send({ 
          message: "No active default products found in the system." 
        });
      }
    }

    // Process each default product for import
    const importResults = [];
    
    for (const defaultProduct of defaultProducts) {
      try {
        // Check if a product with the same name already exists for this branch
        const existingProduct = await Product.findOne({
          name: defaultProduct.name,
          branchId
        });

        if (existingProduct) {
          importResults.push({
            name: defaultProduct.name,
            status: "skipped",
            reason: "Product already exists for this branch",
            id: defaultProduct._id
          });
          continue;
        }

        // Always create a new product with a new MongoDB-generated ID
        // This ensures each branch gets its own unique copy
        const newProduct = new Product({
          name: defaultProduct.name,
          branchId,
          price: defaultProduct.price,
          discountPrice: defaultProduct.discountPrice,
          quantity: defaultProduct.quantity,
          unit: defaultProduct.unit,
          Category: defaultProduct.Category,
          image: defaultProduct.imageUrl, // For backwards compatibility
          imageUrl: defaultProduct.imageUrl,
          isPacket: defaultProduct.isPacket || false,
          description: defaultProduct.description || "",
          createdFromTemplate: true,
          defaultProductId: defaultProduct._id, // Store the original default product ID for reference
        });

        try {
          await newProduct.save();
          importResults.push({
            name: defaultProduct.name,
            status: "imported",
            id: newProduct._id,
            originalId: defaultProduct._id
          });
        } catch (saveError) {
          // Check if it's a duplicate key error on the name field
          if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.name) {
            // Generate a modified name to avoid the conflict
            const branchSuffix = branchId.toString().substring(0, 4);
            const modifiedName = `${defaultProduct.name}_${branchSuffix}`;
            
            // Try again with the modified name
            newProduct.name = modifiedName;
            try {
              await newProduct.save();
              importResults.push({
                name: defaultProduct.name,
                status: "imported",
                id: newProduct._id,
                originalId: defaultProduct._id,
                modifiedName: modifiedName,
                note: "Imported with modified name to avoid conflict"
              });
            } catch (retryError) {
              importResults.push({
                name: defaultProduct.name,
                status: "error",
                reason: `Failed to import even with modified name: ${retryError.message}`,
                id: defaultProduct._id
              });
            }
          } else {
            // Handle other save errors
            importResults.push({
              name: defaultProduct.name,
              status: "error",
              reason: saveError.message || "Unknown error during save",
              id: defaultProduct._id
            });
          }
        }
      } catch (error) {
        // Handle errors for individual product imports
        importResults.push({
          name: defaultProduct.name,
          status: "error",
          reason: error.message || "Unknown error during import",
          id: defaultProduct._id
        });
      }
    }

    return reply.send({
      message: selectionMode === "selected" 
        ? "Selected default products import completed" 
        : "Default products import completed",
      totalImported: importResults.filter((r) => r.status === "imported").length,
      totalSkipped: importResults.filter((r) => r.status === "skipped").length,
      totalErrors: importResults.filter((r) => r.status === "error").length,
      results: importResults,
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error importing default products",
      error: error.message,
    });
  }
};

// Update a branch product
export const updateBranchProduct = async (req, reply) => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      discountPrice,
      quantity,
      unit,
      isPacket,
      description,
      isAvailable,
      disabledReason,
    } = req.body;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    // Update fields
    if (name) product.name = name;
    if (price !== undefined) product.price = price;
    if (discountPrice !== undefined) product.discountPrice = discountPrice;
    if (quantity) product.quantity = quantity;
    if (unit) product.unit = unit;
    if (isPacket !== undefined) product.isPacket = isPacket;
    if (description !== undefined) product.description = description;

    // Handle availability changes
    if (isAvailable !== undefined && product.isAvailable !== isAvailable) {
      product.isAvailable = isAvailable;

      if (!isAvailable) {
        product.disabledReason = disabledReason || "Manually disabled";
        product.lastDisabledAt = new Date();
      }
    }

    // Only attempt to upload image if a valid file was provided
    // This prevents errors when updating product details without an image
    if (req.file && req.file.buffer) {
      try {
        const key = generateProductKey(product._id, true, product.branchId);
        const imageUrl = await uploadToS3(req.file, key);
        product.imageUrl = imageUrl;
        product.image = imageUrl; // For backwards compatibility
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        // Continue without updating the image
      }
    }

    product.lastModifiedBy = "branch_admin";
    await product.save();
    return reply.send(product);
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error updating product", error: error.message });
  }
};

// Modify imported default product for a branch
export const modifyImportedDefaultProduct = async (req, reply) => {
  try {
    const { branchId, productId } = req.params;
    const {
      name,
      price,
      discountPrice,
      quantity,
      unit,
      isPacket,
      description,
      isAvailable,
      disabledReason,
    } = req.body;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return reply.status(400).send({ message: "Invalid ID format" });
    }

    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }

    // Find the product for this branch
    const product = await Product.findOne({
      _id: productId,
      branchId,
      createdFromTemplate: true, // Ensure it's an imported product
    });

    if (!product) {
      return reply.status(404).send({ 
        message: "Imported product not found for this branch" 
      });
    }

    // Store original values for tracking changes
    const originalValues = {
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      quantity: product.quantity,
      unit: product.unit,
      isPacket: product.isPacket,
      description: product.description,
      isAvailable: product.isAvailable
    };

    // Update fields
    if (name) product.name = name;
    if (price !== undefined) product.price = price;
    if (discountPrice !== undefined) product.discountPrice = discountPrice;
    if (quantity) product.quantity = quantity;
    if (unit) product.unit = unit;
    if (isPacket !== undefined) product.isPacket = isPacket;
    if (description !== undefined) product.description = description;

    // Handle availability changes
    if (isAvailable !== undefined && product.isAvailable !== isAvailable) {
      product.isAvailable = isAvailable;

      if (!isAvailable) {
        product.disabledReason = disabledReason || "Manually disabled";
        product.lastDisabledAt = new Date();
      }
    }

    // Only attempt to upload image if a valid file was provided
    // This prevents errors when updating product details without an image
    if (req.file && req.file.buffer) {
      try {
        const key = generateProductKey(product._id, true, product.branchId);
        const imageUrl = await uploadToS3(req.file, key);
        product.imageUrl = imageUrl;
        product.image = imageUrl; // For backwards compatibility
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        // Continue without updating the image
      }
    }

    // Track modifications from default template
    product.modifiedFromDefault = true;
    product.lastModifiedBy = "branch_admin";
    
    // Identify which fields were modified from the default
    const modifiedFields = [];
    if (name && name !== originalValues.name) modifiedFields.push("name");
    if (price !== undefined && price !== originalValues.price) modifiedFields.push("price");
    if (discountPrice !== undefined && discountPrice !== originalValues.discountPrice) modifiedFields.push("discountPrice");
    if (quantity && quantity !== originalValues.quantity) modifiedFields.push("quantity");
    if (unit && unit !== originalValues.unit) modifiedFields.push("unit");
    if (isPacket !== undefined && isPacket !== originalValues.isPacket) modifiedFields.push("isPacket");
    if (description !== undefined && description !== originalValues.description) modifiedFields.push("description");
    if (isAvailable !== undefined && isAvailable !== originalValues.isAvailable) modifiedFields.push("isAvailable");
    // Only track image modification if a valid file was uploaded
    if (req.file && req.file.buffer) modifiedFields.push("image");
    
    await product.save();
    
    return reply.send({
      message: "Imported default product modified successfully",
      product,
      modifiedFields
    });
  } catch (error) {
    return reply.status(500).send({
      message: "Error modifying imported default product",
      error: error.message,
    });
  }
};

// Delete a branch product
export const deleteBranchProduct = async (req, reply) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.status(400).send({ message: "Invalid product ID" });
    }

    // Find and delete the product
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }

    return reply.send({ message: "Product deleted successfully" });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error deleting product", error: error.message });
  }
};

// Disable products based on order modification (auto-disable)
export const disableProductsFromOrder = async (req, reply) => {
  try {
    const { branchId } = req.params;
    const { productIds, reason } = req.body;

    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }

    // Validate product IDs
    if (!Array.isArray(productIds) || !productIds.length) {
      return reply
        .status(400)
        .send({ message: "Product IDs must be a non-empty array" });
    }

    for (const id of productIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ message: `Invalid product ID: ${id}` });
      }
    }

    // Update all specified products
    const updateResult = await Product.updateMany(
      {
        _id: { $in: productIds },
        branchId,
      },
      {
        $set: {
          isAvailable: false,
          disabledReason: reason || "Out of Stock",
          lastDisabledAt: new Date(),
          lastModifiedBy: "system",
        },
      }
    );

    return reply.send({
      message: "Products disabled successfully",
      modifiedCount: updateResult.modifiedCount,
      matchedCount: updateResult.matchedCount,
    });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Error disabling products", error: error.message });
  }
};

// Deactivate imported default products (single or multiple)
export const deactivateImportedProducts = async (req, reply) => {
  try {
    const { branchId } = req.params;
    const { productIds, reason } = req.body || {};
    
    // Validate branch ID
    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return reply.status(400).send({ message: "Invalid branch ID" });
    }
    
    // Verify branch exists
    const branch = await Branch.findById(branchId);
    if (!branch) {
      return reply.status(404).send({ message: "Branch not found" });
    }
    
    // Validate product IDs
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return reply.status(400).send({ 
        message: "Please provide an array of product IDs to remove" 
      });
    }
    
    const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return reply.status(400).send({ 
        message: "No valid product IDs provided" 
      });
    }
    
    // Find all products that match the criteria:
    // 1. Belong to the specified branch
    // 2. Are in the provided list of IDs
    // 3. Are imported default products (createdFromTemplate: true)
    const products = await Product.find({
      _id: { $in: validIds },
      branchId: branchId,
      createdFromTemplate: true
    });
    
    if (products.length === 0) {
      return reply.status(404).send({ 
        message: "No matching imported default products found for this branch" 
      });
    }
    
    // Delete all matching products
    const deletionResults = [];
    
    for (const product of products) {
      await Product.findByIdAndDelete(product._id);
      
      deletionResults.push({
        id: product._id,
        name: product.name,
        status: "removed"
      });
    }
    
    // Report on any IDs that were not found or not imported products
    const notProcessedIds = validIds.filter(id => 
      !deletionResults.some(result => result.id.toString() === id)
    );
    
    return reply.send({
      message: products.length === 1 
        ? "Product removed successfully" 
        : "Bulk removal of imported products completed",
      totalRemoved: deletionResults.length,
      totalNotProcessed: notProcessedIds.length,
      removed: deletionResults,
      notProcessed: notProcessedIds
    });
  } catch (error) {
    return reply.status(500).send({ 
      message: "Error removing imported products", 
      error: error.message 
    });
  }
};
