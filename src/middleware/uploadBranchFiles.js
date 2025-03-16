import multipart from "@fastify/multipart";

export const uploadBranchFiles = async (request, reply) => {
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
          ["branchfrontImage", "ownerIdProof", "ownerPhoto"].includes(
            part.fieldname
          )
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
          ["branchfrontImage", "ownerIdProof", "ownerPhoto"].includes(
            part.fieldname
          )
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

  if (!files.branchfrontImage || !files.ownerIdProof || !files.ownerPhoto) {
    logger.warn({
      msg: "Missing required files",
      missing: [
        !files.branchfrontImage && "branchfrontImage",
        !files.ownerIdProof && "ownerIdProof",
        !files.ownerPhoto && "ownerPhoto",
      ].filter(Boolean),
    });
    return reply.status(400).send({
      message:
        "All required files (branchfrontImage, ownerIdProof, ownerPhoto) must be uploaded",
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
