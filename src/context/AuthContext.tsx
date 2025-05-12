
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { ReactNode} from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile } from '@/lib/types';
import { getUserProfile, createUserProfile, updateUserFirebaseRole } from '@/lib/firebase-data';

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
  const [_loadingInternal, _setLoadingInternal] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateAuthContextProfile = useCallback((newProfileData: Partial<UserProfile>) => {
    setUserProfile(prevProfile => {
      const currentAuthUser = auth?.currentUser;
      const baseUid = prevProfile?.uid || currentAuthUser?.uid;
      const baseEmail = prevProfile?.email || currentAuthUser?.email;
      const baseProfile: Partial<UserProfile> = prevProfile ?? { uid: baseUid, email: baseEmail };
      
      return { ...baseProfile, ...newProfileData } as UserProfile;
    });
  }, []);


  useEffect(() => {
    if (!isMounted) {
        return;
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
          
          const envAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          const hardcodedAdminEmail = "hossainmdbappi701@gmail.com";
          
          // User is admin if their email matches the env variable OR the hardcoded admin email
          const isCurrentUserAdminByEmail = 
            (envAdminEmail && currentUser.email === envAdminEmail) || 
            currentUser.email === hardcodedAdminEmail;

          if (!profile && db) { 
            // console.log(`AuthContext: Profile not found for ${currentUser.uid}, attempting to create.`);
            profile = await createUserProfile(currentUser); // createUserProfile sets role based on email
            // console.log(`AuthContext: Profile created for ${currentUser.uid}, role: ${profile?.role}`);
          } else if (profile) {
            // Profile exists, check if role needs correction
            if (isCurrentUserAdminByEmail && profile.role !== 'admin') {
              // console.log(`AuthContext: User ${currentUser.email} is admin by designated email, but role is ${profile.role}. Updating role in Firestore.`);
              await updateUserFirebaseRole(currentUser.uid, 'admin');
              profile.role = 'admin'; // Update local profile object immediately
            } else if (!isCurrentUserAdminByEmail && profile.role === 'admin') {
              // console.log(`AuthContext: User ${currentUser.email} is no longer admin by designated email, but role is admin. Updating role in Firestore.`);
              await updateUserFirebaseRole(currentUser.uid, 'user');
              profile.role = 'user'; // Update local profile object immediately
            }
            // console.log(`AuthContext: Profile found for ${currentUser.uid}, role: ${profile?.role}, isCurrentUserAdminByEmail: ${isCurrentUserAdminByEmail}`);
          }
          
          if (profile) {
            updateAuthContextProfile(profile);
          } else {
            // This case might occur if createUserProfile somehow fails to return a profile
            // console.warn(`AuthContext: Profile is null for user ${currentUser.uid} even after create/update attempt.`);
            setUserProfile(null); 
          }
          setAuthError(null);
        } catch (error: any) {
          let detailedError = error.message || "An unexpected error occurred while fetching/updating user profile.";
          if (error.message && error.message.toLowerCase().includes('permission denied')) {
             detailedError = `Failed to initialize/update user profile due to Firestore permissions. Please check your Firestore security rules. (Details: ${error.message})`;
          }
          console.error("AuthContext: Error processing user profile:", detailedError, error);
          setAuthError(detailedError);
          setUserProfile(null);
        }
      } else { // No current user
        setUserProfile(null);
        setAuthError(null);
      }
      _setLoadingInternal(false);
    });
    return () => unsubscribe();
  }, [isMounted, updateAuthContextProfile]); 

  // Derive isAdmin directly from userProfile
  const isAdmin = userProfile?.role === 'admin';

  if (!isMounted || _loadingInternal) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between h-[60px]">
            <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
            <Skeleton className="h-10 w-10 rounded-full bg-primary-foreground/20" />
          </div>
        </header>
        <main className="flex-grow container mx-auto px-4 py-8">
          <Skeleton className="h-[calc(100vh-150px)] w-full bg-muted" />
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

