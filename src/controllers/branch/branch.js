import Branch from "../../models/branch.js";

// Controller to find nearby branches based on lat, lng, and radius
export const getNearbyBranches = async (request, reply) => {
  try {
    // Extract query parameters: lat, lng, and radius (default to 2 km if not provided)
    const { lat, lng, radius = 2 } = request.query;

    // Validate required parameters
    if (!lat || !lng) {
      return reply
        .status(400)
        .send({ error: "Missing lat or lng query parameters" });
    }

    // Parse query parameters to numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInKm = parseFloat(radius);

    // Validate parsed values
    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
      return reply
        .status(400)
        .send({ error: "Invalid lat, lng, or radius values" });
    }

    // Find branches within the specified radius using $geoWithin
    const branches = await Branch.find({
      location: {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radiusInKm / 6378.1], // Convert km to radians (Earth's radius: 6378.1 km)
        },
      },
    }).lean();

    // Return the list of nearby branches
    return reply.status(200).send({ branches });
  } catch (error) {
    // Handle any errors (e.g., database errors)
    return reply.status(500).send({ error: error.message });
  }
};
