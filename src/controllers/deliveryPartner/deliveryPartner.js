import { DeliveryPartner } from "../../models/user.js";
import Branch from "../../models/branch.js";
import { uploadToS3 } from "../../utils/s3Upload.js";

export const registerDeliveryPartner = async (request, reply) => {
  const logger = request.log;

  try {
    const { name, age, gender, licenseNumber, rcNumber, phone } = request.body;
    const files = request.files;

    if (!phone) {
      logger.warn({ msg: "Phone number is required for registration" });
      return reply.status(400).send({ message: "Phone number is required" });
    }

    const licenseImageUrl = await uploadToS3(
      files.licenseImage.buffer,
      `delivery-partners/license-${licenseNumber}.${
        files.licenseImage.mimetype.split("/")[1]
      }`,
      logger,
      files.licenseImage.mimetype
    );
    const rcImageUrl = await uploadToS3(
      files.rcImage.buffer,
      `delivery-partners/rc-${rcNumber}.${
        files.rcImage.mimetype.split("/")[1]
      }`,
      logger,
      files.rcImage.mimetype
    );
    const deliveryPartnerPhotoUrl = await uploadToS3(
      files.deliveryPartnerPhoto.buffer,
      `delivery-partners/photo-${phone}.${
        files.deliveryPartnerPhoto.mimetype.split("/")[1]
      }`,
      logger,
      files.deliveryPartnerPhoto.mimetype
    );
    const aadhaarFrontUrl = await uploadToS3(
      files.aadhaarFront.buffer,
      `delivery-partners/aadhaar-front-${phone}.${
        files.aadhaarFront.mimetype.split("/")[1]
      }`,
      logger,
      files.aadhaarFront.mimetype
    );
    const aadhaarBackUrl = await uploadToS3(
      files.aadhaarBack.buffer,
      `delivery-partners/aadhaar-back-${phone}.${
        files.aadhaarBack.mimetype.split("/")[1]
      }`,
      logger,
      files.aadhaarBack.mimetype
    );

    const deliveryPartner = new DeliveryPartner({
      name,
      age: parseInt(age),
      gender,
      licenseNumber,
      rcNumber,
      phone,
      branch: request.user.userId,
      documents: [
        { type: "license", url: licenseImageUrl },
        { type: "rc", url: rcImageUrl },
        { type: "photo", url: deliveryPartnerPhotoUrl },
        { type: "aadhaarFront", url: aadhaarFrontUrl },
        { type: "aadhaarBack", url: aadhaarBackUrl },
      ],
      status: "pending",
      availability: true,
    });

    await deliveryPartner.save();

    const updatedBranch = await Branch.findByIdAndUpdate(
      request.user.userId,
      { $push: { deliveryPartners: deliveryPartner._id } },
      { new: true }
    );

    if (!updatedBranch) {
      logger.warn({
        msg: "Branch not found for updating deliveryPartners",
        branchId: request.user.userId,
      });
      await DeliveryPartner.findByIdAndDelete(deliveryPartner._id);
      return reply.status(400).send({ message: "Branch not found" });
    }

    logger.info({
      msg: "Delivery partner registered successfully",
      id: deliveryPartner._id,
      phone,
      branchId: request.user.userId,
    });

    return reply.status(201).send({
      message: "Delivery partner registered",
      id: deliveryPartner._id,
    });
  } catch (error) {
    logger.error({
      msg: "Error in registerDeliveryPartner",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      message: "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export const modifyDeliveryPartnerDetails = async (request, reply) => {
  const logger = request.log;

  try {
    const { id } = request.params;
    const { name, age, gender, licenseNumber, rcNumber, phone } = request.body;
    const files = request.files || {};

    const deliveryPartner = await DeliveryPartner.findById(id);
    if (!deliveryPartner) {
      logger.warn({ msg: "Delivery partner not found", id });
      return reply.status(404).send({ message: "Delivery partner not found" });
    }

    if (deliveryPartner.branch.toString() !== request.user.userId) {
      logger.warn({
        msg: "Unauthorized: Branch does not own this delivery partner",
        branchId: request.user.userId,
        deliveryPartnerId: id,
      });
      return reply.status(403).send({
        message:
          "Unauthorized: You can only modify delivery partners assigned to your branch",
      });
    }

    if (deliveryPartner.status !== "rejected") {
      logger.warn({
        msg: "Modification not allowed: Status is not rejected",
        status: deliveryPartner.status,
        id,
      });
      return reply.status(400).send({
        message: "Modification only allowed after admin rejection",
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (age) updates.age = parseInt(age);
    if (gender) updates.gender = gender;
    if (licenseNumber) updates.licenseNumber = licenseNumber;
    if (rcNumber) updates.rcNumber = rcNumber;
    if (phone) updates.phone = phone;

    const updatedDocuments = [...deliveryPartner.documents];
    const hasAnyFile =
      files.licenseImage ||
      files.rcImage ||
      files.deliveryPartnerPhoto ||
      files.aadhaarFront ||
      files.aadhaarBack;
    if (hasAnyFile) {
      const requiredFiles = [
        "licenseImage",
        "rcImage",
        "deliveryPartnerPhoto",
        "aadhaarFront",
        "aadhaarBack",
      ];
      const missingFiles = requiredFiles.filter((file) => !files[file]);
      if (missingFiles.length > 0) {
        logger.warn({
          msg: "Missing required files during modification",
          missingFiles,
          id,
        });
        return reply.status(400).send({
          message: "All required files must be uploaded",
        });
      }
    }

    if (hasAnyFile) {
      if (files.licenseImage) {
        const licenseImageUrl = await uploadToS3(
          files.licenseImage.buffer,
          `delivery-partners/license-${
            licenseNumber || deliveryPartner.licenseNumber
          }.${files.licenseImage.mimetype.split("/")[1]}`,
          logger,
          files.licenseImage.mimetype
        );
        const index = updatedDocuments.findIndex(
          (doc) => doc.type === "license"
        );
        if (index !== -1) updatedDocuments[index].url = licenseImageUrl;
        else updatedDocuments.push({ type: "license", url: licenseImageUrl });
      }

      if (files.rcImage) {
        const rcImageUrl = await uploadToS3(
          files.rcImage.buffer,
          `delivery-partners/rc-${rcNumber || deliveryPartner.rcNumber}.${
            files.rcImage.mimetype.split("/")[1]
          }`,
          logger,
          files.rcImage.mimetype
        );
        const index = updatedDocuments.findIndex((doc) => doc.type === "rc");
        if (index !== -1) updatedDocuments[index].url = rcImageUrl;
        else updatedDocuments.push({ type: "rc", url: rcImageUrl });
      }

      if (files.deliveryPartnerPhoto) {
        const deliveryPartnerPhotoUrl = await uploadToS3(
          files.deliveryPartnerPhoto.buffer,
          `delivery-partners/photo-${phone || deliveryPartner.phone}.${
            files.deliveryPartnerPhoto.mimetype.split("/")[1]
          }`,
          logger,
          files.deliveryPartnerPhoto.mimetype
        );
        const index = updatedDocuments.findIndex((doc) => doc.type === "photo");
        if (index !== -1) updatedDocuments[index].url = deliveryPartnerPhotoUrl;
        else
          updatedDocuments.push({
            type: "photo",
            url: deliveryPartnerPhotoUrl,
          });
      }

      if (files.aadhaarFront) {
        const aadhaarFrontUrl = await uploadToS3(
          files.aadhaarFront.buffer,
          `delivery-partners/aadhaar-front-${phone || deliveryPartner.phone}.${
            files.aadhaarFront.mimetype.split("/")[1]
          }`,
          logger,
          files.aadhaarFront.mimetype
        );
        const index = updatedDocuments.findIndex(
          (doc) => doc.type === "aadhaarFront"
        );
        if (index !== -1) updatedDocuments[index].url = aadhaarFrontUrl;
        else
          updatedDocuments.push({ type: "aadhaarFront", url: aadhaarFrontUrl });
      }

      if (files.aadhaarBack) {
        const aadhaarBackUrl = await uploadToS3(
          files.aadhaarBack.buffer,
          `delivery-partners/aadhaar-back-${phone || deliveryPartner.phone}.${
            files.aadhaarBack.mimetype.split("/")[1]
          }`,
          logger,
          files.aadhaarBack.mimetype
        );
        const index = updatedDocuments.findIndex(
          (doc) => doc.type === "aadhaarBack"
        );
        if (index !== -1) updatedDocuments[index].url = aadhaarBackUrl;
        else
          updatedDocuments.push({ type: "aadhaarBack", url: aadhaarBackUrl });
      }
    }

    Object.assign(deliveryPartner, updates);
    if (hasAnyFile) deliveryPartner.documents = updatedDocuments;
    deliveryPartner.status = "pending";
    deliveryPartner.rejectionMessage = null;

    await deliveryPartner.save();

    logger.info({
      msg: "Delivery partner details modified successfully",
      id: deliveryPartner._id,
      branchId: request.user.userId,
    });

    return reply.status(200).send({
      message:
        "Delivery partner details modified successfully, awaiting admin re-approval",
      id: deliveryPartner._id,
    });
  } catch (error) {
    logger.error({
      msg: "Error in modifyDeliveryPartnerDetails",
      error: error.message,
      stack: error.stack,
    });
    return reply.status(500).send({
      message: "Internal server error",
      ...(process.env.NODE_ENV !== "production" && { error: error.message }),
    });
  }
};

export const checkPartnerAvailability = async (request, reply) => {
  const logger = request.log;
  try {
    const { branchId } = request.query;
    if (!branchId) {
      logger.warn({ msg: "Branch ID is required" });
      return reply.status(400).send({ message: "Branch ID is required" });
    }

    const availablePartners = await DeliveryPartner.find({
      branch: branchId,
      availability: true,
    }).lean();

    const isAvailable = availablePartners.length > 0;
    logger.info({
      msg: "Checked delivery partner availability",
      branchId,
      isAvailable,
    });

    return reply.status(200).send({ isAvailable });
  } catch (error) {
    logger.error({
      msg: "Error in checkPartnerAvailability",
      error: error.message,
    });
    return reply.status(500).send({ message: "Internal server error" });
  }
};
