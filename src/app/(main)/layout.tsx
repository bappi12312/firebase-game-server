
'use client';

import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Determine if back button should be shown
  // Example: Don't show on home page
  const showBackButton = pathname !== '/';


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6 md:py-8">
        {showBackButton && (
           <Button 
             variant="outline" 
             size="sm" 
             onClick={() => router.back()} 
             className="mb-4"
           >
             <ArrowLeft className="mr-2 h-4 w-4" /> Back
           </Button>
        )}
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center text-sm">
        <div className="container mx-auto px-4">
          <p suppressHydrationWarning>
            &copy; {currentYear !== null ? currentYear : new Date().getFullYear()} ServerSpotlight. All rights reserved.
          </p>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
