import Link from 'next/link';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
          <Gamepad2 className="h-8 w-8 text-accent" />
          <span>ServerSpotlight</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
            <Link href="/">Home</Link>
          </Button>
          <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
            <Link href="/servers/submit">Submit Server</Link>
          </Button>
          <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
            <Link href="/ai-features">AI Features</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
