export const calculatePlatformCharge = (orderValue) => {
  if (orderValue <= 1000) return 2;
  if (orderValue <= 1999) return 4;
  if (orderValue <= 2999) return 6;
  return 8; // Default for > 2999
};
