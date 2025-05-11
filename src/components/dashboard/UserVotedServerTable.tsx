
'use client';

import type { VotedServerInfo } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface UserVotedServerTableProps {
  votedServers: VotedServerInfo[];
}

export function UserVotedServerTable({ votedServers }: UserVotedServerTableProps) {
  if (!votedServers || votedServers.length === 0) {
    return <p className="text-muted-foreground text-center py-4">You haven't voted for any servers yet.</p>;
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Server Name</TableHead>
            <TableHead>Game</TableHead>
            <TableHead>Your Last Vote</TableHead>
            <TableHead className="text-right">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {votedServers.map(({ server, votedAt }) => (
            <TableRow key={server.id}>
              <TableCell className="font-medium">{server.name}</TableCell>
              <TableCell>{server.game}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(votedAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/servers/${server.id}`} title="View Server Details">
                    <Eye className="mr-2 h-4 w-4" /> View
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
