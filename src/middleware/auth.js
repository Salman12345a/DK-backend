import jwt from "jsonwebtoken";

export const verifyToken = async (req, reply) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      console.error("Missing Authorization Header");
      return reply.code(401).send({
        status: "ERROR",
        message: "Access token required",
        code: "TOKEN_REQUIRED",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.error("Invalid Authorization Header Format");
      return reply.code(401).send({
        status: "ERROR",
        message: "Invalid token format",
        code: "INVALID_TOKEN_FORMAT",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = decoded;

    if (!req.user.role || (!req.user.userId && !req.user.branchId)) {
      console.error("Token missing required fields:", decoded);
      return reply.code(403).send({
        status: "ERROR",
        message: "Token payload missing userId or branchId or role",
        code: "INVALID_TOKEN_PAYLOAD",
      });
    }

    return true;
  } catch (err) {
    console.error("Token Verification Error:", err);

    if (err.name === "TokenExpiredError") {
      return reply.code(401).send({
        status: "ERROR",
        message: "Token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return reply.code(403).send({
      status: "ERROR",
      message: "Invalid token",
      code: "INVALID_TOKEN",
      systemError: err.message,
    });
  }
};

export const checkBranchRole = async (req, reply) => {
  if (req.user.role !== "Branch") {
    return reply.code(403).send({
      status: "ERROR",
      message: "Unauthorized: Branch access required",
      code: "UNAUTHORIZED_ROLE",
    });
  }
  return true;
};
