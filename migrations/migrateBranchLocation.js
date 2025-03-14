import mongoose from "mongoose";
import { connectDB } from "./src/config/connect.js";
import Branch from "./src/models/branch.js";

// Connect to the database
(async () => {
  try {
    await connectDB(process.env.MONGO_URI); // Replace with your MongoDB URI

    // Find all branches
    const branches = await Branch.find({});

    // Update each branch's location field
    for (const branch of branches) {
      if (
        branch.location &&
        branch.location.latitude &&
        branch.location.longitude
      ) {
        branch.location = {
          type: "Point",
          coordinates: [branch.location.longitude, branch.location.latitude],
        };
        await branch.save();
        console.log(`Updated branch ${branch._id}`);
      }
    }

    console.log("Migration completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();
