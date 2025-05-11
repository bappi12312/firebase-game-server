
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { ReactNode} from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    // Basic loading state, can be replaced with a more sophisticated loader
    return (
      <div className="flex flex-col min-h-screen">
        <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between h-[60px]">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <Skeleton className="h-screen w-full" />
        </main>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
