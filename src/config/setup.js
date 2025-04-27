import AdminJS from "adminjs";
import * as AdminJSMongoose from "@adminjs/mongoose";
import * as Models from "../models/index.js";
import AdminJSFastify from "@adminjs/fastify";
import { authenticate, COOKIE_PASSWORD, sessionStore } from "./config.js";
import { dark, light, noSidebar } from "@adminjs/themes";
import componentLoader from "./components.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

AdminJS.registerAdapter(AdminJSMongoose);

// Configure AdminJS
export const admin = new AdminJS({
  resources: [
    {
      resource: Models.Customer,
      options: {
        listProperties: ["phone", "role", "isActivated"],
        filterProperties: ["phone", "role"],
      },
    },
    {
      resource: Models.DeliveryPartner,
      options: {
        listProperties: [
          "phone",
          "role",
          "isActivated",
          "name",
          "age",
          "gender",
          "licenseNumber",
          "rcNumber",
          "status",
        ],
        filterProperties: ["phone", "role", "status"],
        properties: {
          documents: { isVisible: { list: true, show: true, edit: false } },
          status: { isVisible: { list: true, show: true, edit: true } },
          rejectionMessage: {
            type: "string",
            isVisible: { list: false, show: true, edit: false },
          },
        },
        actions: {
          list: {
            before: async (request) => {
              const validFields = ["phone", "role", "status"];
              const sanitizedFilters = {};
              if (request.query.filters) {
                Object.keys(request.query.filters).forEach((key) => {
                  if (validFields.includes(key)) {
                    sanitizedFilters[key] = request.query.filters[key];
                  }
                });
              }
              request.query.filters = sanitizedFilters;
              return request;
            },
          },
          approveDocuments: {
            actionType: "record",
            icon: "Check",
            buttonLabel: "Approve",
            isVisible: (record) => record?.params?.status === "pending",
            handler: async (request, response, context) => {
              const { record } = context;
              await record.update({ status: "approved", isActivated: true });
              return {
                record: record.toJSON(),
                notice: {
                  message: "Delivery Partner approved successfully",
                  type: "success",
                },
              };
            },
          },
          rejectDocuments: {
            actionType: "record",
            icon: "X",
            buttonLabel: "Reject",
            isVisible: (record) => record?.params?.status === "pending",
            handler: async (request, response, context) => {
              const { record, app } = context;
              const { rejectionMessage } = request.payload || {};

              if (!rejectionMessage) {
                return {
                  record: record.toJSON(),
                  notice: {
                    message: "Rejection message is required",
                    type: "error",
                  },
                };
              }

              await record.update({
                status: "rejected",
                isActivated: false,
                rejectionMessage,
              });

              const branchId = record.params.branch;
              const io = app.io;
              io.to(`branch_${branchId}`).emit("deliveryPartnerRejected", {
                deliveryPartnerId: record.params._id,
                message: rejectionMessage,
              });

              return {
                record: record.toJSON(),
                notice: {
                  message:
                    "Delivery Partner rejected, check Whatsapp for Reason",
                  type: "success",
                },
              };
            },
          },
        },
      },
    },
    {
      resource: Models.Admin,
      options: {
        listProperties: ["email", "role", "isActivated"],
        filterProperties: ["email", "role"],
      },
    },
    { resource: Models.Branch },
    { resource: Models.Product },
    {
      resource: Models.Category,
      options: {
        listProperties: ["name", "isActive", "createdAt"],
        filterProperties: ["name", "isActive", "createdAt"],
        editProperties: ["name", "isActive", "imageUrl"],
        showProperties: [
          "name",
          "imageUrl",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          name: {
            isTitle: true,
            isRequired: true,
            validation: {
              required: true,
            },
            custom: {
              minLength: 2,
            },
            props: {
              placeholder: "Enter name",
            },
          },
          imageUrl: {
            isVisible: { list: true, filter: false, show: true, edit: true },
            type: "string",
            isTitle: false,
            description:
              "Enter the full URL to the image (e.g., https://your-bucket.s3.amazonaws.com/image.jpg)",
            props: {
              placeholder: "https://your-bucket.s3.amazonaws.com/image.jpg",
            },
            custom: {
              renderImage: true,
            },
          },
          isActive: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            type: "boolean",
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: false, filter: false, show: true, edit: false },
          },
        },
        actions: {
          new: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
          edit: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
        },
      },
    },
    {
      resource: Models.Order,
      options: {
        actions: {
          getOrderDetails: {
            actionType: "resource",
            handler: async (request, response, context) => {
              const { orderId } = request.params;
              const order = await context.resource.findOne(orderId);

              if (!order) {
                return {
                  notice: {
                    message: "Order not found",
                    type: "error",
                  },
                };
              }

              return {
                data: order.toJSON(),
              };
            },
          },
        },
      },
    },
    { resource: Models.Counter },

    // New default template resources for DoKirana inventory system
    {
      resource: Models.DefaultCategory,
      options: {
        navigation: {
          name: "Inventory Templates",
          icon: "Category",
        },
        listProperties: ["name", "isActive", "createdAt"],
        filterProperties: ["name", "isActive", "createdAt"],
        editProperties: ["name", "isActive", "imageUrl"],
        showProperties: [
          "name",
          "imageUrl",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          name: {
            isTitle: true,
            isRequired: true,
            validation: {
              required: true,
            },
            custom: {
              minLength: 2,
            },
            props: {
              placeholder: "Enter name",
            },
          },
          imageUrl: {
            isVisible: { list: true, filter: false, show: true, edit: true },
            type: "string",
            isTitle: false,
            description:
              "Enter the full URL to the image (e.g., https://your-bucket.s3.amazonaws.com/image.jpg)",
            props: {
              placeholder: "https://your-bucket.s3.amazonaws.com/image.jpg",
            },
            custom: {
              renderImage: true,
            },
          },
          isActive: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            type: "boolean",
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: false, filter: false, show: true, edit: false },
          },
        },
        actions: {
          new: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
          edit: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
        },
      },
    },
    {
      resource: Models.DefaultProduct,
      options: {
        navigation: {
          name: "Inventory Templates",
          icon: "Product",
        },
        listProperties: ["name", "suggestedPrice", "unit", "isActive"],
        filterProperties: ["name", "defaultCategory", "unit", "isActive"],
        editProperties: [
          "name",
          "suggestedPrice",
          "unit",
          "defaultCategory",
          "isPacket",
          "description",
          "isActive",
          "imageUrl",
        ],
        showProperties: [
          "name",
          "suggestedPrice",
          "unit",
          "defaultCategory",
          "imageUrl",
          "isPacket",
          "description",
          "isActive",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          _id: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          name: {
            isTitle: true,
            isRequired: true,
            validation: {
              required: true,
            },
            custom: {
              minLength: 2,
            },
            props: {
              placeholder: "Enter name",
            },
          },
          suggestedPrice: {
            type: "number",
            isRequired: true,
            validation: {
              required: true,
              min: 0,
            },
            props: {
              placeholder: "Enter price",
            },
          },
          unit: {
            isRequired: true,
            validation: {
              required: true,
            },
            availableValues: [
              { value: "kg", label: "Kilogram (kg)" },
              { value: "g", label: "Gram (g)" },
              { value: "liter", label: "Liter (l)" },
              { value: "ml", label: "Milliliter (ml)" },
              { value: "pack", label: "Pack" },
              { value: "piece", label: "Piece" },
            ],
          },
          defaultCategory: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            reference: "DefaultCategory",
            isRequired: true,
          },
          imageUrl: {
            isVisible: { list: true, filter: false, show: true, edit: true },
            type: "string",
            isTitle: false,
            description:
              "Enter the full URL to the image (e.g., https://your-bucket.s3.amazonaws.com/image.jpg)",
            props: {
              placeholder: "https://your-bucket.s3.amazonaws.com/image.jpg",
            },
            custom: {
              renderImage: true,
            },
          },
          isPacket: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            type: "boolean",
          },
          description: {
            type: "textarea",
            isRequired: false,
          },
          isActive: {
            isVisible: { list: true, filter: true, show: true, edit: true },
            type: "boolean",
          },
          createdAt: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          updatedAt: {
            isVisible: { list: false, filter: false, show: true, edit: false },
          },
        },
        actions: {
          new: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
          edit: {
            before: async (request) => {
              if (request.payload.name) {
                request.payload = {
                  ...request.payload,
                  name: request.payload.name.trim(),
                };
              }
              return request;
            },
          },
        },
      },
    },
  ],
  branding: {
    companyName: "DoKirana",
    withMadeWithLove: false,
    favicon:
      "https://storesync-bucket.s3.eu-north-1.amazonaws.com/uploads/Do+Kirana.png",
    logo: "https://storesync-bucket.s3.eu-north-1.amazonaws.com/uploads/Do+Kirana.png",
  },
  componentLoader,
  defaultTheme: dark.id,
  rootPath: "/admin",
  availableThemes: [dark, light, noSidebar],
});

export const buildAdminRouter = async (app) => {
  await AdminJSFastify.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: COOKIE_PASSWORD,
      cookieName: "adminjs",
    },
    app,
    {
      store: sessionStore,
      saveUnintialized: true,
      secret: COOKIE_PASSWORD,
      cookie: {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
};
