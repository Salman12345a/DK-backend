import multipart from "@fastify/multipart";

export const uploadFiles = async (request, reply) => {
  const logger = request.log; // Use Fastify's logger

  const files = {};
  const fields = {};
  let partCount = 0;

  // Try parsing multipart data with request.parts()
  try {
    const parts = request.parts({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
    for await (const part of parts) {
      partCount++;
      if (part.type === "file" && part.file && part.readable) {
        if (["licenseImage", "rcImage", "pancard"].includes(part.fieldname)) {
          files[part.fieldname] = {
            buffer: await part.toBuffer(),
            mimetype: part.mimetype,
            filename: part.filename,
          };
        }
      } else if (part.type === "field") {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    logger.error({
      msg: "Error parsing multipart parts",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      message: "Failed to process uploaded files",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }), // Detailed error in dev only
    });
  }

  // Fallback to request.body if no parts were received
  if (partCount === 0 && request.body) {
    for (const field in request.body) {
      const part = request.body[field];
      if (part.type === "file") {
        if (["licenseImage", "rcImage", "pancard"].includes(part.fieldname)) {
          files[part.fieldname] = {
            buffer: await part.toBuffer(),
            mimetype: part.mimetype,
            filename: part.filename,
          };
        }
      } else if (part.type === "field") {
        fields[part.fieldname] = part.value;
      }
    }
  }

  // Validate required files
  if (!files.licenseImage || !files.rcImage || !files.pancard) {
    logger.warn({
      msg: "Missing required files",
      missing: [
        !files.licenseImage && "licenseImage",
        !files.rcImage && "rcImage",
        !files.pancard && "pancard",
      ].filter(Boolean),
    });
    return reply.status(400).send({
      message:
        "All required files (licenseImage, rcImage, pancard) must be uploaded",
    });
  }

  // Attach parsed data to request
  request.files = files;
  request.body = fields;

  // Log success (optional, can be removed in production if not needed)
  logger.info({
    msg: "Multipart files parsed successfully",
    files: Object.keys(files),
    fields: Object.keys(fields),
  });
};
