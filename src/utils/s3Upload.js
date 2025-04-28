import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

// Convert fs.readFile to promise-based
const readFile = promisify(fs.readFile);
const unlinkFile = promisify(fs.unlink);

// Configure AWS SDK v3 S3 client for categories/products
const s3Client = new S3Client({
  region: process.env.AWS_REGIONS || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Upload a file to S3
export const uploadToS3 = async (file, key) => {
  try {
    console.log("File received for upload:", JSON.stringify(file, null, 2));

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
      `Uploading to S3: bucket=${process.env.S3_BUCKET}, key=${key}, contentType=${mimeType}`
    );

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: mimeType,
      ACL: "public-read",
    };

    console.log("Starting S3 upload...");
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const region = process.env.AWS_REGIONS || "us-east-1";
    const bucketName = process.env.S3_BUCKET;
    const location = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    console.log("S3 upload complete, location:", location);
    return location;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

// Delete a file from S3
export const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
    };
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
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
  const bucketName = process.env.S3_BUCKET;
  const region = process.env.AWS_REGIONS || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

// Generate pre-signed URL for S3 upload (AWS SDK v3)
export const generatePresignedUrl = async (key, contentType) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  };
  const command = new PutObjectCommand(params);
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    return url;
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    throw error;
  }
};
