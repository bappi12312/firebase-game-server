
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
      // Add Facebook CDN hostname
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
