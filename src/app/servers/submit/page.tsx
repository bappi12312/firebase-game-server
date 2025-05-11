
import { ServerSubmissionForm } from '@/components/servers/ServerSubmissionForm';
import { getFirebaseGames } from '@/lib/firebase-data'; // Updated import
import { auth } from '@/lib/firebase';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server'; // Example if using Clerk, for Firebase we need custom server session or client check

export default async function SubmitServerPage() {
  // Server-side auth check. For Firebase, this is more complex as `auth.currentUser` is client-side.
  // A common pattern is to redirect if no user is found on client, or use a server session middleware.
  // For simplicity here, the form itself will handle logged-in state check more on client if needed.
  // If you had a server session:
  // const user = await getCurrentUser(); // Your function to get current Firebase user on server
  // if (!user) {
  //   redirect('/login?message=Please login to submit a server');
  // }

  const games = await getFirebaseGames();

  return (
    <div>
      <ServerSubmissionForm games={games} />
    </div>
  );
}
