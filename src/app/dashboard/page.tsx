
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getFirebaseServers, getUserVotedServerDetails, getUserProfile } from '@/lib/firebase-data';
import type { Server, VotedServerInfo, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Loader2, User, ListChecks, ThumbsUpIcon, Settings, UploadCloud, Home } from 'lucide-react';
import Link from 'next/link';
import { UserSubmittedServerTable } from '@/components/dashboard/UserSubmittedServerTable';
import { UserVotedServerTable } from '@/components/dashboard/UserVotedServerTable';
// import type { Metadata } from 'next'; // Not used in client component


export default function DashboardPage() {
  const { user, loading: authLoading, userProfile: authContextProfile } = useAuth();
  const router = useRouter();

  const [submittedServers, setSubmittedServers] = useState<Server[]>([]);
  const [votedServers, setVotedServers] = useState<VotedServerInfo[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(authContextProfile);
  
  const [isLoadingSubmitted, setIsLoadingSubmitted] = useState(true);
  const [isLoadingVoted, setIsLoadingVoted] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true); 
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "My Dashboard - ServerSpotlight";
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (user) {
      setIsLoadingSubmitted(true);
      setIsLoadingVoted(true);
      setIsLoadingProfile(true); 
      setError(null);

      try {
        const freshProfile = await getUserProfile(user.uid);
        setProfile(freshProfile);
        setIsLoadingProfile(false);

        const userSubmitted = await getFirebaseServers('all', 'submittedAt', '', 'all', user.uid);
        setSubmittedServers(userSubmitted);
        setIsLoadingSubmitted(false);

        const userVoted = await getUserVotedServerDetails(user.uid);
        setVotedServers(userVoted);
        setIsLoadingVoted(false);

      } catch (err: any) {
        console.error("Dashboard data fetch error:", err);
        setError(err.message || "Failed to load dashboard data. Please try again later.");
        setIsLoadingSubmitted(false);
        setIsLoadingVoted(false);
        setIsLoadingProfile(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (authContextProfile) {
      setProfile(authContextProfile);
      setIsLoadingProfile(false); 
    }
  }, [authContextProfile]);


  if (authLoading || (!user && !authLoading)) { 
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-2/3 mb-6" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
          <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
         <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
          <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user) { 
    return (
      <Card className="max-w-2xl mx-auto my-12">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <AlertCircle className="mr-2 h-6 w-6 text-destructive" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            You need to be logged in to access your dashboard.
          </p>
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/login?redirect=/dashboard">Login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-primary">My Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {profile?.displayName || user.email}!</p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
                <Link href="/"><Home className="mr-2 h-4 w-4" /> Go to Home</Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/servers/submit"><UploadCloud className="mr-2 h-4 w-4" /> Submit Server</Link>
            </Button>
            <Button asChild variant="outline">
                <Link href="/profile/settings"><Settings className="mr-2 h-4 w-4" /> Profile Settings</Link>
            </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2"/> Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />My Submitted Servers</CardTitle>
          <CardDescription>Track the status of servers you've submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubmitted ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : (
            <UserSubmittedServerTable servers={submittedServers} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ThumbsUpIcon className="mr-2 h-5 w-5 text-accent" />My Voted Servers</CardTitle>
          <CardDescription>See the servers you've recently voted for.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingVoted ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : (
            <UserVotedServerTable votedServers={votedServers} />
          )}
        </CardContent>
      </Card>

    </div>
  );
}
