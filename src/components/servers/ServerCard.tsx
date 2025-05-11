
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
import { useState, useTransition, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getServerOnlineStatus, updateServerStatsInFirestore } from '@/lib/firebase-data';

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
    setServerData(initialServer); 
  }, [initialServer]);

  const fetchStats = useCallback(async () => {
    if (initialServer.status === 'approved' && initialServer.ipAddress && initialServer.port) {
      setIsLoadingStats(true);
      try {
        const stats = await getServerOnlineStatus(initialServer.ipAddress, initialServer.port);
        setServerData(prevServer => ({ ...prevServer, ...stats }));
        // Update Firestore with the new stats (fire-and-forget)
        updateServerStatsInFirestore(initialServer.id, stats)
          .catch(err => console.error(`Error updating server stats in Firestore from ServerCard for ${initialServer.id}:`, err));
      } catch (error) {
        console.error(`Failed to fetch server stats for card ${initialServer.name}:`, error);
        setServerData(prevServer => ({ ...prevServer, isOnline: false, playerCount: 0, maxPlayers: prevServer.maxPlayers || 0 }));
      } finally {
        setIsLoadingStats(false);
      }
    } else if (initialServer.status !== 'approved') {
      setServerData(prevServer => ({ 
        ...prevServer, 
        isOnline: initialServer.isOnline ?? false, 
        playerCount: initialServer.playerCount ?? 0, 
        maxPlayers: initialServer.maxPlayers ?? 0 
      }));
      setIsLoadingStats(false);
    }
  }, [initialServer.id, initialServer.ipAddress, initialServer.port, initialServer.status, initialServer.name, initialServer.isOnline, initialServer.playerCount, initialServer.maxPlayers]);


  useEffect(() => {
    fetchStats(); 
    const intervalId = setInterval(fetchStats, 60000); // Refresh every 60 seconds
    return () => clearInterval(intervalId);
  }, [fetchStats]);


  const handleVote = async () => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to vote.',
        variant: 'destructive',
        action: <Button asChild><Link href={`/login?redirect=/servers/${serverData.id}`}>Login</Link></Button>
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
  const voteButtonText = authLoading ? <Loader2 className="animate-spin" /> : (isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote'));


  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
      <CardHeader className="p-0 relative">
        {serverData.bannerUrl ? (
          <Image
            src={serverData.bannerUrl}
            alt={`${serverData.name} banner`}
            width={400}
            height={150}
            className="w-full h-36 object-cover"
            data-ai-hint="game landscape"
            unoptimized={serverData.bannerUrl.startsWith('http://')} 
          />
        ) : (
          <div className="w-full h-36 bg-secondary flex items-center justify-center" data-ai-hint="abstract pattern">
            <Gamepad2 className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
        {serverData.logoUrl && (
           <div className="absolute top-2 left-2 bg-card/80 backdrop-blur-sm p-1 rounded-md shadow-md">
            <Image
                src={serverData.logoUrl}
                alt={`${serverData.name} logo`}
                width={48}
                height={48}
                className="rounded"
                data-ai-hint="game icon"
                unoptimized={serverData.logoUrl.startsWith('http://')}
            />
           </div>
        )}
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-xl mb-2 truncate text-primary">
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
            {isLoadingStats && serverData.status === 'approved' ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : serverData.isOnline ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span>{isLoadingStats && serverData.status === 'approved' ? 'Updating...' : (serverData.isOnline ? 'Online' : 'Offline')}</span>
            {!isLoadingStats && serverData.isOnline && serverData.status === 'approved' && (
              <Badge variant="secondary" className="ml-auto">
                <Users className="w-3 h-3 mr-1" />
                {serverData.playerCount}/{serverData.maxPlayers}
              </Badge>
            )}
          </div>
          <p className="line-clamp-2 text-foreground/80">{serverData.description}</p>
        </div>
      </CardContent>
      <CardFooter className="p-4 flex items-center justify-between border-t border-border/50 mt-auto">
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
                  disabled={voteButtonDisabled || serverData.status !== 'approved'} 
                  size="sm" 
                  variant="outline" 
                  className="border-accent text-accent hover:bg-accent hover:text-accent-foreground disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-label={!user && !authLoading ? "Login to vote" : (serverData.status !== 'approved' ? "Server not approved for voting" : "Vote for this server")}
                >
                  {voteButtonText}
                </Button>
              </span>
            </TooltipTrigger>
            {(!user && !authLoading) && (
              <TooltipContent>
                <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Login to vote</p>
              </TooltipContent>
            )}
             {votedRecently && user && (
              <TooltipContent>
                <p>You've voted recently for this server!</p>
              </TooltipContent>
            )}
            {serverData.status !== 'approved' && user && (
                 <TooltipContent>
                    <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" />This server is not approved for voting.</p>
                </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
