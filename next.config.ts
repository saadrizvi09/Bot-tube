/** @type {import('next').NextConfig} */
const nextConfig = {
  // eslint configuration has been removed as it's no longer supported in Next.js 16
  // Use .eslintrc or eslint.config.js instead
  
  // Turbopack configuration for Next.js 16
  turbopack: {
    // Empty config to silence warnings - source map issues are not critical
  },
};

module.exports = nextConfig;