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
    const { licenseImage, rcImage, pancard } = request.files || {};
    const branchId = request.user.userId;

    if (
      !name ||
      !age ||
      !gender ||
      !licenseNumber ||
      !rcNumber ||
      !email ||
      !password ||
      !phone ||
      !licenseImage ||
      !rcImage ||
      !pancard
    ) {
      return reply
        .code(400)
        .send({ message: "All fields and documents are required" });
    }

    const licenseUrl = await uploadToS3(
      licenseImage[0],
      `delivery-partners/license-${licenseNumber}`
    );
    const rcUrl = await uploadToS3(
      rcImage[0],
      `delivery-partners/rc-${rcNumber}`
    );
    const pancardUrl = await uploadToS3(
      pancard[0],
      `delivery-partners/pancard-${email}`
    );

    const documents = [
      { type: "license", url: licenseUrl },
      { type: "rc", url: rcUrl },
      { type: "pancard", url: pancardUrl },
    ];
    const deliveryPartner = new DeliveryPartner({
      name,
      age,
      gender,
      licenseNumber,
      rcNumber,
      email,
      password,
      phone,
      branch: branchId,
      documents,
      status: "pending",
    });
    await deliveryPartner.save();

    await Branch.findByIdAndUpdate(branchId, {
      $push: { deliveryPartners: deliveryPartner._id },
    });

    reply
      .code(201)
      .send({
        message: "Delivery partner registered",
        id: deliveryPartner._id,
      });
  } catch (error) {
    console.error("Error in registerDeliveryPartner:", error);
    reply
      .code(500)
      .send({ message: "Registration failed", error: error.message });
  }
};
