
'use client';

import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Trash2, ExternalLink, Star, CalendarX, CalendarCheck } from 'lucide-react';
import { approveServerAction, rejectServerAction, deleteServerAction, featureServerAction, unfeatureServerAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addDays } from 'date-fns';


interface AdminServerListProps {
  servers: Server[];
}

export function AdminServerList({ servers: initialServers }: AdminServerListProps) {
  const { toast } = useToast();
  const [isTransitioning, startTransition] = useTransition();
  const { user } = useAuth(); 
  const [servers, setServers] = useState(initialServers);
  const [featureDurationDays, setFeatureDurationDays] = useState<number>(30); // Default 30 days

  useEffect(() => {
    setServers(initialServers);
  }, [initialServers]);


  const handleAdminAction = async (
    action: (serverId: string, adminUserId?: string, ...args: any[]) => Promise<{ success: boolean; message: string; server?: Server }>, 
    serverId: string, 
    serverName: string, 
    successMessagePrefix: string,
    ...extraArgs: any[]
  ) => {
    startTransition(async () => {
      const result = await action(serverId, user?.uid, ...extraArgs);
      if (result.success) {
        toast({ title: 'Success', description: `${successMessagePrefix} '${serverName}'. ${result.message}` });
        if (result.server) {
            setServers(prev => prev.map(s => s.id === serverId ? result.server! : s));
        } else if (action === deleteServerAction) {
             setServers(prev => prev.filter(s => s.id !== serverId));
        } else {
            // Fallback: refetch or manually update status if server object not returned by all actions
            // This part might need adjustment based on what each action returns
            const updatedServers = servers.map(s => {
                if (s.id === serverId) {
                    if(action === approveServerAction) return {...s, status: 'approved'};
                    if(action === rejectServerAction) return {...s, status: 'rejected'};
                }
                return s;
            });
            setServers(updatedServers);
        }
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };
  

  if (!servers || servers.length === 0) {
    return <p className="text-muted-foreground">No servers found.</p>;
  }

  return (
    <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Game</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Featured</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers.map((server) => {
          const isCurrentlyFeatured = server.isFeatured && server.featuredUntil && new Date(server.featuredUntil) > new Date();
          const isIndefinitelyFeatured = server.isFeatured && !server.featuredUntil;
          const featuredDisplay = isCurrentlyFeatured 
            ? `Until ${format(new Date(server.featuredUntil!), "PP")}` 
            : isIndefinitelyFeatured ? "Yes (Indefinite)" : "No";

          return (
            <TableRow key={server.id}>
              <TableCell className="font-medium">
                <Link href={`/servers/${server.id}`} className="hover:underline" target="_blank">
                  {server.name} <ExternalLink className="inline h-3 w-3" />
                </Link>
                <p className="text-xs text-muted-foreground">{server.ipAddress}:{server.port}</p>
              </TableCell>
              <TableCell>{server.game}</TableCell>
              <TableCell>
                <Badge variant={server.status === 'approved' ? 'default' : server.status === 'pending' ? 'secondary' : 'destructive'}>
                  {server.status}
                </Badge>
              </TableCell>
              <TableCell>
                {server.isFeatured ? (
                  <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-500">
                    <Star className="h-3 w-3 mr-1 fill-current" /> {featuredDisplay}
                  </Badge>
                ) : (
                  <Badge variant="outline">No</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {/* Status Actions */}
                {server.status === 'pending' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleAdminAction(approveServerAction, server.id, server.name, "Approved server")} disabled={isTransitioning} title="Approve"><CheckCircle className="h-4 w-4 text-green-500" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleAdminAction(rejectServerAction, server.id, server.name, "Rejected server")} disabled={isTransitioning} title="Reject"><XCircle className="h-4 w-4 text-yellow-500" /></Button>
                  </>
                )}
                {server.status === 'rejected' && <Button variant="ghost" size="icon" onClick={() => handleAdminAction(approveServerAction, server.id, server.name, "Approved server")} disabled={isTransitioning} title="Approve"><CheckCircle className="h-4 w-4 text-green-500" /></Button>}
                {server.status === 'approved' && <Button variant="ghost" size="icon" onClick={() => handleAdminAction(rejectServerAction, server.id, server.name, "Unapproved server")} disabled={isTransitioning} title="Unapprove"><XCircle className="h-4 w-4 text-yellow-500" /></Button>}
                
                {/* Feature Actions */}
                {server.status === 'approved' && (
                  <>
                    {server.isFeatured ? (
                      <Button variant="ghost" size="icon" onClick={() => handleAdminAction(unfeatureServerAction, server.id, server.name, "Unfeatured server")} disabled={isTransitioning} title="Unfeature Server"><CalendarX className="h-4 w-4 text-orange-500" /></Button>
                    ) : (
                       <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isTransitioning} title="Feature Server"><Star className="h-4 w-4 text-yellow-500" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 space-y-2">
                            <Label htmlFor={`duration-${server.id}`}>Feature Duration (days)</Label>
                            <Input 
                                id={`duration-${server.id}`}
                                type="number" 
                                value={featureDurationDays}
                                onChange={(e) => setFeatureDurationDays(parseInt(e.target.value, 10) || 0)} 
                                placeholder="Days (e.g., 30)" 
                                className="w-full"
                            />
                            <Button 
                                onClick={() => handleAdminAction(featureServerAction, server.id, server.name, "Featured server", featureDurationDays > 0 ? featureDurationDays : undefined)} 
                                disabled={isTransitioning}
                                size="sm"
                                className="w-full"
                            >
                                {isTransitioning ? "Featuring..." : "Confirm Feature"}
                            </Button>
                            <Button 
                                variant="link"
                                size="sm"
                                onClick={() => handleAdminAction(featureServerAction, server.id, server.name, "Featured server indefinitely")} 
                                disabled={isTransitioning}
                                className="w-full text-xs"
                            >
                                Feature Indefinitely
                            </Button>
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}

                {/* Delete Action */}
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={isTransitioning} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the server "{server.name}".</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel disabled={isTransitioning}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleAdminAction(deleteServerAction, server.id, server.name, "Deleted server")} disabled={isTransitioning} className="bg-destructive hover:bg-destructive/90">{isTransitioning ? 'Deleting...' : 'Delete'}</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}

