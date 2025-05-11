
import { FileText } from 'lucide-react';
import { getFirebaseReports } from '@/lib/firebase-data';
import type { Report } from '@/lib/types';
import { AdminReportList } from '@/components/admin/AdminReportList';

export const metadata = {
  title: 'Manage Reports - Admin Dashboard',
};

export default async function AdminReportsPage() {
  // Fetch all reports initially, or filter by 'pending' if preferred default
  const reports: Report[] = await getFirebaseReports('all'); 

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <FileText className="mr-3 h-8 w-8 text-accent" />
          Manage Server Reports
        </h1>
      </div>
      <p className="text-muted-foreground">
        Review and manage user-submitted reports about servers.
      </p>
      
      <AdminReportList initialReports={reports} />
    </div>
  );
}

export const revalidate = 0; // Revalidate frequently or use revalidatePath in actions
