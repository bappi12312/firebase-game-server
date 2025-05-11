
'use client';

import Image from 'next/image';
import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Users, ThumbsUp, CheckCircle2, XCircle, Info, ExternalLink, ClipboardCopy, ServerIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { voteAction } from '@/lib/actions';
import { useState, useTransition, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface ServerDetailsProps {
  server: Server;
}

export function ServerDetails({ server: initialServer }: ServerDetailsProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [server, setServer] = useState(initialServer);
  const [isPending, startTransition] = useTransition();
  const [votedRecently, setVotedRecently] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('N/A');

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
        action: <Button asChild><Link href="/login">Login</Link></Button>
      });
      return;
    }
    if (votedRecently || isPending) return;
    setVotedRecently(true);

    startTransition(async () => {
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
  
  const voteButtonDisabled = isPending || votedRecently || authLoading;
  const voteButtonText = isPending ? 'Voting...' : (votedRecently ? 'Voted!' : 'Vote for this Server');

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
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
            <CardTitle className="text-3xl font-bold text-primary">{server.name}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <InfoCard Icon={Gamepad2} label="Game" value={server.game} />
          <InfoCard 
            Icon={server.isOnline ? CheckCircle2 : XCircle} 
            label="Status" 
            value={server.isOnline ? 'Online' : 'Offline'}
            iconClassName={server.isOnline ? 'text-green-500' : 'text-red-500'} 
          />
          <InfoCard Icon={Users} label="Players" value={server.isOnline ? `${server.playerCount} / ${server.maxPlayers}` : 'N/A'} />
          <InfoCard Icon={ThumbsUp} label="Votes" value={String(server.votes)} />
          <InfoCard Icon={Info} label="Added" value={timeAgo} />
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
      <Icon className={`w-5 h-5 ${iconClassName || 'text-accent'}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

