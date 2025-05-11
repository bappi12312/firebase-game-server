
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { ReactNode} from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile } from '@/lib/types';
import { getUserProfile, createUserProfile } from '@/lib/firebase-data';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  updateAuthContextProfile: (newProfileData: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const updateAuthContextProfile = useCallback((newProfileData: Partial<UserProfile>) => {
    setUserProfile(prevProfile => {
      if (prevProfile) {
        return { ...prevProfile, ...newProfileData };
      }
      // This case should ideally not happen if called after a profile update
      // but as a fallback, construct what's possible.
      const uid = user?.uid || ''; // Get UID from current Firebase user if prevProfile is null
      return {
        uid: uid,
        email: user?.email || null,
        displayName: null, // Will be overwritten by newProfileData if present
        ...newProfileData,
      } as UserProfile;
    });
    // Also update isAdmin state if role is changed, though current form only updates displayName
    if (newProfileData.role) {
        setIsAdmin(newProfileData.role === 'admin');
    }
  }, [user]);


  useEffect(() => {
    if (!auth) { 
      console.warn("AuthContext: Firebase Auth is not initialized. User authentication will not work.");
      setLoading(false);
      return; 
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          let profile = await getUserProfile(currentUser.uid);
          if (!profile && db) { 
            console.log(`AuthContext: Profile not found for ${currentUser.uid}, attempting to create.`);
            profile = await createUserProfile(currentUser);
            console.log(`AuthContext: Profile creation attempt for ${currentUser.uid} resulted in:`, profile);
          }
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin');
        } catch (error) {
          console.error("AuthContext: Error fetching/creating user profile:", error); 
          setUserProfile(null);
          setIsAdmin(false);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  if (loading && typeof window !== 'undefined') { // Added window check for safety though Skeleton is client-side
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
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, updateAuthContextProfile }}>
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
