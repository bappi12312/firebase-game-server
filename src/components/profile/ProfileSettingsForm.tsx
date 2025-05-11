'use client';

import { useEffect, useTransition } from 'react'; // Added useTransition
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { updateUserProfileAction, type UpdateUserProfileFormState } from '@/lib/actions';
import { useActionState } from 'react';

const profileSettingsSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(50, 'Display name must be less than 50 characters.'),
});

type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;

export function ProfileSettingsForm() {
  const { toast } = useToast();
  const { user, userProfile, updateAuthContextProfile, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition(); // For wrapping action call

  const initialState: UpdateUserProfileFormState = { message: '', error: false };
  // Pass the server action and initial state to useActionState
  const [state, formAction] = useActionState(updateUserProfileAction, initialState);

  const form = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      displayName: userProfile?.displayName || user?.displayName || '',
    },
  });

  useEffect(() => {
    if (userProfile?.displayName || user?.displayName) {
      form.reset({ displayName: userProfile?.displayName || user?.displayName || '' });
    }
  }, [userProfile, user, form]);

  useEffect(() => {
    if (state?.message) {
      if (state.error) {
        toast({
          title: 'Update Failed',
          description: state.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success!',
          description: state.message,
        });
        // Assuming state.updatedProfile might contain the new displayName
        if (state.updatedProfile?.displayName) {
           updateAuthContextProfile({ displayName: state.updatedProfile.displayName });
        }
      }
    }
  }, [state, toast, updateAuthContextProfile]);


  const onSubmit = (data: ProfileSettingsFormValues) => {
    const formData = new FormData();
    formData.append('displayName', data.displayName);
    if (user?.uid) { // Add userId to FormData
      formData.append('userId', user.uid);
    } else {
      toast({ title: "Error", description: "User not identified. Please log in again.", variant: "destructive"});
      return;
    }
    // Wrap the call to formAction in startTransition
    startTransition(() => {
      formAction(formData);
    });
  };

  if (authLoading) {
    return <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin text-accent" />;
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>Update your display name.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* 
            No need for <form action={...}> if we are using react-hook-form's handleSubmit 
            and manually calling formAction wrapped in startTransition.
            If we wanted to use native form submission with action prop, we'd structure it differently.
          */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your display name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={user?.email || 'No email associated'} disabled />
                <FormMessage />
            </FormItem>
            
            <Button type="submit" disabled={isPending || form.formState.isSubmitting} className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
              {(isPending || form.formState.isSubmitting) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {(isPending || form.formState.isSubmitting) ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
