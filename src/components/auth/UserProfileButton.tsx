
'use client';

import { signOut } from 'firebase/auth';
import { LogOut, UserCircle, Settings, ShieldCheck, LayoutDashboard, LineChart } from 'lucide-react';
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
  const { user, userProfile, isAdmin } = useAuth(); 
  const router = useRouter();

  const handleSignOut = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized.");
      return;
    }
    try {
      await signOut(auth);
      router.push('/'); 
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
          <Link href="/login">Login</Link>
        </Button>
        <Button variant="outline" asChild className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
          <Link href="/register">Register</Link>
        </Button>
      </div>
    );
  }

  const userInitial = userProfile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={userProfile?.photoURL || user.photoURL || undefined} alt={userProfile?.displayName || user.email || 'User'} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userProfile?.displayName || user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isAdmin && (
           <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <LineChart className="mr-2 h-4 w-4" />
              <span>My Dashboard</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile/settings"> 
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

