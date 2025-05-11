
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Server, Game, SortOption } from '@/lib/types';
import { getFirebaseServers, getFirebaseGames } from '@/lib/firebase-data';
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
      const gamesData = await getFirebaseGames();
      setGames(gamesData);

      // Fetch only 'approved' servers for the public list
      const serversData = await getFirebaseServers(gameFilter, sortBy, searchTerm, 'approved');
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
  }, [loadData]);


  const filteredAndSortedServers = useMemo(() => {
    // Data is already filtered by game, sorted by chosen option, and is 'approved' from `loadData`
    // Client-side search refinement can still happen if desired, though `getFirebaseServers` also handles it.
    let servers = [...allServers];
    
    // This client-side search is mostly redundant if backend search in getFirebaseServers is comprehensive
    // but can be kept for instant feedback on already loaded data subset.
    if (searchTerm) {
      servers = servers.filter(
        (server) =>
          server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          server.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (server.tags && server.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }
    // Re-sorting for player count, especially if offline servers need specific handling not fully covered by backend sort
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
            {error} Please check your internet connection or try again later. If the problem persists, ensure Firebase is configured correctly.
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
