import multer from "fastify-multer";
const upload = multer({ storage: multer.memoryStorage() });

export const uploadFiles = upload.fields([
  { name: "licenseImage", maxCount: 1 },
  { name: "rcImage", maxCount: 1 },
  { name: "pancard", maxCount: 1 },
]);
