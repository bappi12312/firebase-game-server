
'use client';

import type { Server } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ExternalLink, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface UserSubmittedServerTableProps {
  servers: Server[];
}

export function UserSubmittedServerTable({ servers }: UserSubmittedServerTableProps) {
  if (!servers || servers.length === 0) {
    return <p className="text-muted-foreground text-center py-4">You haven't submitted any servers yet.</p>;
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Game</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">View</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((server) => (
            <TableRow key={server.id}>
              <TableCell className="font-medium">{server.name}</TableCell>
              <TableCell>{server.game}</TableCell>
              <TableCell>
                <Badge 
                  variant={
                    server.status === 'approved' ? 'default' 
                    : server.status === 'pending' ? 'secondary' 
                    : 'destructive'
                  }
                  className={
                    server.status === 'approved' ? 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                    : server.status === 'pending' ? 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20'
                    : 'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                  }
                >
                  {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell>
                {server.submittedAt && typeof server.submittedAt === 'string' 
                  ? formatDistanceToNow(new Date(server.submittedAt), { addSuffix: true })
                  : 'N/A'}
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
