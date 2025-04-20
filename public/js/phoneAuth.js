import { auth, RecaptchaVerifier } from "../../src/config/firebaseClient.js";
import { signInWithPhoneNumber } from "firebase/auth";

class PhoneAuthService {
  constructor() {
    this.confirmationResult = null;
    this.recaptchaVerifier = null;
  }

  async initRecaptcha(buttonId) {
    try {
      // Initialize reCAPTCHA verifier
      this.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA solved");
        },
      });

      // Render the reCAPTCHA widget
      await this.recaptchaVerifier.render();
      return true;
    } catch (error) {
      console.error("Error initializing reCAPTCHA:", error);
      throw error;
    }
  }

  async sendOTP(phoneNumber) {
    try {
      // First make the backend call to prepare for OTP
      const response = await fetch("/api/auth/branch/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to prepare OTP");
      }

      // Now trigger the actual SMS sending through Firebase
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        this.recaptchaVerifier
      );

      return {
        success: true,
        message: "OTP sent successfully",
      };
    } catch (error) {
      console.error("Error sending OTP:", error);
      // Clear the reCAPTCHA if there's an error
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
      throw error;
    }
  }

  async verifyOTP(phoneNumber, code) {
    try {
      if (!this.confirmationResult) {
        throw new Error("Please send OTP first");
      }

      // Verify the OTP with Firebase
      const userCredential = await this.confirmationResult.confirm(code);
      const idToken = await userCredential.user.getIdToken();

      // Now verify with our backend
      const response = await fetch("/api/auth/branch/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          code,
          token: idToken,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to verify OTP");
      }

      return {
        success: true,
        message: "Phone number verified successfully",
        token: idToken,
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    }
  }
}

export const phoneAuthService = new PhoneAuthService();
