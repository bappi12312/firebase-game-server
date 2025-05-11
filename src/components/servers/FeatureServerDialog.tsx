
'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Star, X } from 'lucide-react';
import type { Server } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { featureServerAction } from '@/lib/actions';
import { useAuth } from '@/context/AuthContext';


interface FeatureOption {
  id: string;
  days: number;
  price: number;
  label: string;
}

const FEATURE_OPTIONS: FeatureOption[] = [
  { id: '7days', days: 7, price: 5, label: '7 Days - $5.00 USD' },
  { id: '30days', days: 30, price: 15, label: '30 Days - $15.00 USD' },
  { id: '90days', days: 90, price: 40, label: '90 Days - $40.00 USD (Best Value)' },
];

interface FeatureServerDialogProps {
  server: Server;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedServer: Server) => void;
}

export function FeatureServerDialog({ server, open, onOpenChange, onSuccess }: FeatureServerDialogProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string>(FEATURE_OPTIONS[0].id);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user

  const selectedOption = FEATURE_OPTIONS.find(opt => opt.id === selectedOptionId) || FEATURE_OPTIONS[0];

  const handleSimulatePaymentAndFeature = () => {
    if (!user) {
        toast({
            title: "Authentication Required",
            description: "You need to be logged in to feature a server.",
            variant: "destructive",
        });
        return;
    }
    
    startTransition(async () => {
      // In a real app, this is where you would:
      // 1. Call a backend endpoint to create a PayPal order, get an orderID.
      // 2. Use PayPal JS SDK to render button and handle user payment approval.
      // 3. On PayPal approval, get payment details (e.g., PayPal orderID, payerID).
      // 4. Call another backend endpoint to capture/verify the payment with PayPal.
      // 5. If payment is successful, then call the featureServerAction.

      toast({
        title: 'Processing Feature Request...',
        description: 'Simulating PayPal payment and server update.',
      });

      // Simulate successful payment after a short delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        // Pass user.uid as the adminUserId for now, action will decide if user can feature.
        // Or better, a dedicated action for users. For simulation, this allows the flow.
        // The action's permission logic needs to be robust for self-serve features.
        const result = await featureServerAction(server.id, user.uid /* Pass current user's ID */, selectedOption.days);

        if (result.success && result.server) {
          toast({
            title: 'Server Featured!',
            description: `${server.name} is now featured for ${selectedOption.days} days.`,
          });
          onSuccess(result.server); 
          onOpenChange(false); 
        } else {
          toast({
            title: 'Failed to Feature Server',
            description: result.message || 'An unexpected error occurred.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({
          title: 'Error Featuring Server',
          description: error.message || 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl">
            <Star className="w-6 h-6 mr-2 text-yellow-500 fill-yellow-500" />
            Feature Server: {server.name}
          </DialogTitle>
          <DialogDescription>
            Boost your server's visibility by featuring it on our list.
            Select a duration below to proceed. Payment processing is simulated.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId} className="space-y-2">
            {FEATURE_OPTIONS.map((option) => (
              <Label 
                htmlFor={option.id} 
                key={option.id} 
                className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer has-[:checked]:bg-accent/20 has-[:checked]:border-accent"
              >
                <RadioGroupItem value={option.id} id={option.id} />
                <span className="flex-1 text-sm font-medium">
                  {option.label}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="my-4 p-4 bg-secondary/30 rounded-md text-center">
            <p className="text-lg font-semibold">Total: ${selectedOption.price.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">for {selectedOption.days} days of featuring</p>
        </div>

        
        <div className="mt-2 text-center">
            <p className="text-sm text-muted-foreground mb-3">
                <em>Payment integration (e.g., PayPal) would be here. This is a simulation.</em>
            </p>
            <Button
              onClick={handleSimulatePaymentAndFeature}
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                // Simple PayPal-like SVG or use a Lucide icon if available
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                  <path d="M8.584 17.337c0 .282-.06.528-.183.735-.122.207-.29.369-.504.486-.214.117-.468.176-.76.176h-.79c-.423 0-.756-.102-.997-.305-.241-.204-.362-.514-.362-.931l.002-.096c.045-1.25.405-2.223.98-2.919.573-.698 1.344-1.047 2.31-1.047.42 0 .773.085 1.06.255.286.17.507.396.66.678.153.282.25.597.275.945l.005.189zm5.031-5.24c.312-1.19.91-1.974 1.794-2.352.885-.378 1.87-.567 2.955-.567.45 0 .874.045 1.27.135.4.09.736.222.999.396.264.174.453.378.57.612.115.234.173.489.173.765 0 .313-.077.636-.231.969-.154.332-.375.642-.663.93-.288.287-.63.54-.993.756a3.62 3.62 0 0 1-1.19.468c-.402.09-.79.135-1.164.135-.66 0-1.254-.09-1.782-.27a14.195 14.195 0 0 1-1.434-.612l-.456-1.353zm-1.828 5.043c.297-.918.79-1.578 1.477-1.983.688-.405 1.51-.608 2.467-.608.465 0 .894.057 1.287.17.393.115.715.273.966.476.25.203.427.433.528.69.1.256.152.51.152.763 0 .396-.095.744-.286 1.044-.19.3-.45.534-.777.702-.328.168-.708.252-1.14.252-.6 0-1.17-.099-1.71-.297a12.21 12.21 0 0 1-1.458-.675l-.459-1.341zm-5.198 2.23c.282-.903.77-1.554 1.463-1.95.695-.396 1.52-.594 2.48-.594.39 0 .756.042 1.098.126.342.084.627.198.855.342.228.144.39.297.486.459.096.162.144.306.144.432 0 .207-.04.399-.12.576-.08.177-.205.333-.376.468-.17.135-.374.24-.612.315-.237.075-.492.113-.765.113-.54 0-1.05-.093-1.53-.279a10.65 10.65 0 0 1-1.29-.63l-.456-1.332zM8.65 4.395L7.263 9.963l.002-.003c-.345.96-.518 1.989-.518 3.087 0 .48.048.93.144 1.35.096.42.233.79.41 1.11.178.32.387.57.627.75.24.18.492.27.756.27h.81c.27 0 .5-.04.69-.12.19-.08.34-.18.45-.3.11-.12.18-.24.21-.36.03-.12.03-.22.004-.3l-.002-.006c-.002-.018-.12-.756-.12-1.377 0-.99.249-1.827.747-2.511.498-.684 1.182-1.026 2.052-1.026.39 0 .72.063.99.189.27.126.468.297.597.513.128.216.192.459.192.729l-.006.216c0 .222-.038.483-.114.783-.075.3-.188.612-.338.936-.15.324-.33.63-.54.918-.21.288-.437.531-.681.729a3.914 3.914 0 0 0-.918.522c-.303.132-.588.207-.855.225l-.17.003c-.705 0-1.32-.15-1.848-.45-.528-.3-.93-.702-1.207-1.206-.276-.504-.414-1.08-.414-1.728 0-.468.054-.918.162-1.35.108-.432.258-.822.45-1.17L8.28 3h4.453l2.013 7.455c.036.15.054.312.054.486 0 .42-.093.777-.279 1.068-.186.29-.45.498-.792.624-.342.126-.735.189-1.177.189-.78 0-1.44-.186-1.98-.558-.54-.372-.918-.933-1.134-1.683l2.103-7.581H8.65z"/>
                </svg>
              )}
              Simulate Payment & Feature Server
            </Button>
        </div>

        <DialogFooter className="sm:justify-start mt-6 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

