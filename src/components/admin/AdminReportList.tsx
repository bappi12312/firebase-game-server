
'use client';

import type { Report, ReportStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Archive, MessageSquare, ExternalLink, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState, useEffect, useActionState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveReportAction } from '@/lib/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminReportListProps {
  initialReports: Report[];
}

type AdminReportAction = 'resolve' | 'dismiss' | 'investigating';

export function AdminReportList({ initialReports }: AdminReportListProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [targetStatus, setTargetStatus] = useState<ReportStatus>('resolved');
  
  const [isProcessing, startTransition] = useTransition();


  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const handleOpenActionModal = (report: Report, status: ReportStatus) => {
    setSelectedReport(report);
    setTargetStatus(status);
    setAdminNotes(report.adminNotes || '');
    setIsActionModalOpen(true);
  };

  const handleReportAction = async () => {
    if (!selectedReport || !user?.uid) {
      toast({ title: 'Error', description: 'Report or user information missing.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const result = await resolveReportAction(selectedReport.id, user.uid, targetStatus, adminNotes);
      if (result.success && result.report) {
        toast({ title: 'Success', description: result.message });
        setReports(prev => prev.map(r => (r.id === selectedReport.id ? result.report! : r)));
        setIsActionModalOpen(false);
        setSelectedReport(null);
        setAdminNotes('');
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };


  if (!reports || reports.length === 0) {
    return <p className="text-muted-foreground text-center py-6">No reports found.</p>;
  }

  return (
    <>
      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reported By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">
                  <Link href={`/servers/${report.serverId}`} className="hover:underline" target="_blank">
                    {report.serverName} <ExternalLink className="inline h-3 w-3" />
                  </Link>
                </TableCell>
                <TableCell>{report.reason}</TableCell>
                <TableCell>{report.reportingUserDisplayName || report.reportingUserId}</TableCell>
                <TableCell>{formatDistanceToNow(new Date(report.reportedAt), { addSuffix: true })}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      report.status === 'resolved' ? 'default'
                      : report.status === 'dismissed' ? 'secondary'
                      : report.status === 'investigating' ? 'outline' // Example: use outline for investigating
                      : 'destructive' // pending
                    }
                    className={
                        report.status === 'resolved' ? 'bg-green-500/20 text-green-700 border-green-500/30'
                        : report.status === 'dismissed' ? 'bg-gray-500/20 text-gray-700 border-gray-500/30'
                        : report.status === 'investigating' ? 'bg-blue-500/20 text-blue-700 border-blue-500/30'
                        : 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' // pending
                    }
                  >
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(report, 'investigating')} disabled={isProcessing || report.status === 'investigating'} title="View/Update">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {report.status === 'pending' || report.status === 'investigating' ? (
                    <>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(report, 'resolved')} disabled={isProcessing} title="Mark Resolved">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(report, 'dismissed')} disabled={isProcessing} title="Dismiss Report">
                        <Archive className="h-4 w-4 text-gray-500" />
                    </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedReport && (
        <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Report Details: {selectedReport.serverName}</DialogTitle>
              <DialogDescription>
                Review the report details and take appropriate action.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label className="font-semibold">Reported by:</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.reportingUserDisplayName || selectedReport.reportingUserId}</p>
              </div>
              <div>
                <Label className="font-semibold">Reason:</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.reason}</p>
              </div>
              <div>
                <Label className="font-semibold">Description:</Label>
                <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md whitespace-pre-wrap">{selectedReport.description}</p>
              </div>
               {selectedReport.adminNotes && (
                <div>
                    <Label className="font-semibold">Previous Admin Notes:</Label>
                    <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md whitespace-pre-wrap">{selectedReport.adminNotes}</p>
                </div>
              )}
              <div>
                <Label htmlFor="adminNotes">Admin Notes:</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes for this report (optional for dismissal, recommended for resolution/investigation)."
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label htmlFor="reportStatus">Update Status:</Label>
                <Select value={targetStatus} onValueChange={(value) => setTargetStatus(value as ReportStatus)}>
                    <SelectTrigger id="reportStatus">
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isProcessing}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleReportAction} disabled={isProcessing} className="bg-primary hover:bg-primary/90">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
