
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Server, Game, SortOption } from '@/lib/types';
import { getFirebaseServers, getFirebaseGames } from '@/lib/firebase-data'; // Updated import
import { ServerList } from '@/components/servers/ServerList';
import { ServerFilters } from '@/components/servers/ServerFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ServerCrash } from 'lucide-react';

export default function HomePage() {
  const [allServers, setAllServers] = useState<Server[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('votes');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch games first or in parallel
      const gamesData = await getFirebaseGames();
      setGames(gamesData);

      // Then fetch servers with current filters
      const serversData = await getFirebaseServers(gameFilter, sortBy, searchTerm);
      setAllServers(serversData);

    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Could not load server data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [gameFilter, sortBy, searchTerm]);


  useEffect(() => {
    loadData();
  }, [loadData]); // Rerun when loadData (and its dependencies) change


  // Client-side filtering and sorting are applied on the already fetched `allServers`
  // If `getFirebaseServers` already handles all filtering/sorting, this `useMemo` might be simplified
  // or only handle search if not done by backend.
  // For now, `getFirebaseServers` implements basic filtering/sorting, and this will refine it or act as primary if backend is basic.
  const filteredAndSortedServers = useMemo(() => {
    let servers = [...allServers]; // `allServers` is already filtered by `gameFilter` and `sortBy` from `loadData`
    
    // If search is not handled by `getFirebaseServers` or needs further client-side refinement:
    if (searchTerm && !getFirebaseServers.toString().includes("searchTerm")) { // crude check if backend handles search
      servers = servers.filter(
        (server) =>
          server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          server.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (server.tags && server.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    // Sorting is primarily handled by `getFirebaseServers`. If additional client-side sort is needed, add here.
    // Example: If `getFirebaseServers` doesn't sort by player count for offline servers correctly.
    if (sortBy === 'playerCount') {
       servers.sort((a, b) => (b.isOnline ? b.playerCount : -1) - (a.isOnline ? a.playerCount : -1));
    }

    return servers;
  }, [allServers, searchTerm, sortBy]);


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
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
         <Alert variant="destructive" className="w-full max-w-lg">
          <ServerCrash className="h-5 w-5" />
          <AlertTitle>Error Loading Servers</AlertTitle>
          <AlertDescription>
            {error}
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
      <ServerList initialServers={filteredAndSortedServers} />
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
