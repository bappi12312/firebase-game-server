
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Construction } from 'lucide-react';

export const metadata = {
  title: 'Reports - Admin Dashboard',
};

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <FileText className="mr-3 h-8 w-8 text-accent" />
          Admin Reports
        </h1>
      </div>
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Construction className="mr-2 h-5 w-5 text-muted-foreground" />
            Feature Under Development
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The reporting section is currently under development. 
            Future enhancements will include detailed analytics on server performance, user activity, and platform growth.
          </p>
          <div className="mt-6 p-6 bg-secondary/30 rounded-lg">
            <h3 className="text-lg font-semibold text-primary mb-2">Planned Reports:</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Server Submission Trends (by game, by period)</li>
              <li>Top Voted Servers</li>
              <li>User Growth & Engagement Metrics</li>
              <li>Voting Activity Overview</li>
              <li>Revenue Reports (for featured servers - if PayPal is integrated)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const revalidate = 3600; // Revalidate this page hourly, or make it static if content doesn't change
