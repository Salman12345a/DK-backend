import multipart from "@fastify/multipart";

export const uploadFiles = async (request, reply) => {
  const logger = request.log;

  const files = {};
  const fields = {};
  let partCount = 0;

  try {
    const parts = request.parts({ limits: { fileSize: 50 * 1024 * 1024 } });
    for await (const part of parts) {
      partCount++;
      if (part.type === "file" && part.file && part.readable) {
        if (
          [
            "licenseImage",
            "rcImage",
            "deliveryPartnerPhoto",
            "aadhaarFront",
            "aadhaarBack",
          ].includes(part.fieldname)
        ) {
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
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }

  if (partCount === 0 && request.body) {
    for (const field in request.body) {
      const part = request.body[field];
      if (part.type === "file") {
        if (
          [
            "licenseImage",
            "rcImage",
            "deliveryPartnerPhoto",
            "aadhaarFront",
            "aadhaarBack",
          ].includes(part.fieldname)
        ) {
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

  if (
    !files.licenseImage ||
    !files.rcImage ||
    !files.deliveryPartnerPhoto ||
    !files.aadhaarFront ||
    !files.aadhaarBack
  ) {
    logger.warn({
      msg: "Missing required files",
      missing: [
        !files.licenseImage && "licenseImage",
        !files.rcImage && "rcImage",
        !files.deliveryPartnerPhoto && "deliveryPartnerPhoto",
        !files.aadhaarFront && "aadhaarFront",
        !files.aadhaarBack && "aadhaarBack",
      ].filter(Boolean),
    });
    return reply.status(400).send({
      message:
        "All required files (licenseImage, rcImage, deliveryPartnerPhoto, aadhaarFront, aadhaarBack) must be uploaded",
    });
  }

  request.files = files;
  request.body = fields;

  logger.info({
    msg: "Multipart files parsed successfully",
    files: Object.keys(files),
    fields: Object.keys(fields),
  });
};
