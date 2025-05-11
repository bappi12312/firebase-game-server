
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, Activity } from 'lucide-react';
// import { getFirebaseServers } from '@/lib/firebase-data'; // Example data fetching

export const metadata = {
  title: 'Admin Dashboard - ServerSpotlight',
};

// Example: Fetch some stats for the dashboard
// async function getDashboardStats() {
//   const allServers = await getFirebaseServers('all', 'votes', '', 'all'); // Fetch all servers
//   const pendingServers = allServers.filter(s => s.status === 'pending').length;
//   // Fetch user count, etc.
//   return {
//     totalServers: allServers.length,
//     approvedServers: allServers.filter(s => s.status === 'approved').length,
//     pendingServers,
//   };
// }

export default async function AdminDashboardPage() {
  // const stats = await getDashboardStats();

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
            <div className="text-2xl font-bold">{/* stats.totalServers */} (coming soon)</div>
            <p className="text-xs text-muted-foreground">
              {/* stats.approvedServers */} approved servers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{/* stats.pendingServers */} (coming soon)</div>
            <p className="text-xs text-muted-foreground">Servers awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">(coming soon)</div>
            <p className="text-xs text-muted-foreground">Total users on the platform</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Activity feed will be displayed here.</p>
          {/* Placeholder for recent submissions, votes, user registrations */}
        </CardContent>
      </Card>
    </div>
  );
}
