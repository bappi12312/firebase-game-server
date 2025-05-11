'use client';

import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from 'react';

// Metadata should be exported from page.tsx or a server component layout if this layout needs to be 'use client'.
// For now, assuming static metadata or it's handled at page level if this layout remains client-side.

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center">
        <p>
          &copy; {currentYear !== null ? currentYear : ''} ServerSpotlight. All rights reserved.
        </p>
      </footer>
      <Toaster />
    </div>
  );
}
