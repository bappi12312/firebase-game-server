
'use client';
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import Link from "next/link";
import { Gamepad2, ArrowLeft } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';


// export const metadata: Metadata = { // Moved to individual pages or not used for client layouts
//   title: 'Authentication - ServerSpotlight', 
//   description: 'Login or Register for ServerSpotlight.',
// };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // No back button on /login or /register base paths typically
  const showBackButton = !['/login', '/register'].includes(pathname);


  return (
    <div className={`flex flex-col min-h-screen ${GeistSans.variable} font-sans`}>
       <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold">
            <Gamepad2 className="h-7 w-7 md:h-8 md:w-8 text-accent" />
            <span>ServerSpotlight</span>
          </Link>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col justify-center items-center">
        {showBackButton && (
           <Button 
             variant="outline" 
             size="sm" 
             onClick={() => router.back()} 
             className="mb-4 self-start" // Align to start if needed
           >
             <ArrowLeft className="mr-2 h-4 w-4" /> Back
           </Button>
        )}
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} ServerSpotlight. All rights reserved.</p>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}
