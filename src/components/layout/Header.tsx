
'use client';

import Link from 'next/link';
import { Gamepad2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from '@/components/ui/sheet';
import { UserProfileButton } from '@/components/auth/UserProfileButton';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/servers/submit', label: 'Submit Server' },
  { href: '/ai-features', label: 'AI Features' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
          <Gamepad2 className="h-8 w-8 text-accent" />
          <span>ServerSpotlight</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              asChild
              className={cn(
                "text-primary-foreground hover:bg-primary-foreground/10",
                pathname === link.href && "bg-primary-foreground/15"
              )}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          <UserProfileButton />
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-primary text-primary-foreground p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-primary-foreground/20">
                  <Link href="/" className="flex items-center gap-2 text-xl font-bold">
                    <Gamepad2 className="h-7 w-7 text-accent" />
                    <span>ServerSpotlight</span>
                  </Link>
                </div>
                <nav className="flex flex-col gap-2 p-4 flex-grow">
                  {navLinks.map((link) => (
                    <SheetClose key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          "block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-foreground/10",
                          pathname === link.href && "bg-primary-foreground/15"
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <div className="p-4 border-t border-primary-foreground/20">
                   <UserProfileButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

