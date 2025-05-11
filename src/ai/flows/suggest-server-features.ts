'use server';

/**
 * @fileOverview AI-powered feature suggestion for server administrators.
 *
 * - suggestServerFeatures - A function that suggests server features based on trending servers.
 * - SuggestServerFeaturesInput - The input type for the suggestServerFeatures function.
 * - SuggestServerFeaturesOutput - The return type for the suggestServerFeatures function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestServerFeaturesInputSchema = z.object({
  trendingServerTypes: z
    .string()
    .describe('A description of the trending server types.'),
});
export type SuggestServerFeaturesInput = z.infer<
  typeof SuggestServerFeaturesInputSchema
>;

const SuggestServerFeaturesOutputSchema = z.object({
  suggestedFeatures: z
    .array(z.string())
    .describe('A list of suggested features for the server.'),
  rationale: z
    .string()
    .describe('The rationale behind the suggested features.'),
});
export type SuggestServerFeaturesOutput = z.infer<
  typeof SuggestServerFeaturesOutputSchema
>;

export async function suggestServerFeatures(
  input: SuggestServerFeaturesInput
): Promise<SuggestServerFeaturesOutput> {
  return suggestServerFeaturesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestServerFeaturesPrompt',
  input: {schema: SuggestServerFeaturesInputSchema},
  output: {schema: SuggestServerFeaturesOutputSchema},
  prompt: `You are a game server expert. Suggest features for a game server based on the trending server types.

  Trending Server Types: {{{trendingServerTypes}}}

  Consider features that would generate excitement and repeat traffic. Suggest at least three features.

  Format your answer as a JSON object with "suggestedFeatures" and "rationale" fields. suggestedFeatures should be a list of strings.
  `,
});

const suggestServerFeaturesFlow = ai.defineFlow(
  {
    name: 'suggestServerFeaturesFlow',
    inputSchema: SuggestServerFeaturesInputSchema,
    outputSchema: SuggestServerFeaturesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
