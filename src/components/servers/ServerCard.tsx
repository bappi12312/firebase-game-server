'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import type { Server } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { voteAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getServerOnlineStatus } from '@/lib/firebase-data';

interface ServerCardProps {
  server: Server;
  onVote?: (serverId: string, newVotes: number) => void;
}

export function ServerCard({ server: initialServer, onVote }: ServerCardProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  
  const [serverData, setServerData] = useState(initialServer);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [votedRecently, setVotedRecently] = useState(false);

  useEffect(() => {
    setServerData(initialServer); // Update internal state if prop changes (e.g. list re-sort)
  }, [initialServer]);

  useEffect(() => {
    const fetchStats = async () => {
      if (serverData.status === 'approved') {
        setIsLoadingStats(true);
        try {
          const stats = await getServerOnlineStatus(serverData.ipAddress, serverData.port);
          setServerData(prevServer => ({ ...prevServer, ...stats }));
        } catch (error) {
          console.error(`Failed to fetch server stats for card ${serverData.name}:`, error);
          setServerData(prevServer => ({ ...prevServer, isOnline: false, playerCount: 0 }));
        } finally {
          setIsLoadingStats(false);
        }
      } else {
        // For non-approved servers, ensure their stats reflect what's in DB if they were fetched on submission
        // or just show them as potentially offline if no live check is done.
        setServerData(prevServer => ({ ...prevServer, isOnline: initialServer.isOnline, playerCount: initialServer.playerCount, maxPlayers: initialServer.maxPlayers }));
      }
    };

    fetchStats();
    // Optional: Set an interval to re-fetch stats, e.g., every 60 seconds
    // const intervalId = setInterval(fetchStats, 60000);
    // return () => clearInterval(intervalId);
  }, [serverData.id, serverData.ipAddress, serverData.port, serverData.status, initialServer.isOnline, initialServer.playerCount, initialServer.maxPlayers, serverData.name]);


  const handleVote = async () => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to vote.',
        variant: 'destructive',
        action: <Button asChild><Link href="/login">Login</Link></Button>
      });
      return;
    }
    if (votedRecently || isPending) return;
    setVotedRecently(true); 

    startTransition(async () => {
      try {
        const result = await voteAction(serverData.id);
        if (result.success && result.newVotes !== undefined) {
          toast({
            title: 'Vote Cast!',
            description: result.message,
          });
          setServerData(prev => ({...prev, votes: result.newVotes!}));
          if(onVote) onVote(serverData.id, result.newVotes);
        } else {
          toast({
            title: 'Vote Failed',
            description: result.message || 'Could not cast vote.',
            variant: 'destructive',
          });
          setVotedRecently(false); 
        }
      } catch (e: any) {
         toast({
            title: 'Vote Error',
            description: e.message || 'An unexpected error occurred.',
            variant: 'destructive',
          });
        setVotedRecently(false);
      }
    });
    setTimeout(() => setVotedRecently(false), 60000); 
  };

  const voteButtonDisabled = isPending || votedRecently || authLoading;
  const voteButtonText = isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote');

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="p-0 relative">
        {serverData.bannerUrl ? (
          <Image
            src={serverData.bannerUrl}
            alt={`${serverData.name} banner`}
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
        {serverData.logoUrl && (
           <div className="absolute top-2 left-2 bg-card p-1 rounded-md shadow-md">
            <Image
                src={serverData.logoUrl}
                alt={`${serverData.name} logo`}
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
          <Link href={`/servers/${serverData.id}`} className="hover:text-accent transition-colors">
            {serverData.name}
          </Link>
        </CardTitle>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-accent" />
            <span>{serverData.game}</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingStats ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : serverData.isOnline ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span>{isLoadingStats ? 'Updating...' : (serverData.isOnline ? 'Online' : 'Offline')}</span>
            {!isLoadingStats && serverData.isOnline && (
              <Badge variant="secondary" className="ml-auto">
                <Users className="w-3 h-3 mr-1" />
                {serverData.playerCount}/{serverData.maxPlayers}
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-foreground/80">{serverData.description}</p>
        </div>
      </CardContent>
      <CardFooter className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-accent">
          <ThumbsUp className="w-5 h-5" />
          <span className="font-semibold">{serverData.votes}</span>
        </div>
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span> 
                <Button 
                  onClick={handleVote} 
                  disabled={voteButtonDisabled && user !== null} 
                  size="sm" 
                  variant="outline" 
                  className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                  aria-label={!user && !authLoading ? "Login to vote" : "Vote for this server"}
                >
                  {authLoading ? 'Loading...' : voteButtonText}
                </Button>
              </span>
            </TooltipTrigger>
            {!user && !authLoading && (
              <TooltipContent>
                <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Login to vote</p>
              </TooltipContent>
            )}
             {votedRecently && user && (
              <TooltipContent>
                <p>You've voted recently!</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}