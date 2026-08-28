import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  allowedDevOrigins: [
    "169.254.83.107",
    "localhost",
    "127.0.0.1",
    "localhost:3000",
  ],
};

export default nextConfig;
