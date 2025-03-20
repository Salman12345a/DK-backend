import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

export const uploadToS3Branch = async (buffer, key, logger, mimetype) => {
  const params = {
    Bucket: process.env.S3_BRANCH_BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: mimetype,
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    logger.info({
      msg: "S3 upload successful",
      key,
      response: { ETag: response.ETag },
    });

    return `https://${process.env.S3_BRANCH_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
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
