
'use client';

import { signOut } from 'firebase/auth';
import { LogOut, UserCircle, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export function UserProfileButton() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/'); // Redirect to home page after sign out
    } catch (error) {
      console.error('Error signing out: ', error);
      // Handle error (e.g., show a toast message)
    }
  };

  if (!user) {
    return (
      <>
        <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
          <Link href="/login">Login</Link>
        </Button>
        <Button variant="outline" asChild className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
          <Link href="/register">Register</Link>
        </Button>
      </>
    );
  }

  const userInitial = user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.displayName || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile/settings"> {/* Placeholder for profile settings page */}
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        {/* Placeholder for admin link - this would check for user role */}
        {/* {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          </DropdownMenuItem>
        )} */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
