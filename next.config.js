/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Removed 'output: export' to support NextAuth.js middleware and API routes
  trailingSlash: false, // Changed to false for better compatibility with NextAuth
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;