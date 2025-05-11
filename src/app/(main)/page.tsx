
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Server, Game, SortOption } from '@/lib/types';
import { getFirebaseServers, getFirebaseGames } from '@/lib/firebase-data';
import { ServerList } from '@/components/servers/ServerList';
import { ServerFilters } from '@/components/servers/ServerFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ServerCrash, WifiOff, ShieldAlert, Settings2 } from 'lucide-react'; 
import { auth, db } from '@/lib/firebase'; 
import { useAuth } from '@/context/AuthContext';


export default function HomePage() {
  const [allServers, setAllServers] = useState<Server[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authError } = useAuth(); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured'); // Default to 'featured'

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!auth || !db) {
      const configError = "Firebase is not configured correctly. Please check the console and ensure your .env.local file has the correct Firebase credentials.";
      setError(configError);
      setIsLoading(false);
      console.error("Firebase auth or db is not initialized. Check firebase.ts and .env.local.");
      return;
    }

    try {
      const gamesData = await getFirebaseGames();
      setGames(gamesData);
      // Pass 'approved' status to fetch only approved servers for the main list.
      // The getFirebaseServers function will handle sorting featured servers first internally.
      const serversData = await getFirebaseServers(gameFilter, sortBy, searchTerm, 'approved');
      setAllServers(serversData);
    } catch (err: any) {
      console.error("Failed to load data:", err);
      let friendlyError = "Could not load server data. Please try again later.";
      if (err.message && err.message.toLowerCase().includes('permission denied')) {
        friendlyError = "Could not load server data due to a permission issue. This might be a misconfiguration. Please contact support or check Firestore security rules.";
      } else if (err.message && err.message.toLowerCase().includes('query requires an index')) {
        friendlyError = err.message; 
      }
      setError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  }, [gameFilter, sortBy, searchTerm]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (authError) {
      setError(prevError => authError + (prevError ? ` | ${prevError}` : ''));
    }
  }, [authError]);


  const displayedServers = allServers;

  if (isLoading) {
    return (
      <div>
        <div className="mb-8 p-6 bg-card rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    let IconComponent = ServerCrash;
    let title = "Error Loading Servers";
    if (error.includes("Firebase is not configured")) {
        IconComponent = WifiOff;
        title = "Configuration Issue";
    } else if (error.toLowerCase().includes("permission denied")) {
        IconComponent = ShieldAlert;
        title = "Permission Issue";
    } else if (error.toLowerCase().includes("query requires an index")) { 
        IconComponent = Settings2; 
        title = "Database Index Required";
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
         <Alert variant="destructive" className="w-full max-w-2xl"> 
          <IconComponent className="h-5 w-5" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="break-words"> 
            {error} 
            
            { !error.includes("Firebase is not configured") &&
              !error.toLowerCase().includes("permission denied") &&
              !error.toLowerCase().includes("query requires an index") &&
              " Please check your internet connection or try again later."
            }
            {error.toLowerCase().includes("permission denied") && " Please check your Firestore security rules or contact support."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!auth || !db) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
         <Alert variant="destructive" className="w-full max-w-lg">
          <WifiOff className="h-5 w-5" />
          <AlertTitle>Firebase Not Initialized</AlertTitle>
          <AlertDescription>
            The application cannot connect to Firebase. Please ensure your environment variables (in .env.local) are correctly set up. Check the browser console for more details.
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  return (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-primary">Discover Game Servers</h1>
      <p className="text-muted-foreground mb-8">Find, vote, and play on the best community servers.</p>
      <ServerFilters
        games={games}
        onSearchChange={setSearchTerm}
        onGameFilterChange={setGameFilter}
        onSortChange={setSortBy}
        searchTerm={searchTerm}
        gameFilter={gameFilter}
        sortBy={sortBy}
      />
      {displayedServers.length > 0 ? (
         <ServerList initialServers={displayedServers} />
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <p>No servers found matching your criteria. Try adjusting your filters or search term.</p>
        </div>
      )}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="border bg-card text-card-foreground shadow-sm rounded-lg p-4 space-y-3">
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
      <div className="flex justify-between">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

