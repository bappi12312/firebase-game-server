
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
      // Keep specific necessary hostnames like Firebase Storage
      {
        protocol: 'https', // For Firebase Storage
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      // Add Cloudinary hostname
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**', 
      },
      // Add Facebook CDN hostname (if still needed for user profile images etc)
      {
        protocol: 'https',
        hostname: 'scontent.fdac14-1.fna.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      // Avoid overly broad patterns like http://** or https://**
    ],
  },
};

export default nextConfig;
