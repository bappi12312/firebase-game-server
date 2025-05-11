
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllFirebaseUsers, updateUserFirebaseRole } from '@/lib/firebase-data';
import type { UserProfile } from '@/lib/types';
import { AdminUserList } from '@/components/admin/AdminUserList';


export const metadata = {
  title: 'Manage Users - Admin Dashboard',
};

export default async function ManageUsersPage() {
  const users = await getAllFirebaseUsers();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Manage Users</h1>
      <p className="text-muted-foreground">
        View user details and manage their roles.
      </p>
      <AdminUserList initialUsers={users} />
    </div>
  );
}

export const revalidate = 0; // Or use revalidatePath in actions
