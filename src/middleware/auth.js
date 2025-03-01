import jwt from "jsonwebtoken";

// Verify the access token
export const verifyToken = async (req, reply) => {
  try {
    // Get the authorization header
    const authHeader = req.headers["authorization"];

    // Check if authorization header exists
    if (!authHeader) {
      console.error("Missing Authorization Header");
      return reply.code(401).send({
        status: "ERROR",
        message: "Access token required",
        code: "TOKEN_REQUIRED",
      });
    }

    // Check if authorization header follows Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      console.error("Invalid Authorization Header Format");
      return reply.code(401).send({
        status: "ERROR",
        message: "Invalid token format",
        code: "INVALID_TOKEN_FORMAT",
      });
    }

    // Extract token from the authorization header
    const token = authHeader.split(" ")[1];

    // Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Attach the decoded token's payload to the request object
    // Expecting decoded payload to include { userId, role }
    req.user = decoded;

    // Basic validation of required fields
    if (!req.user.userId || !req.user.role) {
      console.error("Token missing required fields:", decoded);
      return reply.code(403).send({
        status: "ERROR",
        message: "Token payload missing userId or role",
        code: "INVALID_TOKEN_PAYLOAD",
      });
    }

    return true; // Token is valid, proceed
  } catch (err) {
    console.error("Token Verification Error:", err);

    // Handle expired token error
    if (err.name === "TokenExpiredError") {
      return reply.code(401).send({
        status: "ERROR",
        message: "Token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    // Handle any other JWT errors (invalid token, etc.)
    return reply.code(403).send({
      status: "ERROR",
      message: "Invalid token",
      code: "INVALID_TOKEN",
      systemError: err.message,
    });
  }
};

// Optional: Branch role check middleware (if not already elsewhere)
export const checkBranchRole = async (req, reply) => {
  if (req.user.role !== "Branch") {
    return reply.code(403).send({
      status: "ERROR",
      message: "Unauthorized: Branch access required",
      code: "UNAUTHORIZED_ROLE",
    });
  }
  return true; // Proceed if role is Branch
};
