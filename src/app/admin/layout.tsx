
'use client';

import Link from 'next/link';
import { redirect, usePathname } from 'next/navigation';
import { Home, Users, Server, Settings, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/layout/Header'; // Re-use main header
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from '@/components/ui/skeleton';

const adminNavLinks = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/servers', label: 'Manage Servers', icon: Server },
  { href: '/admin/users', label: 'Manage Users', icon: Users },
  // { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  // { href: '/admin/settings', label: 'Site Settings', icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
       <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-grow container mx-auto px-4 py-8 flex">
            <aside className="w-64 p-4 space-y-2 border-r">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </aside>
            <main className="flex-1 p-6">
                <Skeleton className="h-full w-full" />
            </main>
        </div>
        <Toaster />
      </div>
    );
  }

  if (!user || !isAdmin) {
    // Redirect to home or login if not an admin
    // It's better to handle this with middleware in a real app for server-side protection
    redirect('/'); 
    return null; 
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-grow container mx-auto px-2 sm:px-4 py-6 md:py-8 flex flex-col md:flex-row">
        <aside className="w-full md:w-60 lg:w-64 p-2 md:p-4 space-y-1 border-b md:border-b-0 md:border-r mb-4 md:mb-0 md:mr-4 flex-shrink-0">
          <nav className="flex flex-row md:flex-col gap-1">
            {adminNavLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={cn(
                  "w-full justify-start text-left px-3 py-2",
                  pathname === link.href ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <Link href={link.href}>
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-2 md:p-4 lg:p-6 bg-card rounded-lg shadow">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
