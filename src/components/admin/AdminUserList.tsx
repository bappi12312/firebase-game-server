
'use client';

import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, ShieldAlert, Trash2, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateUserFirebaseRole, deleteFirebaseUserFirestoreData } from '@/lib/firebase-data'; // Direct call for client component


async function handleRoleChange(uid: string, currentRole: 'user' | 'admin', newRole: 'user' | 'admin', toast: any, startTransition: any, setUsers: any) {
  if (currentRole === newRole) return;
  
  startTransition(async () => {
    try {
      await updateUserFirebaseRole(uid, newRole);
      toast({ title: 'Success', description: `User role updated to ${newRole}.` });
      setUsers((prevUsers: UserProfile[]) => 
        prevUsers.map(u => u.uid === uid ? { ...u, role: newRole } : u)
      );
      // Server action would revalidate here, for client components, optimistic update or refetch
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update role.', variant: 'destructive' });
    }
  });
}

async function handleDeleteUser(uid: string, displayName: string | null, toast: any, startTransition: any, setUsers: any) {
   startTransition(async () => {
    try {
      await deleteFirebaseUserFirestoreData(uid); // This deletes Firestore data, not Auth entry
      toast({ title: 'Success', description: `User data for '${displayName || uid}' deleted.` });
       setUsers((prevUsers: UserProfile[]) => prevUsers.filter(u => u.uid !== uid));
      // Server action would revalidate here
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete user data.', variant: 'destructive' });
    }
  });
}


interface AdminUserListProps {
  initialUsers: UserProfile[];
}

export function AdminUserList({ initialUsers }: AdminUserListProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { user: adminUser } = useAuth(); // Current admin user
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);

  if (!users || users.length === 0) {
    return <p className="text-muted-foreground">No users found.</p>;
  }
  
  // Prevent admin from demoting/deleting themselves through this UI
  const isSelf = (uid: string) => adminUser?.uid === uid;


  return (
    <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Display Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((userProfile) => (
          <TableRow key={userProfile.uid}>
            <TableCell className="font-medium">{userProfile.displayName || 'N/A'}</TableCell>
            <TableCell>{userProfile.email}</TableCell>
            <TableCell>
              <Badge variant={userProfile.role === 'admin' ? 'default' : 'secondary'}>
                {userProfile.role}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-1">
              {!isSelf(userProfile.uid) && userProfile.role === 'user' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRoleChange(userProfile.uid, userProfile.role!, 'admin', toast, startTransition, setUsers)}
                  disabled={isPending}
                  title="Make Admin"
                >
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </Button>
              )}
              {!isSelf(userProfile.uid) && userProfile.role === 'admin' && (
                 <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRoleChange(userProfile.uid, userProfile.role!, 'user', toast, startTransition, setUsers)}
                  disabled={isPending}
                  title="Make User"
                >
                  <ShieldAlert className="h-4 w-4 text-yellow-500" />
                </Button>
              )}
              {!isSelf(userProfile.uid) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} title="Delete User Data">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the Firestore data
                        for user "{userProfile.displayName || userProfile.email}". This does NOT delete their Firebase Auth account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteUser(userProfile.uid, userProfile.displayName, toast, startTransition, setUsers)}
                        disabled={isPending}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isPending ? 'Deleting...' : 'Delete Data'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isSelf(userProfile.uid) && <span className="text-xs text-muted-foreground">(Self)</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}

