
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, ExternalLink, AlertCircle, Loader2, Star, Eye } from 'lucide-react';
import type { Server } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { voteAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// Removed: import { getServerOnlineStatus, updateServerStatsInFirestore } from '@/lib/firebase-data'; - Now handled by API
import { updateServerStatsInFirestore } from '@/lib/firebase-data'; // Keep this for updating stats after API fetch
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ServerCardProps {
  server: Server;
  onVote?: (serverId: string, newVotes: number) => void;
}

export function ServerCard({ server: initialServer, onVote }: ServerCardProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();

  const [serverData, setServerData] = useState(initialServer);
  const [isLoadingStats, setIsLoadingStats] = useState(true); // Start as loading initially
  const [votedRecently, setVotedRecently] = useState(false);

  useEffect(() => {
    // Reset state when initialServer changes
    setServerData(initialServer);
    setIsLoadingStats(true); // Reset loading state when server prop changes
  }, [initialServer]);

  const fetchStats = useCallback(async () => {
    if (serverData.status !== 'approved' || !serverData.ipAddress || !serverData.port || !serverData.id) {
      setIsLoadingStats(false); // Stop loading if server is not approved or info missing
      // Ensure default offline state if not approved
       setServerData(prevServer => ({
         ...prevServer,
         isOnline: prevServer.isOnline ?? false, // Use existing or default to false
         playerCount: prevServer.playerCount ?? 0,
         maxPlayers: prevServer.maxPlayers ?? 0,
       }));
      return;
    }

    // Set loading true only if we are actually going to fetch
    setIsLoadingStats(true);

    try {
      const response = await fetch(`/api/server-status?ip=${encodeURIComponent(serverData.ipAddress)}&port=${serverData.port}`);
      if (!response.ok) {
        // Try to parse error from response body
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch status, invalid response from API.' }));
        throw new Error(errorData?.error || `API request failed with status ${response.status}`);
      }

      const stats = await response.json();

      // Update local state
      setServerData(prevServer => ({
          ...prevServer,
          isOnline: stats.isOnline,
          playerCount: stats.playerCount,
          maxPlayers: stats.maxPlayers,
          // Optionally update name/map if returned by API
          // name: stats.name || prevServer.name,
       }));

       // Update stats in Firestore asynchronously (don't wait for it)
       updateServerStatsInFirestore(serverData.id, {
           isOnline: stats.isOnline,
           playerCount: stats.playerCount,
           maxPlayers: stats.maxPlayers,
       }).catch(err => console.error(`Error updating server stats in Firestore from ServerCard for ${serverData.id}:`, err));

    } catch (error: any) {
      console.error(`Failed to fetch server stats via API for ${serverData.name}:`, error.message);
      // Set to offline on error
      setServerData(prevServer => ({ ...prevServer, isOnline: false, playerCount: 0 }));
    } finally {
      setIsLoadingStats(false);
    }
  }, [serverData.id, serverData.ipAddress, serverData.port, serverData.status, serverData.name]); // Dependencies


  useEffect(() => {
    // Initial fetch
    fetchStats();
    // Set up interval
    const intervalId = setInterval(fetchStats, 60000); // Fetch every 60 seconds
    // Cleanup interval on component unmount or when dependencies change
    return () => clearInterval(intervalId);
  }, [fetchStats]); // Rerun effect if fetchStats function changes (due to dependency change)


  const handleVote = async () => {
    if (!user?.uid) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to vote.',
        variant: 'destructive',
        action: <Button asChild><Link href={`/login?redirect=/servers/${serverData.id}`}>Login</Link></Button>
      });
      return;
    }
    if (votedRecently || isPending) return;

    if (!serverData.id) {
        toast({ title: "Error", description: "Server ID missing, cannot vote.", variant: "destructive"});
        return;
    }

    setVotedRecently(true); // Disable button immediately

    startTransition(async () => {
      try {
        const result = await voteAction(serverData.id, user.uid);
        if (result.success && result.newVotes !== undefined && result.serverId === serverData.id) {
          toast({
            title: 'Vote Cast!',
            description: result.message,
          });
          // Update local state immediately for responsiveness
          setServerData(prev => ({...prev, votes: result.newVotes!}));
          if(onVote) onVote(serverData.id, result.newVotes);
           // Keep button disabled for a short period after success before cooldown check takes over
          setTimeout(() => setVotedRecently(false), 1000); // Reset visual disabled state slightly faster
        } else {
          toast({
            title: 'Vote Failed',
            description: result.message || 'Could not cast vote.',
            variant: 'destructive',
          });
          setVotedRecently(false); // Re-enable button on failure
        }
      } catch (e: any) {
         toast({
            title: 'Vote Error',
            description: e.message || 'An unexpected error occurred.',
            variant: 'destructive',
          });
        setVotedRecently(false); // Re-enable button on error
      }
    });
    // Actual cooldown check is handled by the backend, but this prevents spam clicking
    // We reset votedRecently visual state after 1 second, the backend enforces the real cooldown
     setTimeout(() => { if (!isPending) setVotedRecently(false); }, 1000);
  };

  const voteButtonDisabled = isPending || votedRecently || authLoading || serverData.status !== 'approved';
  const voteButtonText = authLoading ? <Loader2 className="animate-spin" /> : (isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote'));

  const isCurrentlyFeatured = serverData.isFeatured && serverData.featuredUntil && new Date(serverData.featuredUntil) > new Date();
  const isIndefinitelyFeatured = serverData.isFeatured && !serverData.featuredUntil;


  return (
    <Card className={cn("flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card", (isCurrentlyFeatured || isIndefinitelyFeatured) && "border-2 border-yellow-400 ring-2 ring-yellow-400/50")}>
      <CardHeader className="p-0 relative">
        <Link href={`/servers/${serverData.id}`} aria-label={`View details for ${serverData.name}`}>
          {serverData.bannerUrl ? (
            <Image
              src={serverData.bannerUrl}
              alt={`${serverData.name} banner`}
              width={400}
              height={150}
              className="w-full h-36 object-cover hover:opacity-90 transition-opacity"
              data-ai-hint="game landscape"
              unoptimized={serverData.bannerUrl.startsWith('http://') || !serverData.bannerUrl.startsWith('https://')}
              onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${serverData.id}/400/150`; e.currentTarget.srcset = "" }}
            />
          ) : (
            <div className="w-full h-36 bg-secondary flex items-center justify-center hover:opacity-90 transition-opacity" data-ai-hint="abstract pattern">
              <Gamepad2 className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </Link>
        {serverData.logoUrl && (
           <div className="absolute top-2 left-2 bg-card/80 backdrop-blur-sm p-1 rounded-md shadow-md">
            <Image
                src={serverData.logoUrl}
                alt={`${serverData.name} logo`}
                width={48}
                height={48}
                className="rounded"
                data-ai-hint="game icon"
                unoptimized={serverData.logoUrl.startsWith('http://') || !serverData.logoUrl.startsWith('https://')}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide logo if it fails to load
            />
           </div>
        )}
         {(isCurrentlyFeatured || isIndefinitelyFeatured) && (
          <Badge variant="default" className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-md">
            <Star className="w-3 h-3 mr-1 fill-yellow-900" /> Featured
          </Badge>
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
             {!isLoadingStats && !serverData.isOnline && serverData.status === 'approved' && (
                 <Badge variant="destructive" className="ml-auto opacity-70">
                    Offline
                </Badge>
            )}
             {serverData.status !== 'approved' && (
                <Badge variant={serverData.status === 'pending' ? 'secondary' : 'destructive'} className="ml-auto opacity-80">
                   {serverData.status.charAt(0).toUpperCase() + serverData.status.slice(1)}
                </Badge>
             )}
          </div>
          <p className="line-clamp-2 text-foreground/80">{serverData.description}</p>
        </div>
         {(isCurrentlyFeatured && serverData.featuredUntil) && (
            <p className="text-xs text-yellow-600 mt-2">
              Featured until {formatDistanceToNow(new Date(serverData.featuredUntil), { addSuffix: true })}
            </p>
          )}
          {isIndefinitelyFeatured && (
            <p className="text-xs text-yellow-600 mt-2">
              Featured
            </p>
          )}
      </CardContent>
      <CardFooter className="p-4 flex items-center justify-between border-t border-border/50 mt-auto gap-2">
        <div className="flex items-center gap-1 text-accent">
          <ThumbsUp className="w-5 h-5" />
          <span className="font-semibold">{serverData.votes}</span>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
                <Link href={`/servers/${serverData.id}`}>
                    <Eye className="mr-2 h-4 w-4" /> View
                </Link>
            </Button>
            <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                <span>
                    <Button
                    onClick={handleVote}
                    disabled={voteButtonDisabled}
                    size="sm"
                    className="border-accent text-accent bg-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-70 disabled:cursor-not-allowed"
                    aria-label={!user && !authLoading ? "Login to vote" : (serverData.status !== 'approved' ? "Server not approved for voting" : "Vote for this server")}
                    >
                    {voteButtonText}
                    </Button>
                </span>
                </TooltipTrigger>
                {(!user?.uid && !authLoading) && (
                <TooltipContent>
                    <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Login to vote</p>
                </TooltipContent>
                )}
                {votedRecently && user?.uid && (
                <TooltipContent>
                    <p>Vote cooldown active or processing...</p>
                </TooltipContent>
                )}
                {serverData.status !== 'approved' && user?.uid && (
                    <TooltipContent>
                        <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" />This server is not approved for voting.</p>
                    </TooltipContent>
                )}
            </Tooltip>
            </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}
