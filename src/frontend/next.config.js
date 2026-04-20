/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'dist',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://lanista-backend.onrender.com',
  },
}

module.exports = nextConfig
