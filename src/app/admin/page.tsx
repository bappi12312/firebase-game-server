
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Users, Server, HelpCircle, FileText, CalendarPlus, UserPlus, MessageSquareWarning } from 'lucide-react';
import { getServersCountByStatus, getUsersCount, getRecentPendingServers, getRecentPendingReports, getRecentRegisteredUsers } from '@/lib/firebase-data';
import type { Server as ServerType, Report as ReportType, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export const metadata = {
  title: 'Admin Dashboard - ServerSpotlight',
};

async function getDashboardStats() {
  const totalServers = await getServersCountByStatus('all');
  const approvedServers = await getServersCountByStatus('approved');
  const pendingServersCount = await getServersCountByStatus('pending');
  const totalUsers = await getUsersCount();
  
  const recentPendingServers = await getRecentPendingServers(5);
  const recentPendingReports = await getRecentPendingReports('pending', 5);
  const recentUsers = await getRecentRegisteredUsers(5);

  return {
    totalServers,
    approvedServers,
    pendingServersCount,
    totalUsers,
    recentPendingServers,
    recentPendingReports,
    recentUsers,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalServers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedServers} approved / {stats.totalServers - stats.approvedServers - stats.pendingServersCount} other
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingServersCount}</div>
            <p className="text-xs text-muted-foreground">Servers awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Total users on the platform</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {/* Recent Pending Servers */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-lg"><CalendarPlus className="mr-2 h-5 w-5 text-accent"/>Recent Pending Servers</CardTitle>
            <CardDescription>Latest servers submitted for approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentPendingServers.length > 0 ? (
              stats.recentPendingServers.map((server: ServerType) => (
                <div key={server.id} className="p-3 bg-muted/50 rounded-md shadow-sm">
                  <h4 className="font-semibold truncate">{server.name}</h4>
                  <p className="text-xs text-muted-foreground">{server.game} - Submitted {formatDistanceToNow(new Date(server.submittedAt), { addSuffix: true })}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No pending server submissions.</p>
            )}
          </CardContent>
          {stats.recentPendingServers.length > 0 && (
            <CardFooter>
                 <Button variant="link" asChild className="text-accent p-0 h-auto">
                    <Link href="/admin/servers">View All Pending Servers</Link>
                 </Button>
            </CardFooter>
          )}
        </Card>

        {/* Recent Pending Reports */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-lg"><MessageSquareWarning className="mr-2 h-5 w-5 text-accent"/>Recent Pending Reports</CardTitle>
            <CardDescription>Latest user-submitted reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentPendingReports.length > 0 ? (
              stats.recentPendingReports.map((report: ReportType) => (
                <div key={report.id} className="p-3 bg-muted/50 rounded-md shadow-sm">
                  <h4 className="font-semibold truncate">Report for: {report.serverName}</h4>
                  <p className="text-xs text-muted-foreground">Reason: {report.reason} - Reported {formatDistanceToNow(new Date(report.reportedAt), { addSuffix: true })}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No pending reports.</p>
            )}
          </CardContent>
           {stats.recentPendingReports.length > 0 && (
            <CardFooter>
                 <Button variant="link" asChild className="text-accent p-0 h-auto">
                    <Link href="/admin/reports">View All Reports</Link>
                 </Button>
            </CardFooter>
          )}
        </Card>

        {/* Recent Registered Users */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-lg"><UserPlus className="mr-2 h-5 w-5 text-accent"/>Recent Registered Users</CardTitle>
            <CardDescription>Newest users on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.recentUsers.length > 0 ? (
              stats.recentUsers.map((user: UserProfile) => (
                <div key={user.uid} className="p-3 bg-muted/50 rounded-md shadow-sm">
                  <h4 className="font-semibold truncate">{user.displayName || user.email}</h4>
                  <p className="text-xs text-muted-foreground">Registered {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'recently'}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No new user registrations recently.</p>
            )}
          </CardContent>
           {stats.recentUsers.length > 0 && (
            <CardFooter>
                 <Button variant="link" asChild className="text-accent p-0 h-auto">
                    <Link href="/admin/users">View All Users</Link>
                 </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

// Ensure this page is dynamically rendered or revalidated often
export const revalidate = 60; // Revalidate stats every 60 seconds
