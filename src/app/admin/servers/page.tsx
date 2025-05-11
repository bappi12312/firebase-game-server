
import { AdminServerList } from '@/components/admin/AdminServerList';
import { getFirebaseServers } from '@/lib/firebase-data';

export const metadata = {
  title: 'Manage Servers - Admin Dashboard',
};

export default async function ManageServersPage() {
  // Fetch all servers regardless of status for admin view
  const servers = await getFirebaseServers('all', 'submittedAt', '', 'all');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Manage Servers</h1>
      <p className="text-muted-foreground">
        View, approve, reject, or delete server submissions.
      </p>
      <AdminServerList servers={servers} />
    </div>
  );
}

// Ensure this page is dynamically rendered or revalidated often
export const revalidate = 0; // Or use revalidatePath in actions
