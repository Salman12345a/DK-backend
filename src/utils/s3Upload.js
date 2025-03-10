import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

/**
 * Uploads a file to S3 and returns the public URL.
 * @param {Buffer} buffer - The file buffer to upload
 * @param {string} key - The S3 object key (path)
 * @param {object} logger - Fastify logger instance for structured logging
 * @param {string} mimetype - The MIME type of the file (e.g., "image/jpeg")
 * @returns {string} - The public URL of the uploaded file
 */
export const uploadToS3 = async (buffer, key, logger, mimetype) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: mimetype, // Dynamic MIME type
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    logger.info({
      msg: "S3 upload successful",
      key,
      response: { ETag: response.ETag },
    });

    return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    logger.error({
      msg: "S3 upload failed",
      key,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};
