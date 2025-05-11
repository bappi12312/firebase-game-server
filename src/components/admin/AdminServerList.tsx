
'use client';

import type { Server } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Trash2, ExternalLink, Eye } from 'lucide-react';
import { approveServerAction, rejectServerAction, deleteServerAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState } from 'react';
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

interface AdminServerListProps {
  servers: Server[];
}

export function AdminServerList({ servers: initialServers }: AdminServerListProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth(); // For passing currentUserId to actions
  const [servers, setServers] = useState(initialServers);


  const handleAction = async (action: (serverId: string, userId?: string) => Promise<{ success: boolean; message: string }>, serverId: string, serverName: string, successMessagePrefix: string) => {
    startTransition(async () => {
      const result = await action(serverId, user?.uid);
      if (result.success) {
        toast({ title: 'Success', description: `${successMessagePrefix} '${serverName}'.` });
        // Optimistically update UI or refetch:
        if (action === deleteServerAction) {
            setServers(prev => prev.filter(s => s.id !== serverId));
        } else {
            const newStatus = action === approveServerAction ? 'approved' : 'rejected';
            setServers(prev => prev.map(s => s.id === serverId ? {...s, status: newStatus} : s));
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
          <TableHead>IP:Port</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers.map((server) => (
          <TableRow key={server.id}>
            <TableCell className="font-medium">
              <Link href={`/servers/${server.id}`} className="hover:underline" target="_blank">
                {server.name} <ExternalLink className="inline h-3 w-3" />
              </Link>
            </TableCell>
            <TableCell>{server.game}</TableCell>
            <TableCell>{server.ipAddress}:{server.port}</TableCell>
            <TableCell>
              <Badge variant={server.status === 'approved' ? 'default' : server.status === 'pending' ? 'secondary' : 'destructive'}>
                {server.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-1">
              {server.status === 'pending' && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAction(approveServerAction, server.id, server.name, "Approved server")}
                    disabled={isPending}
                    title="Approve"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAction(rejectServerAction, server.id, server.name, "Rejected server")}
                    disabled={isPending}
                    title="Reject"
                  >
                    <XCircle className="h-4 w-4 text-yellow-500" />
                  </Button>
                </>
              )}
               {server.status === 'rejected' && (
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAction(approveServerAction, server.id, server.name, "Approved server")}
                    disabled={isPending}
                    title="Approve"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
               )}
               {server.status === 'approved' && (
                 <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAction(rejectServerAction, server.id, server.name, "Rejected server (unapproved)")} // Or a "Suspend" action
                    disabled={isPending}
                    title="Unapprove"
                  >
                    <XCircle className="h-4 w-4 text-yellow-500" />
                  </Button>
               )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isPending} title="Delete">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the server
                      "{server.name}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleAction(deleteServerAction, server.id, server.name, "Deleted server")}
                      disabled={isPending}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
