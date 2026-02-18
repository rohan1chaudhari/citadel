import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep Node runtime so we can use node:sqlite + fs.
  // Use separate build output folders so `next build` never corrupts a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next'
};

export default nextConfig;
