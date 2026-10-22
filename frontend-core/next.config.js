/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_LIVEKIT_URL:
      process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '',
  },
  images: { unoptimized: true },
  experimental: {
    cpus: 1,
  },
  webpack: (config) => {
    config.parallelism = 1;
    return config;
  },
};

module.exports = nextConfig;
