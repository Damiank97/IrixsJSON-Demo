/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Sta grotere JSON imports toe in server components
    largePageDataBytes: 200 * 1024 * 1024,
  },
};

export default nextConfig;
