
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
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [_loadingInternal, _setLoadingInternal] = useState(true); // Internal loading state
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateAuthContextProfile = useCallback((newProfileData: Partial<UserProfile>) => {
    setUserProfile(prevProfile => {
      const currentAuthUser = auth?.currentUser; // Use auth.currentUser directly if needed for base
      const baseUid = prevProfile?.uid || currentAuthUser?.uid;
      const baseEmail = prevProfile?.email || currentAuthUser?.email;

      const baseProfile: Partial<UserProfile> = prevProfile ?? { uid: baseUid, email: baseEmail };
      
      return { ...baseProfile, ...newProfileData } as UserProfile;
    });
    if (newProfileData.role !== undefined) {
        setIsAdmin(newProfileData.role === 'admin');
    }
  }, []); // Removed `user` dependency as currentAuthUser is used if needed


  useEffect(() => {
    if (!isMounted) {
        return; // Don't run auth listener until client has mounted
    }

    if (!auth) { 
      const errorMsg = "AuthContext: Firebase Auth is not initialized. User authentication will not work.";
      console.warn(errorMsg);
      setAuthError(errorMsg);
      _setLoadingInternal(false);
      return; 
    }
    
    setAuthError(null); 
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          let profile = await getUserProfile(currentUser.uid);
          if (!profile && db) { 
            profile = await createUserProfile(currentUser);
          }
          // Use updateAuthContextProfile to set/update profile
          // Ensure profile is not undefined when passing
          updateAuthContextProfile(profile || { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.photoURL });
          setIsAdmin(profile?.role === 'admin'); // setIsAdmin based on fetched/created profile
          setAuthError(null);
        } catch (error: any) {
          let detailedError = error.message || "An unexpected error occurred while fetching user profile.";
          if (error.message && error.message.toLowerCase().includes('permission denied')) {
             detailedError = `Failed to initialize user profile due to Firestore permissions. Please ensure your Firestore security rules allow users to be created in the 'users' collection. (Details: ${error.message})`;
          }
          console.error("AuthContext: Error fetching/creating user profile:", detailedError, error);
          setAuthError(detailedError);
          setUserProfile(null); // Explicitly nullify profile on error
          setIsAdmin(false);
        }
      } else {
        setUserProfile(null);
        setIsAdmin(false);
        setAuthError(null);
      }
      _setLoadingInternal(false);
    });
    return () => unsubscribe();
  }, [isMounted, updateAuthContextProfile]); 

  // Render skeleton if not mounted or if internal loading is true
  if (!isMounted || _loadingInternal) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between h-[60px]">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <Skeleton className="h-[calc(100vh-150px)] w-full" />
        </main>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading: _loadingInternal, isAdmin, updateAuthContextProfile, authError }}>
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

