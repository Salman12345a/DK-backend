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
    });

    await deliveryPartner.save();

    /*
    await Branch.findByIdAndUpdate(
      request.user.userId,
      { $push: { deliveryPartners: deliveryPartner._id } },
      { new: true }
    );
    */

    logger.info({
      msg: "Delivery partner registered successfully",
      id: deliveryPartner._id,
      phone,
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
