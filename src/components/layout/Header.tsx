
'use client';

import Link from 'next/link';
import { Gamepad2, Menu, ShieldCheck, Wrench } from 'lucide-react'; // Added Wrench for AI Features
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetHeader, SheetDescription } from '@/components/ui/sheet';
import { UserProfileButton } from '@/components/auth/UserProfileButton';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext'; // Import useAuth to check for admin

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/servers/submit', label: 'Submit Server' },
  { href: '/ai-features', label: 'AI Features', icon: Wrench },
];

export function Header() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold">
          <Gamepad2 className="h-7 w-7 md:h-8 md:w-8 text-accent" />
          <span>ServerSpotlight</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              asChild
              className={cn(
                "text-primary-foreground hover:bg-primary-foreground/10 px-3 py-2 text-sm",
                pathname === link.href && "bg-primary-foreground/15 font-semibold"
              )}
            >
              <Link href={link.href}>
                {link.icon && <link.icon className="mr-2 h-4 w-4" />}
                {link.label}
              </Link>
            </Button>
          ))}
          {isAdmin && (
            <Button
              variant="ghost"
              asChild
              className={cn(
                "text-primary-foreground hover:bg-primary-foreground/10 px-3 py-2 text-sm",
                pathname.startsWith('/admin') && "bg-primary-foreground/15 font-semibold"
              )}
            >
              <Link href="/admin">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}
          <UserProfileButton />
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center">
          <UserProfileButton /> {/* Show user button outside sheet for quick access */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 ml-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-card text-card-foreground p-0 flex flex-col">
              <SheetHeader className="p-4 border-b">
                 <SheetTitle className="text-left">
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
                        <Gamepad2 className="h-7 w-7 text-accent" />
                        <span>ServerSpotlight</span>
                    </Link>
                 </SheetTitle>
                 {/* <SheetDescription className="text-left text-xs">Navigation Menu</SheetDescription> */}
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4 flex-grow">
                {navLinks.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        "block px-3 py-2.5 rounded-md text-base font-medium hover:bg-muted",
                        pathname === link.href && "bg-accent text-accent-foreground hover:bg-accent/90"
                      )}
                    >
                      {link.icon && <link.icon className="inline-block mr-2 h-5 w-5" />}
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                {isAdmin && (
                  <SheetClose asChild>
                    <Link
                      href="/admin"
                      className={cn(
                        "block px-3 py-2.5 rounded-md text-base font-medium hover:bg-muted",
                        pathname.startsWith('/admin') && "bg-accent text-accent-foreground hover:bg-accent/90"
                      )}
                    >
                      <ShieldCheck className="inline-block mr-2 h-5 w-5" />
                      Admin Panel
                    </Link>
                  </SheetClose>
                )}
              </nav>
              {/* User profile actions can be part of UserProfileButton already shown or placed here if preferred */}
              {/* <div className="p-4 border-t border-border mt-auto">
                 <UserProfileButton /> Displayed inline in mobile header now
              </div> */}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}