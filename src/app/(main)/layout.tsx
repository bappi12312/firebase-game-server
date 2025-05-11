import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'ServerSpotlight - Find Your Next Game Server',
  description: 'Discover and vote for the best game servers across multiple games.',
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-secondary text-secondary-foreground py-6 text-center">
        <p>&copy; {new Date().getFullYear()} ServerSpotlight. All rights reserved.</p>
      </footer>
      <Toaster />
    </div>
  );
}
