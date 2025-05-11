// app/robots.txt/route.ts
import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  
  const content = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
