'use client';

import Image from 'next/image';
import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, Info, ExternalLink, ClipboardCopy, ServerIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { voteAction } from '@/lib/actions';
import { useState, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';


interface ServerDetailsProps {
  server: Server;
}

export function ServerDetails({ server: initialServer }: ServerDetailsProps) {
  const { toast } = useToast();
  const [server, setServer] = useState(initialServer);
  const [isPending, startTransition] = useTransition();
  const [votedRecently, setVotedRecently] = useState(false);

  const handleCopyIp = () => {
    navigator.clipboard.writeText(`${server.ipAddress}:${server.port}`);
    toast({
      title: 'Copied to clipboard!',
      description: `${server.ipAddress}:${server.port}`,
    });
  };

  const handleVote = async () => {
    if (votedRecently || isPending) return;
    setVotedRecently(true);

    startTransition(async () => {
      const result = await voteAction(server.id);
      if (result.success && result.newVotes !== undefined) {
        toast({
          title: 'Vote Cast!',
          description: result.message,
        });
        setServer(prev => ({...prev, votes: result.newVotes!}));
      } else {
        toast({
          title: 'Vote Failed',
          description: result.message,
          variant: 'destructive',
        });
        setVotedRecently(false); 
      }
    });
    setTimeout(() => setVotedRecently(false), 60000); 
  };
  
  const timeAgo = server.submittedAt ? formatDistanceToNow(new Date(server.submittedAt), { addSuffix: true }) : 'N/A';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0 relative">
        {server.bannerUrl ? (
          <Image
            src={server.bannerUrl}
            alt={`${server.name} banner`}
            width={1200}
            height={300}
            className="w-full h-48 md:h-64 object-cover"
            data-ai-hint="gameplay screenshot"
            priority
          />
        ) : (
          <div className="w-full h-48 md:h-64 bg-secondary flex items-center justify-center" data-ai-hint="abstract design">
            <ServerIcon className="w-24 h-24 text-muted-foreground" />
          </div>
        )}
         {server.logoUrl && (
           <div className="absolute top-4 left-4 bg-card/80 backdrop-blur-sm p-2 rounded-lg shadow-lg">
            <Image
                src={server.logoUrl}
                alt={`${server.name} logo`}
                width={80}
                height={80}
                className="rounded-md"
                data-ai-hint="server logo"
            />
           </div>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <CardTitle className="text-3xl font-bold text-primary">{server.name}</CardTitle>
            <div className="flex items-center gap-2">
                <Button onClick={handleCopyIp} variant="outline" size="sm">
                    <ClipboardCopy className="w-4 h-4 mr-2" />
                    {server.ipAddress}:{server.port}
                </Button>
                <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <a href={`steam://connect/${server.ipAddress}:${server.port}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect
                    </a>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
            <Gamepad2 className="w-5 h-5 text-accent" />
            <div>
              <p className="text-muted-foreground">Game</p>
              <p className="font-semibold">{server.game}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
            {server.isOnline ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-semibold">{server.isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
            <Users className="w-5 h-5 text-accent" />
            <div>
              <p className="text-muted-foreground">Players</p>
              <p className="font-semibold">{server.isOnline ? `${server.playerCount} / ${server.maxPlayers}` : 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
            <ThumbsUp className="w-5 h-5 text-accent" />
            <div>
              <p className="text-muted-foreground">Votes</p>
              <p className="font-semibold">{server.votes}</p>
            </div>
          </div>
           <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-md">
            <Info className="w-5 h-5 text-accent" />
            <div>
              <p className="text-muted-foreground">Added</p>
              <p className="font-semibold">{timeAgo}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold mb-2 text-primary">Description</h3>
          <p className="text-foreground/80 whitespace-pre-wrap">{server.description}</p>
        </div>

        {server.tags && server.tags.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-2 text-primary">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {server.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">{tag}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Placeholder for live stats or more details */}
        {/* <div className="border-t pt-6">
            <h3 className="text-xl font-semibold mb-2 text-primary">Live Server Stats</h3>
            <p className="text-muted-foreground">Steam Query integration would show more details here.</p>
        </div> */}

      </CardContent>
      <CardFooter className="p-6 bg-secondary/30">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
            <p className="text-muted-foreground text-sm">Help this server climb the ranks!</p>
            <Button onClick={handleVote} disabled={isPending || votedRecently} className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <ThumbsUp className="w-4 h-4 mr-2" />
                {isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote for this Server')}
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
