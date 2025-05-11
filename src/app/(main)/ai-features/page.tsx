import { FeatureSuggestion } from '@/components/ai/FeatureSuggestion';

export const metadata = {
  title: 'AI Feature Discovery - ServerSpotlight',
  description: 'Use AI to discover new features for your game server.',
};

export default function AIFeaturesPage() {
  return (
    <div>
      <FeatureSuggestion />
    </div>
  );
}

