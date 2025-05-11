import { getServerById } from '@/lib/mock-data';
import { ServerDetails } from '@/components/servers/ServerDetails';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface ServerPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: ServerPageProps) {
  const server = await getServerById(params.id);
  if (!server) {
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
  const server = await getServerById(params.id);

  if (!server) {
    // return notFound(); // Or a custom not found component
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
    )
  }

  return <ServerDetails server={server} />;
}
