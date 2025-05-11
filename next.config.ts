
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
        hostname: 'scontent.fdac14-1.fna.fbcdn.net', 
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https', // For Firebase Storage
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http', 
        hostname: '**', 
      },
      {
        protocol: 'https', 
        hostname: '**', 
      }
    ],
  },
};

export default nextConfig;
