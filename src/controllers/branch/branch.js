import Branch from "../../models/branch.js";
import { uploadToS3Branch } from "../../utils/s3UploadBranch.js";
import jwt from "jsonwebtoken"; // Added import for generating JWT token

// Controller to find nearby branches
export const getNearbyBranches = async (request, reply) => {
  try {
    const { lat, lng, radius = 2 } = request.query;

    if (!lat || !lng) {
      return reply
        .status(400)
        .send({ error: "Missing lat or lng query parameters" });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInKm = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
      return reply
        .status(400)
        .send({ error: "Invalid lat, lng, or radius values" });
    }

    const branches = await Branch.find({
      location: {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radiusInKm / 6378.1],
        },
      },
    }).lean();

    return reply.status(200).send({ branches });
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
};

// Controller to register a new branch
export const registerBranch = async (request, reply) => {
  const logger = request.log;
  const io = request.server.io; // Access Socket.IO instance

  try {
    // Extract parsed data from middleware
    const { files, body } = request;

    // Extract JSON fields from request.body
    const {
      branchName,
      branchLocation,
      branchAddress,
      branchEmail,
      openingTime,
      closingTime,
      ownerName,
      govId,
      homeDelivery,
      selfPickup,
      phone,
    } = body;

    // Validate required fields
    if (
      !branchName ||
      !branchLocation ||
      !branchAddress ||
      !openingTime ||
      !closingTime ||
      !ownerName ||
      !govId ||
      !phone ||
      !files.branchfrontImage ||
      !files.ownerIdProof ||
      !files.ownerPhoto
    ) {
      logger.warn({
        msg: "Missing required fields",
        body,
        files: Object.keys(files),
      });
      return reply.status(400).send({ error: "Missing required fields" });
    }

    // Parse nested objects (branchLocation, branchAddress)
    let parsedLocation, parsedAddress;
    try {
      parsedLocation = JSON.parse(branchLocation);
      parsedAddress = JSON.parse(branchAddress);
    } catch (error) {
      logger.warn({
        msg: "Invalid JSON format for branchLocation or branchAddress",
        error: error.message,
      });
      return reply
        .status(400)
        .send({ error: "Invalid branchLocation or branchAddress format" });
    }

    // Validate nested fields
    if (!parsedLocation.latitude || !parsedLocation.longitude) {
      return reply.status(400).send({ error: "Invalid branch location" });
    }
    if (
      !parsedAddress.street ||
      !parsedAddress.area ||
      !parsedAddress.city ||
      !parsedAddress.pincode
    ) {
      return reply.status(400).send({ error: "Invalid branch address" });
    }

    // Upload files to S3 and get their URLs using the branch-specific utility
    const timestamp = Date.now();
    const branchfrontImageUrl = await uploadToS3Branch(
      files.branchfrontImage.buffer,
      `branches/${branchName}/front-image-${timestamp}.${
        files.branchfrontImage.mimetype.split("/")[1]
      }`,
      logger,
      files.branchfrontImage.mimetype
    );
    const ownerIdProofUrl = await uploadToS3Branch(
      files.ownerIdProof.buffer,
      `branches/${branchName}/id-proof-${timestamp}.${
        files.ownerIdProof.mimetype.split("/")[1]
      }`,
      logger,
      files.ownerIdProof.mimetype
    );
    const ownerPhotoUrl = await uploadToS3Branch(
      files.ownerPhoto.buffer,
      `branches/${branchName}/owner-photo-${timestamp}.${
        files.ownerPhoto.mimetype.split("/")[1]
      }`,
      logger,
      files.ownerPhoto.mimetype
    );

    // Create a new branch document
    const newBranch = new Branch({
      phone,
      name: branchName,
      location: {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude], // [longitude, latitude]
      },
      address: {
        street: parsedAddress.street,
        area: parsedAddress.area,
        city: parsedAddress.city,
        pincode: parsedAddress.pincode,
      },
      branchEmail,
      openingTime,
      closingTime,
      ownerName,
      govId,
      deliveryServiceAvailable: homeDelivery === "true",
      selfPickup: selfPickup === "true",
      branchfrontImage: branchfrontImageUrl,
      ownerIdProof: ownerIdProofUrl,
      ownerPhoto: ownerPhotoUrl,
      deliveryPartners: [],
      storeStatus: "open",
      createdAt: new Date(),
    });

    // Save the branch to the database
    await newBranch.save();

    // Generate a new JWT token for the branch
    const accessToken = jwt.sign(
      { branchId: newBranch._id, phone: newBranch.phone, role: "Branch" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Emit WebSocket event to notify the branch (syncmart)
    const branchData = {
      branchId: newBranch._id,
      phone: newBranch.phone,
      name: newBranch.name,
      createdAt: newBranch.createdAt,
    };
    io.to(`syncmart_${phone}`).emit("branchRegistered", branchData);
    logger.info({
      msg: "Branch registration event emitted",
      branchId: newBranch._id,
      phone,
    });

    logger.info({
      msg: "Branch registered successfully",
      branchId: newBranch._id,
    });

    // Include accessToken in the response
    return reply.status(201).send({
      message: "Branch registered successfully",
      branch: newBranch,
      accessToken, // Added accessToken to the response
    });
  } catch (error) {
    logger.error({
      msg: "Error registering branch",
      error: error.message,
      stack: error.stack,
    });
    return reply
      .status(500)
      .send({ error: "Failed to register branch", details: error.message });
  }
};
