import multipart from "@fastify/multipart";

export const uploadFiles = async (request, reply) => {
  console.log("Starting multipart parsing for request:", {
    url: request.url,
    headers: request.headers,
    isMultipart: request.isMultipart(),
    body: request.body || "No body parsed yet",
  });

  const files = {};
  const fields = {};
  let partCount = 0;

  // First, try using request.parts()
  try {
    const parts = request.parts({ limits: { fileSize: 50 * 1024 * 1024 } });
    for await (const part of parts) {
      partCount++;
      console.log(`Part ${partCount}:`, {
        type: part.type,
        fieldname: part.fieldname || "N/A",
        filename: part.filename || "N/A",
        mimetype: part.mimetype || "N/A",
        size: part.file ? (await part.toBuffer()).length : "N/A",
        isFile: part.file ? true : false,
        readable: part.readable ? true : false,
      });
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
    console.error("Error parsing parts:", error);
  }

  console.log("Total parts received via parts():", partCount);
  console.log("Files parsed via parts():", Object.keys(files));
  console.log("Fields parsed via parts():", Object.keys(fields));

  // If no parts were received, try using request.body as a fallback
  if (partCount === 0 && request.body) {
    console.log("Falling back to request.body...");
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
    console.log("Files parsed via request.body:", Object.keys(files));
    console.log("Fields parsed via request.body:", Object.keys(fields));
  }

  if (!files.licenseImage || !files.rcImage || !files.pancard) {
    return reply
      .code(400)
      .send({
        message:
          "All required files (licenseImage, rcImage, pancard) must be uploaded",
      });
  }
  request.files = files;
  request.body = fields; // Populate request.body with text fields
};
