/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'dist',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
