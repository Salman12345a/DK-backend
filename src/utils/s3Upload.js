import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

// Convert fs.readFile to promise-based
const readFile = promisify(fs.readFile);
const unlinkFile = promisify(fs.unlink);

// Configure AWS SDK
const configureS3 = () => {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1",
  });

  return new AWS.S3();
};

// Upload a file to S3
export const uploadToS3 = async (file, key) => {
  try {
    console.log("File received for upload:", JSON.stringify(file, null, 2));

    const s3 = configureS3();
    let fileContent;
    let mimeType = "application/octet-stream";

    // Handle different file formats
    if (file.path) {
      // File from multer or fastify-multipart
      console.log("Reading file from path:", file.path);
      fileContent = await readFile(file.path);
      mimeType = file.mimetype || file.type || "application/octet-stream";

      // Clean up the temporary file after upload
      try {
        await unlinkFile(file.path);
      } catch (err) {
        console.warn("Could not delete temp file:", err);
      }
    } else if (file.buffer) {
      // File is already a buffer
      console.log("Using provided buffer");
      fileContent = file.buffer;
      mimeType = file.mimetype || file.type || "application/octet-stream";
    } else if (
      typeof file === "object" &&
      file.name &&
      file.type &&
      file.binary
    ) {
      // AdminJS file upload format
      console.log("Processing AdminJS file upload format with binary");
      fileContent = Buffer.from(file.binary, "binary");
      mimeType = file.type;
    } else if (
      typeof file === "object" &&
      file.name &&
      file.type &&
      typeof file.base64 === "string"
    ) {
      // AdminJS file upload base64 format
      console.log("Processing AdminJS file upload format with base64");
      fileContent = Buffer.from(file.base64, "base64");
      mimeType = file.type;
    } else if (
      typeof file === "object" &&
      typeof file.path === "string" &&
      file.path.startsWith("data:")
    ) {
      // Data URL format
      console.log("Processing data URL format");
      const matches = file.path.match(/^data:(.+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        fileContent = Buffer.from(matches[2], "base64");
      } else {
        throw new Error("Invalid data URL format");
      }
    } else {
      console.error(
        "Unrecognized file format:",
        typeof file,
        Object.keys(file)
      );
      throw new Error("Invalid file format for S3 upload");
    }

    console.log(
      `Uploading to S3: bucket=${process.env.S3_BUCKET_NAME}, key=${key}, contentType=${mimeType}`
    );

    const params = {
      Bucket: process.env.S3_BUCKET_NAME || "dokirana-images",
      Key: key,
      Body: fileContent,
      ContentType: mimeType,
      ACL: "public-read",
    };

    console.log("Starting S3 upload...");
    const data = await s3.upload(params).promise();
    console.log("S3 upload complete, location:", data.Location);
    return data.Location;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

// Delete a file from S3
export const deleteFromS3 = async (key) => {
  try {
    const s3 = configureS3();
    const params = {
      Bucket: process.env.S3_BUCKET_NAME || "dokirana-images",
      Key: key,
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
};

// Generate key for category image
export const generateCategoryKey = (
  categoryId,
  isBranchSpecific = false,
  branchId = null
) => {
  if (isBranchSpecific && branchId) {
    return `branches/${branchId}/categories/${categoryId}.jpg`;
  }
  return `default/categories/${categoryId}.jpg`;
};

// Generate key for product image
export const generateProductKey = (
  productId,
  isBranchSpecific = false,
  branchId = null
) => {
  if (isBranchSpecific && branchId) {
    return `branches/${branchId}/products/${productId}.jpg`;
  }
  return `default/products/${productId}.jpg`;
};

// Get S3 URL from key
export const getS3Url = (key) => {
  const bucketName = process.env.S3_BUCKET_NAME || "dokirana-images";
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};
