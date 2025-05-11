
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.fdac14-1.fna.fbcdn.net', // Added for Facebook content
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http', // Allow http for potentially unoptimized images
        hostname: '**', // Allow all hostnames (use with caution, or specify known ones)
      },
      {
        protocol: 'https', // Allow https for potentially unoptimized images
        hostname: '**', // Allow all hostnames (use with caution, or specify known ones)
      }
    ],
  },
};

export default nextConfig;
