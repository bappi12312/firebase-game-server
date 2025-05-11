'use client';

import type { Server } from '@/lib/types';
import { ServerCard } from './ServerCard';
import { useState, useEffect } from 'react';

interface ServerListProps {
  initialServers: Server[];
}

export function ServerList({ initialServers }: ServerListProps) {
  const [servers, setServers] = useState<Server[]>(initialServers);

  useEffect(() => {
    setServers(initialServers);
  }, [initialServers]);

  const handleVoteUpdate = (serverId: string, newVotes: number) => {
    setServers(prevServers => 
      prevServers.map(s => 
        s.id === serverId ? { ...s, votes: newVotes } : s
      )
    );
  };

  if (servers.length === 0) {
    return <p className="text-center text-muted-foreground py-10">No servers found matching your criteria.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} onVote={handleVoteUpdate} />
      ))}
    </div>
  );
}
