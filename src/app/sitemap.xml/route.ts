// app/sitemap.xml/route.ts
import { getFirebaseServers } from '@/lib/firebase-data';
import type { Server } from '@/lib/types';
import type { NextRequest } from 'next/server';

async function generateSitemap(siteUrl: string) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static pages
  const staticPages = [
    '/',
    '/servers/submit',
    '/ai-features',
    '/login',
    '/register',
    '/dashboard',
    '/profile/settings',
  ];

  staticPages.forEach(page => {
    xml += `
  <url>
    <loc>${siteUrl}${page}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`;
  });

  // Dynamic server pages
  try {
    const approvedServers: Server[] = await getFirebaseServers('all', 'votes', '', 'approved');
    approvedServers.forEach(server => {
      // Ensure submittedAt is a string (ISO date) before creating a Date object from it
      const lastModDate = server.submittedAt ? new Date(server.submittedAt) : new Date();
      const lastMod = lastModDate.toISOString().split('T')[0];
      
      xml += `
  <url>
    <loc>${siteUrl}/servers/${server.id}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    });
  } catch (error) {
    console.error("Error fetching servers for sitemap:", error);
  }
  

  xml += `</urlset>`;
  return xml;
}

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const sitemap = await generateSitemap(siteUrl);

  return new Response(sitemap, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
