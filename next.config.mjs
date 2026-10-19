/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
};

export default nextConfig;
