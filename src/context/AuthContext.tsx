
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
  authError: string | null; // Added to expose auth-related errors
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const updateAuthContextProfile = useCallback((newProfileData: Partial<UserProfile>) => {
    setUserProfile(prevProfile => {
      if (prevProfile) {
        return { ...prevProfile, ...newProfileData };
      }
      const uid = user?.uid || ''; 
      return {
        uid: uid,
        email: user?.email || null,
        displayName: null, 
        ...newProfileData,
      } as UserProfile;
    });
    if (newProfileData.role) {
        setIsAdmin(newProfileData.role === 'admin');
    }
  }, [user]);


  useEffect(() => {
    if (!auth) { 
      const errorMsg = "AuthContext: Firebase Auth is not initialized. User authentication will not work.";
      console.warn(errorMsg);
      setAuthError(errorMsg);
      setLoading(false);
      return; 
    }
    setAuthError(null); // Clear previous errors

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          let profile = await getUserProfile(currentUser.uid);
          if (!profile && db) { 
            console.log(`AuthContext: Profile not found for ${currentUser.uid}, attempting to create.`);
            // If profile creation fails due to permissions, it will throw an error caught below
            profile = await createUserProfile(currentUser);
            console.log(`AuthContext: Profile creation attempt for ${currentUser.uid} resulted in:`, profile);
          }
          setUserProfile(profile);
          setIsAdmin(profile?.role === 'admin');
          setAuthError(null);
        } catch (error: any) {
          console.error("AuthContext: Error fetching/creating user profile:", error); 
          // Specific error message for Firestore permission issues during profile creation
          if (error.message && error.message.toLowerCase().includes('permission denied')) {
             setAuthError(`Failed to initialize user profile due to Firestore permissions. Please ensure your Firestore security rules allow users to be created in the 'users' collection. (Details: ${error.message})`);
          } else {
            setAuthError(error.message || "An unexpected error occurred while fetching user profile.");
          }
          setUserProfile(null);
          setIsAdmin(false);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setAuthError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between h-[60px]">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <Skeleton className="h-[calc(100vh-150px)] w-full" />
        </main>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, updateAuthContextProfile, authError }}>
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

