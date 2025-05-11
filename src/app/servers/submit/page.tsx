import { ServerSubmissionForm } from '@/components/servers/ServerSubmissionForm';
import { getGames } from '@/lib/mock-data';

export default async function SubmitServerPage() {
  const games = await getGames();

  return (
    <div>
      <ServerSubmissionForm games={games} />
    </div>
  );
}
