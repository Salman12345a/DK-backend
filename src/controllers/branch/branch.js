import Branch from "../../models/branch.js";
import jwt from "jsonwebtoken";
import { uploadToS3Branch } from "../../utils/s3UploadBranch.js";
import { trackOTPVerification } from "../../middleware/otpVerification.js";
import mongoose from "mongoose";

const OTPVerification = mongoose.model("OTPVerification");

// Temporary storage for branch registration data
const pendingRegistrations = new Map();

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

export const registerBranch = async (request, reply) => {
  const logger = request.log;
  const io = request.server.io;

  try {
    const { files, body } = request;
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

    // Check if phone number is already registered
    const existingBranch = await Branch.findOne({ phone });
    if (existingBranch) {
      return reply.status(400).send({
        error: "Phone number already registered",
        requiresVerification: !existingBranch.isPhoneVerified,
      });
    }

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

    const newBranch = new Branch({
      phone,
      name: branchName,
      location: {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude],
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
      storeStatus: "closed",
      status: "pending",
      isPhoneVerified: false,
      createdAt: new Date(),
    });

    const savedBranch = await newBranch.save();
    console.log(`Branch saved with status: ${savedBranch.status}`);

    const accessToken = jwt.sign(
      { branchId: savedBranch._id, phone: savedBranch.phone, role: "Branch" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    const branchData = {
      branchId: savedBranch._id,
      phone: savedBranch.phone,
      status: savedBranch.status,
      requiresVerification: true,
    };
    io.to(`syncmart_${phone}`).emit("branchRegistered", branchData);
    console.log(
      `Emitting branchRegistered event to syncmart_${phone} with status: ${savedBranch.status}`
    );
    logger.info({
      msg: "Branch registration event emitted",
      branchId: savedBranch._id,
      phone,
      status: savedBranch.status,
    });

    logger.info({
      msg: "Branch registered successfully",
      branchId: savedBranch._id,
    });

    return reply.status(201).send({
      message:
        "Branch registered successfully. Please verify your phone number.",
      branch: savedBranch,
      accessToken,
      requiresVerification: true,
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

export const updateBranchStatus = async (request, reply) => {
  const logger = request.log;
  const io = request.server.io;

  try {
    const { branchId } = request.params;
    const { status } = request.body;

    console.log(`Updating status for branchId: ${branchId} to ${status}`);

    if (!["approved", "rejected"].includes(status)) {
      logger.warn({ msg: "Invalid status value", status });
      return reply.status(400).send({ error: "Invalid status value" });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      logger.warn({ msg: "Branch not found", branchId });
      return reply.status(404).send({ error: "Branch not found" });
    }

    branch.status = status;
    branch.accessToken = jwt.sign(
      {
        branchId: branch._id,
        phone: branch.phone,
        role: "Branch",
      },
      process.env.ACCESS_TOKEN_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    const updatedBranch = await branch.save();
    console.log(
      `Branch ${branchId} status updated to: ${updatedBranch.status}`
    );
    console.log(`Generated accessToken: ${updatedBranch.accessToken}`);
    console.log(`Branch phone for emission: ${updatedBranch.phone}`);

    const branchData = {
      branchId: updatedBranch._id,
      phone: updatedBranch.phone,
      status: updatedBranch.status,
      accessToken: updatedBranch.accessToken,
    };
    const room = `syncmart_${updatedBranch.phone}`;
    console.log(
      `Emitting branchStatusUpdated to room: ${room} with data:`,
      branchData
    );
    io.to(room).emit("branchStatusUpdated", branchData);
    console.log(
      `Emitted branchStatusUpdated event to ${room} with status: ${updatedBranch.status}`
    );
    logger.info({
      msg: "Branch status update event emitted",
      branchId: updatedBranch._id,
      phone: updatedBranch.phone,
      status: updatedBranch.status,
    });

    return reply.status(200).send({
      message: "Branch status updated successfully",
      branch: {
        _id: updatedBranch._id,
        status: updatedBranch.status,
        phone: updatedBranch.phone,
        accessToken: updatedBranch.accessToken,
      },
    });
  } catch (error) {
    logger.error({
      msg: "Error updating branch status",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      error: "Failed to update branch status",
      details: error.message,
    });
  }
};

export const getBranchStatus = async (request, reply) => {
  const logger = request.log;

  try {
    const { branchId } = request.params;

    if (!branchId) {
      logger.warn({ msg: "Missing branchId parameter" });
      return reply.status(400).send({ error: "Missing branchId parameter" });
    }

    const branch = await Branch.findById(branchId).select("status phone name");
    if (!branch) {
      logger.warn({ msg: "Branch not found", branchId });
      return reply.status(404).send({ error: "Branch not found" });
    }

    logger.info({
      msg: "Branch status retrieved successfully",
      branchId,
      status: branch.status,
    });

    return reply.status(200).send({
      branchId: branch._id,
      phone: branch.phone,
      name: branch.name,
      status: branch.status,
    });
  } catch (error) {
    logger.error({
      msg: "Error retrieving branch status",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      error: "Failed to retrieve branch status",
      details: error.message,
    });
  }
};

export const modifyBranch = async (request, reply) => {
  const logger = request.log;

  try {
    const { branchId } = request.params;
    const {
      branchName,
      location,
      address,
      branchEmail,
      openingTime,
      closingTime,
      ownerName,
      govId,
      phone,
      homeDelivery,
      selfPickup,
      branchfrontImage,
      ownerIdProof,
      ownerPhoto,
    } = request.body;

    if (!branchId) {
      logger.warn({ msg: "Missing branchId parameter" });
      return reply.status(400).send({ error: "Missing branchId parameter" });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) {
      logger.warn({ msg: "Branch not found", branchId });
      return reply.status(404).send({ error: "Branch not found" });
    }

    // Update only the fields provided in the request
    if (branchName) branch.name = branchName;
    if (location) {
      if (
        !location.type ||
        location.type !== "Point" ||
        !Array.isArray(location.coordinates) ||
        location.coordinates.length !== 2
      ) {
        logger.warn({ msg: "Invalid location format", location });
        return reply.status(400).send({ error: "Invalid branch location" });
      }
      branch.location = {
        type: "Point",
        coordinates: [location.coordinates[0], location.coordinates[1]], // [longitude, latitude]
      };
    }
    if (address) {
      if (
        !address.street ||
        !address.area ||
        !address.city ||
        !address.pincode
      ) {
        logger.warn({ msg: "Invalid address format", address });
        return reply.status(400).send({ error: "Invalid branch address" });
      }
      branch.address = {
        street: address.street,
        area: address.area,
        city: address.city,
        pincode: address.pincode,
      };
    }
    if (branchEmail) branch.branchEmail = branchEmail;
    if (openingTime) branch.openingTime = openingTime;
    if (closingTime) branch.closingTime = closingTime;
    if (ownerName) branch.ownerName = ownerName;
    if (govId) branch.govId = govId;
    if (phone) branch.phone = phone;
    if (typeof homeDelivery !== "undefined")
      branch.deliveryServiceAvailable = homeDelivery;
    if (typeof selfPickup !== "undefined") branch.selfPickup = selfPickup;
    if (branchfrontImage) branch.branchfrontImage = branchfrontImage;
    if (ownerIdProof) branch.ownerIdProof = ownerIdProof;
    if (ownerPhoto) branch.ownerPhoto = ownerPhoto;

    // Update status from "rejected" to "pending" on resubmission
    if (branch.status === "rejected") {
      branch.status = "pending";
      logger.info({
        msg: "Branch status updated from rejected to pending",
        branchId: branch._id,
      });
    }

    const updatedBranch = await branch.save();
    logger.info({
      msg: "Branch details modified successfully",
      branchId: updatedBranch._id,
    });

    return reply.status(200).send({
      message: "Branch details modified successfully",
      branch: updatedBranch,
    });
  } catch (error) {
    logger.error({
      msg: "Error modifying branch details",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      error: "Failed to modify branch details",
      details: error.message,
    });
  }
};

export const initiateBranchRegistration = async (request, reply) => {
  const logger = request.log;
  try {
    const { files, body } = request;
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

    // Store files in S3
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

    // Store registration data temporarily
    const registrationData = {
      phone,
      name: branchName,
      location: {
        type: "Point",
        coordinates: [parsedLocation.longitude, parsedLocation.latitude],
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
      timestamp: Date.now(), // For cleanup of old pending registrations
    };

    // Store in temporary storage with 30 minutes expiry
    pendingRegistrations.set(phone, registrationData);
    setTimeout(() => {
      pendingRegistrations.delete(phone);
    }, 30 * 60 * 1000); // 30 minutes expiry

    logger.info({
      msg: "Branch registration initiated",
      phone,
    });

    return reply.status(200).send({
      status: "success",
      message:
        "Branch registration initiated. Please verify your phone number.",
      data: {
        phone,
        nextStep: "verify_phone",
      },
    });
  } catch (error) {
    logger.error({
      msg: "Error initiating branch registration",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      error: "Failed to initiate registration",
      details: error.message,
    });
  }
};

export const completeBranchRegistration = async (request, reply) => {
  const logger = request.log;
  const io = request.server.io;

  try {
    const { phone } = request.body;

    // Debug logs
    console.log("Completing registration for phone:", phone);
    console.log(
      "Current pending registrations:",
      Array.from(pendingRegistrations.keys())
    );
    console.log("Registration data exists:", pendingRegistrations.has(phone));

    // Check if phone is verified
    const verification = await OTPVerification.findOne({
      phoneNumber: phone,
      isVerified: true,
      expiresAt: { $gt: new Date() },
    });

    console.log("OTP Verification status:", verification);

    if (!verification) {
      return reply.status(403).send({
        status: "error",
        message:
          "Phone number not verified. Please complete verification first.",
      });
    }

    // Get pending registration data
    const registrationData = pendingRegistrations.get(phone);
    console.log("Found registration data:", !!registrationData);

    if (!registrationData) {
      return reply.status(404).send({
        status: "error",
        message:
          "Registration data not found or expired. Please register again.",
        debug: {
          pendingPhones: Array.from(pendingRegistrations.keys()),
          requestedPhone: phone,
          hasData: pendingRegistrations.has(phone),
        },
      });
    }

    // Create and save the branch
    const newBranch = new Branch({
      ...registrationData,
      deliveryPartners: [],
      storeStatus: "closed",
      status: "pending",
      createdAt: new Date(),
    });

    const savedBranch = await newBranch.save();

    // Generate access token
    const accessToken = jwt.sign(
      { branchId: savedBranch._id, phone: savedBranch.phone, role: "Branch" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Clean up pending registration
    pendingRegistrations.delete(phone);

    // Emit event
    const branchData = {
      branchId: savedBranch._id,
      phone: savedBranch.phone,
      status: savedBranch.status,
    };
    io.to(`syncmart_${phone}`).emit("branchRegistered", branchData);

    logger.info({
      msg: "Branch registration completed successfully",
      branchId: savedBranch._id,
    });

    return reply.status(201).send({
      message: "Branch registered successfully",
      branch: savedBranch,
      accessToken,
    });
  } catch (error) {
    logger.error({
      msg: "Error completing branch registration",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      error: "Failed to complete registration",
      details: error.message,
    });
  }
};
