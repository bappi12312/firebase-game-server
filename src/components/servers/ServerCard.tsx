'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import type { Server } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { voteAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition } from 'react';

interface ServerCardProps {
  server: Server;
  onVote?: (serverId: string, newVotes: number) => void;
}

export function ServerCard({ server, onVote }: ServerCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentVotes, setCurrentVotes] = useState(server.votes);
  const [votedRecently, setVotedRecently] = useState(false);

  const handleVote = async () => {
    if (votedRecently || isPending) return;
    setVotedRecently(true); // Basic client-side cooldown indication

    startTransition(async () => {
      const result = await voteAction(server.id);
      if (result.success && result.newVotes !== undefined) {
        toast({
          title: 'Vote Cast!',
          description: result.message,
        });
        setCurrentVotes(result.newVotes);
        if(onVote) onVote(server.id, result.newVotes);
      } else {
        toast({
          title: 'Vote Failed',
          description: result.message,
          variant: 'destructive',
        });
        setVotedRecently(false); // Allow retry if failed
      }
    });
    // Simulate cooldown expiry for UI
    setTimeout(() => setVotedRecently(false), 60000); // 1 minute cooldown for button re-enable
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative">
        {server.bannerUrl ? (
          <Image
            src={server.bannerUrl}
            alt={`${server.name} banner`}
            width={400}
            height={150}
            className="w-full h-36 object-cover"
            data-ai-hint="game landscape"
          />
        ) : (
          <div className="w-full h-36 bg-secondary flex items-center justify-center" data-ai-hint="abstract pattern">
            <Gamepad2 className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
        {server.logoUrl && (
           <div className="absolute top-2 left-2 bg-card p-1 rounded-md shadow-md">
            <Image
                src={server.logoUrl}
                alt={`${server.name} logo`}
                width={48}
                height={48}
                className="rounded"
                data-ai-hint="game icon"
            />
           </div>
        )}
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-xl mb-2 truncate">
          <Link href={`/servers/${server.id}`} className="hover:text-accent transition-colors">
            {server.name}
          </Link>
        </CardTitle>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-accent" />
            <span>{server.game}</span>
          </div>
          <div className="flex items-center gap-2">
            {server.isOnline ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span>{server.isOnline ? 'Online' : 'Offline'}</span>
            {server.isOnline && (
              <Badge variant="secondary" className="ml-auto">
                <Users className="w-3 h-3 mr-1" />
                {server.playerCount}/{server.maxPlayers}
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-foreground/80">{server.description}</p>
        </div>
      </CardContent>
      <CardFooter className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-accent">
          <ThumbsUp className="w-5 h-5" />
          <span className="font-semibold">{currentVotes}</span>
        </div>
        <Button onClick={handleVote} disabled={isPending || votedRecently} size="sm" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
          {isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote')}
        </Button>
      </CardFooter>
    </Card>
  );
}
