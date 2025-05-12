
'use client';

import Image from 'next/image';
import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, Info, ExternalLink, ClipboardCopy, ServerIcon, AlertCircle, Loader2, Star, CalendarClock, Flag, ArrowLeft, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { voteAction } from '@/lib/actions';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { FeatureServerDialog } from './FeatureServerDialog';
import { ServerDetailsReportDialog } from './ServerDetailsReportDialog';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { updateServerStatsInFirestore } from '@/lib/firebase-data';
import { useRouter } from 'next/navigation';

interface ServerDetailsProps {
  server: Server;
}

export function ServerDetails({ server: initialServerData }: ServerDetailsProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [server, setServer] = useState(initialServerData);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isVotePending, startVoteTransition] = useTransition();
  const [votedRecently, setVotedRecently] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('N/A');
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isIpCopied, setIsIpCopied] = useState(false);


  useEffect(() => {
    setServer(initialServerData);
    setIsLoadingStats(true); 
  }, [initialServerData]);

  useEffect(() => {
    if (server.submittedAt && typeof server.submittedAt === 'string') {
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
    if (server.status !== 'approved' || !server.ipAddress || !server.port || !server.id) {
      setIsLoadingStats(false);
       setServer(prevServer => ({
         ...prevServer,
         isOnline: prevServer.isOnline ?? false,
         playerCount: prevServer.playerCount ?? 0,
         maxPlayers: prevServer.maxPlayers ?? 0,
       }));
      return;
    }

    setIsLoadingStats(true);

    try {
      const response = await fetch(`/api/server-status?ip=${encodeURIComponent(server.ipAddress)}&port=${server.port}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch status, invalid response from API.' }));
        throw new Error(errorData?.error || `API request failed with status ${response.status}`);
      }
      const stats = await response.json();

      setServer(prevServer => ({
          ...prevServer,
          isOnline: stats.isOnline,
          playerCount: stats.playerCount,
          maxPlayers: stats.maxPlayers,
      }));

      updateServerStatsInFirestore(server.id, {
          isOnline: stats.isOnline,
          playerCount: stats.playerCount,
          maxPlayers: stats.maxPlayers,
      }).catch(err => console.error(`Error updating server stats in Firestore from ServerDetails for ${server.id}:`, err));

    } catch (error: any) {
      console.error(`Failed to fetch server stats via API for ${server.name}:`, error.message);
      setServer(prevServer => ({ ...prevServer, isOnline: false, playerCount: 0 }));
    } finally {
      setIsLoadingStats(false);
    }
  }, [server.id, server.ipAddress, server.port, server.status, server.name]);

  useEffect(() => {
    fetchAndUpdateStats();
    const intervalId = setInterval(fetchAndUpdateStats, 30000);
    return () => clearInterval(intervalId);
  }, [fetchAndUpdateStats]);

  const handleCopyIp = () => {
    if (!server.ipAddress || !server.port) {
      toast({
        title: 'Error Copying IP',
        description: 'Server IP address or Port is missing.',
        variant: 'destructive',
      });
      return;
    }
    const fullAddress = `${server.ipAddress}:${server.port}`;
    navigator.clipboard.writeText(fullAddress)
      .then(() => {
        toast({
          title: 'IP Address Copied!',
          description: `${fullAddress} copied to your clipboard.`,
        });
        setIsIpCopied(true);
        setTimeout(() => setIsIpCopied(false), 2000);
      })
      .catch(err => {
        toast({
          title: 'Copy Failed',
          description: 'Could not copy IP address. Please try again or copy manually.',
          variant: 'destructive',
        });
        console.error('Failed to copy IP: ', err);
      });
  };

  const handleVote = async () => {
     if (!user?.uid) {
      toast({
        title: 'Login Required',
        description: 'You need to be logged in to vote.',
        variant: 'destructive',
        action: <Button asChild><Link href={`/login?redirect=/servers/${server.id}`}>Login</Link></Button>
      });
      return;
    }
    if (votedRecently || isVotePending) return;

    if (!server.id) {
      toast({ title: 'Error', description: 'Server ID is missing. Cannot vote.', variant: 'destructive' });
      return;
    }
    setVotedRecently(true);

    startVoteTransition(async () => {
      try {
        const result = await voteAction(server.id, user.uid);
        if (result.success && result.newVotes !== undefined && result.serverId === server.id) {
          toast({
            title: 'Vote Cast!',
            description: result.message,
          });
          setServer(prev => ({...prev, votes: result.newVotes!}));
           setTimeout(() => setVotedRecently(false), 1000);
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
     setTimeout(() => { if (!isVotePending) setVotedRecently(false); }, 1000);
  };

  const voteButtonDisabled = isVotePending || votedRecently || authLoading || !user?.uid || server.status !== 'approved';
  const voteButtonText = isVotePending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote for this Server');

  const isCurrentlyFeatured = server.isFeatured && server.featuredUntil && new Date(server.featuredUntil) > new Date();
  const isIndefinitelyFeatured = server.isFeatured && !server.featuredUntil;

  const handleFeatureSuccess = (updatedServer: Server) => {
    setServer(updatedServer);
  };

  const infoCardsData = [
    { key: 'game', Icon: Gamepad2, label: "Game", value: server.game || 'N/A' },
    {
      key: 'status',
      Icon: isLoadingStats ? Loader2 : (server.isOnline ? CheckCircle2 : XCircle),
      label: "Status",
      value: isLoadingStats ? 'Updating...' : (server.isOnline ? 'Online' : 'Offline'),
      iconClassName: isLoadingStats ? 'animate-spin text-muted-foreground' : (server.isOnline ? 'text-green-500' : 'text-red-500')
    },
    {
      key: 'players',
      Icon: isLoadingStats ? Loader2 : Users,
      label: "Players",
      value: isLoadingStats ? '...' : (server.isOnline ? `${server.playerCount ?? 0} / ${server.maxPlayers ?? 0}` : 'N/A'),
      iconClassName: isLoadingStats ? 'animate-spin text-muted-foreground' : 'text-accent'
    },
    { key: 'votes', Icon: ThumbsUp, label: "Votes", value: String(server.votes ?? 0) },
    { key: 'added', Icon: Info, label: "Added", value: timeAgo },
  ];

  if (server.status !== 'approved') {
    infoCardsData.push({
      key: 'serverStatus',
      Icon: AlertCircle,
      label: "Server Status",
      value: server.status ? server.status.charAt(0).toUpperCase() + server.status.slice(1) : 'Unknown',
      iconClassName: server.status === 'pending' ? 'text-yellow-500' : server.status === 'rejected' ? 'text-red-500' : 'text-muted-foreground'
    });
  }
  if (isCurrentlyFeatured && server.featuredUntil) {
    infoCardsData.push({ key: 'featuredUntil', Icon: CalendarClock, label: "Featured Until", value: format(new Date(server.featuredUntil), "PP"), iconClassName: "text-yellow-500" });
  }
  if (isIndefinitelyFeatured) {
    infoCardsData.push({ key: 'featuredActive', Icon: Star, label: "Featured", value: "Active", iconClassName: "text-yellow-500 fill-yellow-500" });
  }


  return (
    <Card className="overflow-hidden shadow-xl">
      <CardHeader className="p-0 relative">
        {server.bannerUrl ? (
          <Image
            src={server.bannerUrl}
            alt={`${server.name || 'Server'} banner`}
            width={1200}
            height={300}
            className="w-full h-48 md:h-64 object-cover"
            data-ai-hint="gameplay screenshot"
            priority
            unoptimized={server.bannerUrl.startsWith('http://') || !server.bannerUrl.startsWith('https://')}
            onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${server.id}/1200/300`; e.currentTarget.srcset = "" }}
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
                alt={`${server.name || 'Server'} logo`}
                width={80}
                height={80}
                className="rounded-md"
                data-ai-hint="server logo"
                unoptimized={server.logoUrl.startsWith('http://') || !server.logoUrl.startsWith('https://')}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
           </div>
        )}
        {(isCurrentlyFeatured || isIndefinitelyFeatured) && (
          <Badge variant="default" className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-lg text-sm px-3 py-1">
            <Star className="w-4 h-4 mr-1.5 fill-yellow-900" /> Featured
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <CardTitle className="text-3xl font-bold text-primary">{server.name || 'Unnamed Server'}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <Button onClick={handleCopyIp} variant="outline" size="sm" disabled={!server.ipAddress || !server.port}>
                    {isIpCopied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
                    {isIpCopied ? 'Copied!' : (server.ipAddress && server.port ? `${server.ipAddress}:${server.port}` : 'IP:Port N/A')}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!server.ipAddress || !server.port}>
                            <a
                            href={server.ipAddress && server.port ? `steam://connect/${server.ipAddress}:${server.port}` : '#'}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title={server.ipAddress && server.port ? "Connect via Steam (requires Steam client)" : "Connection info missing"}
                            onClick={(e) => { if (!server.ipAddress || !server.port) e.preventDefault(); }} 
                            >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Connect
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {server.ipAddress && server.port ?
                          <p>Connect directly to the server using Steam. Requires Steam client installed.</p> :
                          <p>Server IP or Port missing, cannot generate Steam connect link.</p>
                        }
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                 {user && server.status === 'approved' && (
                    <Button variant="outline" size="sm" onClick={() => setIsReportDialogOpen(true)} className="text-destructive border-destructive hover:bg-destructive/10">
                        <Flag className="w-4 h-4 mr-2" /> Report
                    </Button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {infoCardsData.map(({ key, ...cardProps }) => <InfoCard key={key} {...cardProps} />)}
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-2 text-primary">Description</h3>
          <p className="text-foreground/80 whitespace-pre-wrap">{server.description || 'No description provided.'}</p>
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

        {server.status === 'approved' && !isCurrentlyFeatured && !isIndefinitelyFeatured && user && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-xl font-semibold mb-2 text-primary">Promote Your Server</h3>
            <p className="text-muted-foreground mb-3">
              Want to get more visibility? Feature your server on our list!
            </p>
            <Button
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950"
              onClick={() => setIsFeatureDialogOpen(true)}
            >
              <Star className="w-5 h-5 mr-2 fill-current" /> Feature This Server
            </Button>
            {server.id && <FeatureServerDialog server={server} open={isFeatureDialogOpen} onOpenChange={setIsFeatureDialogOpen} onSuccess={handleFeatureSuccess} />}
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
                    <span> {/* Span is needed for disabled button tooltip */}
                        <Button
                        onClick={handleVote}
                        disabled={voteButtonDisabled}
                        className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
                        aria-label={!user?.uid && !authLoading ? "Login to vote" : (server.status !== 'approved' ? "Server not approved for voting" : "Vote for this server")}
                        >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        {authLoading && !user?.uid ? <Loader2 className="animate-spin" /> : voteButtonText}
                        </Button>
                    </span>
                    </TooltipTrigger>
                    {!user?.uid && !authLoading && (
                    <TooltipContent>
                        <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Login to vote</p>
                    </TooltipContent>
                    )}
                     {user?.uid && server.status !== 'approved' && (
                      <TooltipContent>
                        <p className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Not approved for voting</p>
                      </TooltipContent>
                    )}
                    {votedRecently && user?.uid && server.status === 'approved' && (
                    <TooltipContent>
                        <p>Vote cooldown active or processing...</p>
                    </TooltipContent>
                    )}
                </Tooltip>
                </TooltipProvider>
            </div>
        </CardFooter>
      )}
       {user && server.id && (
         <ServerDetailsReportDialog server={server} open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} />
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
