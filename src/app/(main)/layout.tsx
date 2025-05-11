
'use client';

import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from 'react';

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
      <main className="flex-grow container mx-auto px-4 py-6 md:py-8">
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>
            &copy; {currentYear !== null ? currentYear : ''} ServerSpotlight. All rights reserved.
          </p>
          {/* Add more footer links if needed, e.g., Privacy Policy, Terms of Service */}
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
