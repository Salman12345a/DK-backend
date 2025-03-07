import { DeliveryPartner } from "../../models/user.js";
import Branch from "../../models/branch.js";
import { uploadToS3 } from "../../utils/s3Upload.js";

export const registerDeliveryPartner = async (request, reply) => {
  const logger = request.log; // Use Fastify's logger

  try {
    const { name, age, gender, licenseNumber, rcNumber, phone } = request.body;
    const files = request.files;

    // Validate required fields
    if (!phone) {
      logger.warn({ msg: "Phone number is required for registration" });
      return reply.status(400).send({ message: "Phone number is required" });
    }

    // Upload files to S3 and get URLs
    const licenseImageUrl = await uploadToS3(
      files.licenseImage.buffer,
      `delivery-partners/license-${licenseNumber}.${
        files.licenseImage.mimetype.split("/")[1]
      }`,
      logger
    );
    const rcImageUrl = await uploadToS3(
      files.rcImage.buffer,
      `delivery-partners/rc-${rcNumber}.${
        files.rcImage.mimetype.split("/")[1]
      }`,
      logger
    );
    const pancardImageUrl = await uploadToS3(
      files.pancard.buffer,
      `delivery-partners/pancard-${phone}.${
        files.pancard.mimetype.split("/")[1]
      }`,
      logger
    );

    // Create new DeliveryPartner document
    const deliveryPartner = new DeliveryPartner({
      name,
      age: parseInt(age),
      gender,
      licenseNumber,
      rcNumber,
      phone,
      branch: request.user.userId, // Set branch to authenticated Branch ID
      documents: [
        { type: "license", url: licenseImageUrl },
        { type: "rc", url: rcImageUrl },
        { type: "pancard", url: pancardImageUrl },
      ],
      status: "pending",
    });

    // Save the DeliveryPartner document
    await deliveryPartner.save();

    // Optional: Update the Branch document to include this DeliveryPartner
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
