
import { getFirebaseServerById } from '@/lib/firebase-data';
import { ServerDetails } from '@/components/servers/ServerDetails';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, EyeOff } from 'lucide-react';
import type { Server } from '@/lib/types';
// For admin check (simplified for RSC, proper way is complex with current Next.js/Firebase setup)
// import { auth } from '@/lib/firebase'; 
// import { getUserProfile } from '@/lib/firebase-data';

interface ServerPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: ServerPageProps) {
  const server = await getFirebaseServerById(params.id);
  if (!server || server.status !== 'approved') { // Only generate metadata for approved servers or if user is admin (complex check here)
    return {
      title: 'Server Not Found',
    };
  }
  return {
    title: `${server.name} - ServerSpotlight`,
    description: `Details for ${server.name}: ${server.description.substring(0,150)}...`,
  };
}


export default async function ServerPage({ params }: ServerPageProps) {
  const server: Server | null = await getFirebaseServerById(params.id);

  // This is tricky for RSCs without easy access to current user's auth state.
  // A robust solution might involve a middleware or passing user state differently.
  // For now, we'll assume if a server is fetched, it can be viewed,
  // but we check its status.
  // const firebaseUser = auth.currentUser; // Not reliable in RSC
  // const profile = firebaseUser ? await getUserProfile(firebaseUser.uid) : null;
  // const isAdmin = profile?.role === 'admin';

  if (!server) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md p-8 text-center">
                <CardHeader>
                    <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-2xl">Server Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Sorry, the server you are looking for does not exist or may have been removed.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
  }

  // If server is not approved and user is not admin (simplified check)
  // This check is difficult to do reliably here without full user context.
  // For now, if server exists, show it. Status check primarily for voting/listing.
  // if (server.status !== 'approved' && !isAdmin) { // Simplified, isAdmin check is complex here
  if (server.status !== 'approved') { // Basic check: only show approved servers publicly
     // Check if current user is admin (this requires more setup for RSCs)
     // For now, let's assume if server.status is not 'approved', it is not publicly visible
     // unless we can verify admin status. A simpler approach is to just show details if server exists,
     // but restrict actions like voting based on status in ServerDetails component.
     // If we want to hide it completely:
    // return (
    //     <div className="flex flex-col items-center justify-center min-h-[60vh]">
    //         <Card className="w-full max-w-md p-8 text-center">
    //             <CardHeader>
    //                 <EyeOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
    //                 <CardTitle className="text-2xl">Server Pending Review</CardTitle>
    //             </CardHeader>
    //             <CardContent>
    //                 <p className="text-muted-foreground">
    //                     This server is currently awaiting approval and is not publicly visible yet.
    //                 </p>
    //             </CardContent>
    //         </Card>
    //     </div>
    // )
  }


  return <ServerDetails server={server} />;
}

export const revalidate = 60; // Revalidate server data periodically
