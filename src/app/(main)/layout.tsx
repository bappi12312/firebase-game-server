'use client'; // Required for useState and useEffect

import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from 'react';

// Note: Metadata should ideally be exported from a server component or page.tsx if layout is 'use client'
// This might require restructuring if metadata generation is dynamic and relies on server context.
// For now, assuming static metadata or it's handled at page level.
// export const metadata: Metadata = {
// title: 'ServerSpotlight - Find Your Next Game Server',
// description: 'Discover and vote for the best game servers across multiple games.',
// };

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentYear, setCurrentYear] = useState<string>('');

  useEffect(() => {
    setCurrentYear(new Date().getFullYear().toString());
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center">
        <p>&copy; {currentYear || new Date().getFullYear()} ServerSpotlight. All rights reserved.</p>
      </footer>
      <Toaster />
    </div>
  );
}
