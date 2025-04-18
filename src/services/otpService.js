import admin from "../config/firebase.js";

class OTPService {
  static async generateOTP(phoneNumber) {
    try {
      // Remove any spaces and add country code if not present
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.replace(/\s/g, "")
        : `+91${phoneNumber.replace(/\s/g, "")}`;

      // Generate a verification code
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000
      ).toString();

      // Store OTP data in auth custom claims
      const uid = `phone:${formattedPhone}`;

      try {
        // Try to get existing user or create new one
        let userRecord;
        try {
          userRecord = await admin.auth().getUser(uid);
        } catch (error) {
          if (error.code === "auth/user-not-found") {
            userRecord = await admin.auth().createUser({
              uid: uid,
              phoneNumber: formattedPhone,
            });
          } else {
            throw error;
          }
        }

        // Set custom claims with OTP data
        await admin.auth().setCustomUserClaims(uid, {
          verificationCode,
          createdAt: Date.now(),
          phone: formattedPhone,
        });

        // Create a custom token
        const customToken = await admin.auth().createCustomToken(uid);
        console.log("Generated custom token successfully for:", uid);

        return {
          success: true,
          token: customToken,
          verificationCode, // In production, this should be sent via SMS and not returned
        };
      } catch (error) {
        console.error("Error in user management:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error generating OTP:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async verifyOTP(phoneNumber, code, token) {
    try {
      console.log("Starting OTP verification for phone:", phoneNumber);

      // Format phone number consistently
      const formattedPhone = phoneNumber.startsWith("+")
        ? phoneNumber.replace(/\s/g, "")
        : `+91${phoneNumber.replace(/\s/g, "")}`;

      const uid = `phone:${formattedPhone}`;

      try {
        // Get user record and custom claims
        const userRecord = await admin.auth().getUser(uid);
        const customClaims = userRecord.customClaims || {};

        console.log(
          "Retrieved user claims:",
          JSON.stringify(customClaims, null, 2)
        );

        // Verify the OTP
        if (!customClaims.verificationCode || !customClaims.createdAt) {
          throw new Error("No valid OTP found");
        }

        // Check expiration (5 minutes)
        const now = Date.now();
        if (now - customClaims.createdAt > 5 * 60 * 1000) {
          throw new Error("OTP has expired");
        }

        // Verify the code
        if (customClaims.verificationCode !== code) {
          throw new Error("Invalid OTP");
        }

        // Clear the OTP data after successful verification
        await admin.auth().setCustomUserClaims(uid, {
          verificationCode: null,
          createdAt: null,
          verified: true,
        });

        return {
          success: true,
          message: "OTP verified successfully",
        };
      } catch (error) {
        console.error("Error in verification:", error);
        if (error.code === "auth/user-not-found") {
          throw new Error("Invalid phone number or OTP expired");
        }
        throw error;
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default OTPService;
