import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, HelpCircle } from 'lucide-react';
import { getServersCountByStatus, getUsersCount } from '@/lib/firebase-data';

export const metadata = {
  title: 'Admin Dashboard - ServerSpotlight',
};

async function getDashboardStats() {
  const totalServers = await getServersCountByStatus('all');
  const approvedServers = await getServersCountByStatus('approved');
  const pendingServers = await getServersCountByStatus('pending');
  const totalUsers = await getUsersCount();
  return {
    totalServers,
    approvedServers,
    pendingServers,
    totalUsers,
  };
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
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
              {stats.approvedServers} approved servers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingServers}</div>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Activity feed (e.g., new submissions, votes) will be displayed here. (Coming Soon)</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Ensure this page is dynamically rendered or revalidated often
export const revalidate = 60; // Revalidate stats every 60 seconds