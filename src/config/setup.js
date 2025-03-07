import AdminJS from "adminjs";
import * as AdminJSMongoose from "@adminjs/mongoose";
import * as Models from "../models/index.js";
import AdminJSFastify from "@adminjs/fastify";
import { authenticate, COOKIE_PASSWORD, sessionStore } from "./config.js";
import { dark, light, noSidebar } from "@adminjs/themes";

AdminJS.registerAdapter(AdminJSMongoose);

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
          "email",
          "role",
          "isActivated",
          "name",
          "age",
          "gender",
          "licenseNumber",
          "rcNumber",
          "status",
        ],
        filterProperties: ["email", "role", "status"],
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
              const validFields = ["email", "role", "status"];
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
    { resource: Models.Category },
    { resource: Models.Order },
    { resource: Models.Counter },
  ],
  branding: {
    companyName: "storesync",
    withMadeWithLove: false,
    favicon:
      "https://moodbanao.net/wp-content/uploads/2024/11/Untitled-design-8-modified.png",
    logo: "https://moodbanao.net/wp-content/uploads/2024/11/Untitled-design-8-modified.png",
  },
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
