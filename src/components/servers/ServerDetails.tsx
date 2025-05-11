
'use client';

import Image from 'next/image';
import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, Info, ExternalLink, ClipboardCopy, ServerIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { voteAction } from '@/lib/actions';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getServerOnlineStatus, updateServerStatsInFirestore } from '@/lib/firebase-data';

interface ServerDetailsProps {
  server: Server;
}

export function ServerDetails({ server: initialServerData }: ServerDetailsProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [server, setServer] = useState(initialServerData);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isVotePending, startVoteTransition] = useTransition();
  const [votedRecently, setVotedRecently] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('N/A');

  useEffect(() => {
    setServer(initialServerData);
  }, [initialServerData]);

  useEffect(() => {
    if (server.submittedAt) {
      try {
        setTimeAgo(formatDistanceToNow(new Date(server.submittedAt), { addSuffix: true }));
      } catch (e) {
        console.warn("Error formatting date:", server.submittedAt, e);
        setTimeAgo('Unknown');
      }
    } else {
      setTimeAgo('N/A');
    }
  }, [server.submittedAt]);

  const fetchAndUpdateStats = useCallback(async () => {
    if (server.status === 'approved' && server.ipAddress && server.port) {
        setIsLoadingStats(true);
        try {
            const stats = await getServerOnlineStatus(server.ipAddress, server.port);
            setServer(prevServer => ({ ...prevServer, ...stats }));
            // Update Firestore with the new stats (fire-and-forget)
            updateServerStatsInFirestore(server.id, stats)
                .catch(err => console.error(`Error updating server stats in Firestore from ServerDetails for ${server.id}:`, err));
        } catch (error) {
            console.error(`Failed to fetch server stats for ${server.name}:`, error);
            setServer(prevServer => ({ ...prevServer, isOnline: false, playerCount: 0 }));
        } finally {
            setIsLoadingStats(false);
        }
    } else {
        // For non-approved or servers without IP/Port, reflect current data or defaults
        setIsLoadingStats(false); 
    }
  }, [server.id, server.ipAddress, server.port, server.status, server.name]); // server.name for logging, server.id for update call

  useEffect(() => {
    fetchAndUpdateStats();
    const intervalId = setInterval(fetchAndUpdateStats, 30000); // Refresh stats every 30 seconds
    return () => clearInterval(intervalId);
  }, [fetchAndUpdateStats]);

  const handleCopyIp = () => {
    navigator.clipboard.writeText(`${server.ipAddress}:${server.port}`);
    toast({
      title: 'Copied to clipboard!',
      description: `${server.ipAddress}:${server.port}`,
    });
  };

  const handleVote = async () => {
     if (!user) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to vote.',
        variant: 'destructive',
        action: <Button asChild><Link href={`/login?redirect=/servers/${server.id}`}>Login</Link></Button>
      });
      return;
    }
    if (votedRecently || isVotePending) return;
    setVotedRecently(true);

    startVoteTransition(async () => {
      try {
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
  
  const voteButtonDisabled = isVotePending || votedRecently || authLoading;
  const voteButtonText = isVotePending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote for this Server');

  return (
    <Card className="overflow-hidden shadow-xl">
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
            unoptimized={server.bannerUrl.startsWith('http://')}
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
                unoptimized={server.logoUrl.startsWith('http://')}
            />
           </div>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <CardTitle className="text-3xl font-bold text-primary">{server.name}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
                <Button onClick={handleCopyIp} variant="outline" size="sm">
                    <ClipboardCopy className="w-4 h-4 mr-2" />
                    {server.ipAddress}:{server.port}
                </Button>
                <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <a href={`steam://connect/${server.ipAddress}:${server.port}`} title="Connect via Steam (requires Steam client)">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect
                    </a>
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <InfoCard Icon={Gamepad2} label="Game" value={server.game} />
          <InfoCard 
            Icon={isLoadingStats ? Loader2 : (server.isOnline ? CheckCircle2 : XCircle)} 
            label="Status" 
            value={isLoadingStats ? 'Updating...' : (server.isOnline ? 'Online' : 'Offline')}
            iconClassName={isLoadingStats ? 'animate-spin text-muted-foreground' : (server.isOnline ? 'text-green-500' : 'text-red-500')} 
          />
          <InfoCard 
            Icon={isLoadingStats ? Loader2 : Users} 
            label="Players" 
            value={isLoadingStats ? '...' : (server.isOnline ? `${server.playerCount} / ${server.maxPlayers}` : 'N/A')} 
            iconClassName={isLoadingStats ? 'animate-spin text-muted-foreground' : 'text-accent'}
          />
          <InfoCard Icon={ThumbsUp} label="Votes" value={String(server.votes)} />
          <InfoCard Icon={Info} label="Added" value={timeAgo} />
          {server.status !== 'approved' && (
            <InfoCard Icon={AlertCircle} label="Server Status" value={server.status.charAt(0).toUpperCase() + server.status.slice(1)} iconClassName={server.status === 'pending' ? 'text-yellow-500' : 'text-red-500'} />
          )}
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
      </CardContent>
      {server.status === 'approved' && (
        <CardFooter className="p-6 bg-secondary/30">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
                <p className="text-muted-foreground text-sm text-center sm:text-left">Help this server climb the ranks!</p>
                <TooltipProvider>
                <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                    <span>
                        <Button 
                        onClick={handleVote} 
                        disabled={voteButtonDisabled && user !== null}
                        className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                        aria-label={!user && !authLoading ? "Login to vote" : "Vote for this server"}
                        >
                        <ThumbsUp className="w-4 h-4 mr-2" />
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
            </div>
        </CardFooter>
      )}
    </Card>
  );
}

interface InfoCardProps {
  Icon: React.ElementType;
  label: string;
  value: string;
  iconClassName?: string;
}

function InfoCard({ Icon, label, value, iconClassName }: InfoCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-md shadow-sm border">
      <Icon className={`w-5 h-5 ${iconClassName || 'text-accent'} ${iconClassName?.includes('animate-spin') ? '' : 'shrink-0'}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
