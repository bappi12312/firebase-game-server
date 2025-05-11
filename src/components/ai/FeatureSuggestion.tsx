'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Lightbulb } from 'lucide-react';
import { suggestServerFeatures, type SuggestServerFeaturesOutput } from '@/ai/flows/suggest-server-features';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function FeatureSuggestion() {
  const [trendingTypes, setTrendingTypes] = useState('');
  const [result, setResult] = useState<SuggestServerFeaturesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trendingTypes.trim()) {
      setError("Please enter trending server types.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const output = await suggestServerFeatures({ trendingServerTypes: trendingTypes });
      setResult(output);
    } catch (err) {
      console.error(err);
      setError('Failed to get suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Lightbulb className="w-7 h-7 text-accent" />
          AI-Powered Feature Discovery
        </CardTitle>
        <CardDescription>
          Get feature suggestions for your game server based on current trends.
          Enter a description of trending server types (e.g., "Minecraft servers with custom RPG elements and quests, Valheim servers focused on hardcore survival and PvP").
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="trendingTypes" className="text-base">Trending Server Types</Label>
            <Textarea
              id="trendingTypes"
              value={trendingTypes}
              onChange={(e) => setTrendingTypes(e.target.value)}
              placeholder="e.g., Minecraft RPG, Valheim hardcore PvP"
              className="mt-1 min-h-[100px]"
              required
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Getting Suggestions...' : 'Suggest Features'}
          </Button>
        </form>
      </CardContent>

      {error && (
        <CardFooter>
          <Alert variant="destructive" className="w-full">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardFooter>
      )}

      {result && (
        <CardFooter className="flex-col items-start gap-4">
          <h3 className="text-xl font-semibold text-primary">Suggestions:</h3>
          <Alert className="w-full">
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Suggested Features</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                {result.suggestedFeatures.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
          <Alert className="w-full" variant="default">
             <AlertTitle>Rationale</AlertTitle>
            <AlertDescription>
              <p className="mt-2">{result.rationale}</p>
            </AlertDescription>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
}
