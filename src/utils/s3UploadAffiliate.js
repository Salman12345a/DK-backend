import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure AWS SDK v3 S3 client for affiliate products (using third bucket)
const s3Client = new S3Client({
  region: process.env.AWS_REGION_AFFILIATE || process.env.AWS_REGIONS || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Generate key for affiliate product image
export const generateAffiliateProductKey = (affiliateProductId) => {
  return `third/affiliate-products/${affiliateProductId}.jpg`;
};

// Get S3 URL from key for the third bucket
export const getThirdBucketS3Url = (key) => {
  const bucketName = process.env.S3_AFFILIATE_BUCKET;
  const region = process.env.AWS_REGION_AFFILIATE || process.env.AWS_REGIONS || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

// Generate pre-signed URL for S3 upload to third bucket
export const generateAffiliatePresignedUrl = async (affiliateProductId, contentType) => {
  const key = generateAffiliateProductKey(affiliateProductId);
  const params = {
    Bucket: process.env.S3_AFFILIATE_BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  };
  const command = new PutObjectCommand(params);
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
    return {
      uploadUrl: url,
      key: key,
      imageUrl: getThirdBucketS3Url(key)
    };
  } catch (error) {
    console.error("Error generating pre-signed URL for affiliate product:", error);
    throw error;
  }
};
