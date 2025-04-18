import {
  loginCustomer,
  loginDeliveryPartner,
  refreshToken,
  fetchUser,
  loginBranch,
} from "../controllers/auth/auth.js";
import { sendOTP, verifyOTP } from "../controllers/auth/otpController.js";
import { updateUser } from "../controllers/tracking/user.js";
import { verifyToken } from "../middleware/auth.js";

export const authRoutes = async (fastify, options) => {
  // Branch OTP verification routes
  fastify.post("/branch/send-otp", sendOTP);
  fastify.post("/branch/verify-otp", verifyOTP);

  // Existing routes
  fastify.post("/customer/login", loginCustomer);
  fastify.post("/branch/login", loginBranch);
  fastify.post("/delivery/login", loginDeliveryPartner);
  fastify.post("/refresh-token", refreshToken);
  fastify.get("/user", { preHandler: [verifyToken] }, fetchUser);
  fastify.patch("/update", { preHandler: [verifyToken] }, updateUser);
};
