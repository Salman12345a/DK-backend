import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

export const uploadToS3 = async (buffer, key) => {
  console.log("Uploading to S3:", { key, bufferType: buffer.constructor.name });
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: Buffer.from(buffer), // Ensure Buffer compatibility
    ContentType: "image/jpeg", // Adjust dynamically if eeded
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);
    console.log("S3 upload successful:", { key, response });
    return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("S3 upload error:", error);
    throw error;
  }
};
