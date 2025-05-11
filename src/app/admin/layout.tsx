
'use client';

import Link from 'next/link';
import { redirect, usePathname, useRouter } from 'next/navigation';
import { Home, Users, Server, Settings, BarChart3, FileText, Activity, ArrowLeft } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from '@/components/ui/skeleton';

const adminNavLinks = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/servers', label: 'Manage Servers', icon: Server },
  { href: '/admin/users', label: 'Manage Users', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  // Show back button if not on the main admin dashboard page
  const showBackButton = pathname !== '/admin';

  if (loading) {
    return (
       <div className="flex flex-col min-h-screen bg-muted/40">
        <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between h-[60px]">
                 <Skeleton className="h-8 w-48" />
                 <Skeleton className="h-10 w-10 rounded-full" />
            </div>
        </header>
        <div className="flex-grow container mx-auto px-4 py-8 flex">
            <aside className="w-64 p-4 space-y-2 border-r bg-card">
                {[...Array(adminNavLinks.length)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
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
    redirect('/'); 
    return null; 
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
       <header className="bg-card text-card-foreground shadow-sm sticky top-0 z-40 border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/admin" className="text-2xl font-bold text-primary flex items-center">
            <Activity className="mr-2 h-6 w-6 text-accent" /> Admin Panel
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">View Site</Link>
          </Button>
        </div>
      </header>
      <div className="flex-grow container mx-auto px-2 sm:px-4 py-6 md:py-8 flex flex-col md:flex-row">
        <aside className="w-full md:w-60 lg:w-64 p-2 md:p-4 space-y-1 border-b md:border-b-0 md:border-r mb-4 md:mb-0 md:mr-4 flex-shrink-0 bg-card rounded-lg shadow-sm">
          {/* Changed flex-row md:flex-col to flex-col for better mobile nav stacking */}
          <nav className="flex flex-col gap-1">
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
        <main className="flex-1 p-4 md:p-6 bg-card rounded-lg shadow-lg">
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
      </div>
      <Toaster />
    </div>
  );
}
