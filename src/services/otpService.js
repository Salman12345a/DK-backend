import admin from "../config/firebase.js";

class OTPService {
  static async generateOTP(phoneNumber) {
    try {
      // Format phone number
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.replace(/\s/g, "")
        : `+91${phoneNumber.replace(/\s/g, "")}`;

      // For client-side Firebase auth, we just need to return success
      // The actual OTP sending will be handled by Firebase on the client
      return {
        success: true,
        message: "Ready for Firebase client authentication",
      };
    } catch (error) {
      console.error("Error in generateOTP:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async verifyOTP(phoneNumber, code) {
    try {
      // Format phone number
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.replace(/\s/g, "")
        : `+91${phoneNumber.replace(/\s/g, "")}`;

      // For client-side Firebase auth, verification is handled by the client
      // We just need to return success to allow the process to continue
      return {
        success: true,
        message: "Ready for Firebase client verification",
      };
    } catch (error) {
      console.error("Error in verifyOTP:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async verifyPhoneToken(token) {
    try {
      // Verify the Firebase token using admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);
      const phoneNumber = decodedToken.phone_number;

      if (!phoneNumber) {
        throw new Error("Phone number not found in token");
      }

      return {
        success: true,
        phoneNumber,
        message: "Phone number verified successfully",
      };
    } catch (error) {
      console.error("Error verifying phone token:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static formatPhoneNumber(phoneNumber) {
    // Format phone number to E.164 format
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    return cleanNumber.startsWith("91")
      ? `+${cleanNumber}`
      : `+91${cleanNumber}`;
  }
}

export default OTPService;
