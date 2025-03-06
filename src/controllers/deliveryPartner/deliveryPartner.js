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

    const deliveryPartner = new DeliveryPartner({
      name,
      age: parseInt(age),
      gender,
      licenseNumber,
      rcNumber,
      email,
      password,
      phone,
      licenseImage: licenseImageUrl,
      rcImage: rcImageUrl,
      pancard: pancardImageUrl,
      status: "pending",
    });

    await deliveryPartner.save();

    return reply.status(201).send({
      message: "Delivery partner registered",
      id: deliveryPartner._id,
    });
  } catch (error) {
    console.error("Error in registerDeliveryPartner:", error);
    return reply.status(500).send({ message: "Internal server error" });
  }
};
