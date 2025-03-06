import { DeliveryPartner } from "../../models/user.js";
import Branch from "../../models/branch.js";
import { uploadToS3 } from "../../utils/s3Upload.js";

export const registerDeliveryPartner = async (request, reply) => {
  try {
    const {
      name,
      age,
      gender,
      licenseNumber,
      rcNumber,
      email,
      password,
      phone,
    } = request.body;
    const files = request.files;

    // Upload files to S3 and get URLs
    const licenseImageUrl = await uploadToS3(
      files.licenseImage.buffer,
      `delivery-partners/license-${licenseNumber}.${
        files.licenseImage.mimetype.split("/")[1]
      }`
    );
    const rcImageUrl = await uploadToS3(
      files.rcImage.buffer,
      `delivery-partners/rc-${rcNumber}.${files.rcImage.mimetype.split("/")[1]}`
    );
    const pancardImageUrl = await uploadToS3(
      files.pancard.buffer,
      `delivery-partners/pancard-${email}.${
        files.pancard.mimetype.split("/")[1]
      }`
    );

    // Create new DeliveryPartner document
    const deliveryPartner = new DeliveryPartner({
      name,
      age: parseInt(age),
      gender,
      licenseNumber,
      rcNumber,
      email,
      password,
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
    // Uncomment if you want to maintain the two-way relationship
    /*
    await Branch.findByIdAndUpdate(
      request.user.userId,
      { $push: { deliveryPartners: deliveryPartner._id } },
      { new: true }
    );
    */

    // Send success response
    return reply.status(201).send({
      message: "Delivery partner registered",
      id: deliveryPartner._id,
    });
  } catch (error) {
    console.error("Error in registerDeliveryPartner:", error);
    return reply.status(500).send({ message: "Internal server error" });
  }
};
