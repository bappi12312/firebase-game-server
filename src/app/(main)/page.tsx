'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Server, Game, SortOption } from '@/lib/types';
import { getServers as fetchServers, getGames as fetchGames } from '@/lib/mock-data';
import { ServerList } from '@/components/servers/ServerList';
import { ServerFilters } from '@/components/servers/ServerFilters';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const [allServers, setAllServers] = useState<Server[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('votes');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [serversData, gamesData] = await Promise.all([
          fetchServers(),
          fetchGames(),
        ]);
        setAllServers(serversData);
        setGames(gamesData);
      } catch (error) {
        console.error("Failed to load data:", error);
        // Handle error state if necessary
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAndSortedServers = useMemo(() => {
    let servers = [...allServers];

    if (searchTerm) {
      servers = servers.filter(
        (server) =>
          server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          server.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
          server.game.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (gameFilter !== 'all') {
      servers = servers.filter((server) => server.game === gameFilter);
    }

    switch (sortBy) {
      case 'votes':
        servers.sort((a, b) => b.votes - a.votes);
        break;
      case 'playerCount':
        servers.sort((a, b) => (b.isOnline ? b.playerCount : -1) - (a.isOnline ? a.playerCount : -1));
        break;
      case 'name':
        servers.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'submittedAt':
        servers.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        break;
    }
    return servers;
  }, [allServers, searchTerm, gameFilter, sortBy]);

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
