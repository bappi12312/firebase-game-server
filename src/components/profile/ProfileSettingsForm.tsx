
'use client';

import { useEffect } from 'react';
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
  // email: z.string().email().optional(), // Email change is complex, handle separately
});

type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;

export function ProfileSettingsForm() {
  const { toast } = useToast();
  const { user, userProfile, updateAuthContextProfile, loading: authLoading } = useAuth();

  const initialState: UpdateUserProfileFormState = { message: '', error: false };
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
        if (state.updatedProfile?.displayName) {
           updateAuthContextProfile({ displayName: state.updatedProfile.displayName });
        }
      }
    }
  }, [state, toast, updateAuthContextProfile]);


  const onSubmit = (data: ProfileSettingsFormValues) => {
    const formData = new FormData();
    formData.append('displayName', data.displayName);
    formAction(formData);
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

            {/* Email display (non-editable for now) */}
            <FormItem>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={user?.email || 'No email associated'} disabled />
                <FormMessage />
            </FormItem>
            
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
              {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
