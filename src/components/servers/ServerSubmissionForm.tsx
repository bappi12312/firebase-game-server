
'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { submitServerAction, type SubmitServerFormState } from '@/lib/actions';
import type { Game } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useActionState } from 'react'; // React's own hook
import { useFormStatus } from 'react-dom';


const serverFormSchema = z.object({
  name: z.string().min(3, 'Server name must be at least 3 characters long.').max(50, 'Server name too long.'),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/, 'Invalid IP address or domain name.'),
  port: z.coerce.number().min(1, 'Port must be a positive number.').max(65535, 'Port number cannot exceed 65535.'),
  game: z.string().min(1, 'Please select a game.'),
  description: z.string().min(10, 'Description must be at least 10 characters.').max(1000, 'Description cannot exceed 1000 characters.'),
  bannerUrl: z.string().url('Invalid banner URL (e.g., https://example.com/banner.jpg).').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL (e.g., https://example.com/logo.png).').optional().or(z.literal('')),
  tags: z.string().optional().refine(val => !val || val.split(',').every(tag => tag.trim().length > 0 && tag.trim().length <= 20), {
    message: "Tags should be comma-separated, each up to 20 characters."
  }).refine(val => !val || val.split(',').length <= 5, {
    message: "Maximum of 5 tags allowed."
  }),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerSubmissionFormProps {
  games: Game[];
}

function SubmitButtonContent() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
      {pending ? 'Submitting...' : 'Submit Server'}
    </>
  );
}

export function ServerSubmissionForm({ games }: ServerSubmissionFormProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); 
  
  const initialState: SubmitServerFormState = { message: '', error: false, fields: {} };
  // useActionState hook manages state updates based on the Server Action's result
  const [state, formAction] = useActionState(submitServerAction, initialState);


  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: state.fields?.name || '',
      ipAddress: state.fields?.ipAddress || '',
      port: state.fields?.port ? Number(state.fields.port) : 25565,
      game: state.fields?.game || '',
      description: state.fields?.description || '',
      bannerUrl: state.fields?.bannerUrl || '',
      logoUrl: state.fields?.logoUrl || '',
      tags: state.fields?.tags || '',
    },
  });

  useEffect(() => {
    if (state?.message) {
      if (state.error) {
        toast({
          title: 'Submission Failed',
          description: state.message,
          variant: 'destructive',
        });
        // If server-side validation fails, repopulate form with previous values and errors
        if (state.fields) {
          for (const [key, value] of Object.entries(state.fields)) {
            if (key in form.getValues()) {
                 form.setValue(key as keyof ServerFormValues, value as any);
            }
          }
        }
        if (state.errors) {
            for (const fieldError of state.errors) {
                form.setError(fieldError.path as keyof ServerFormValues, { message: fieldError.message });
            }
        }

      } else {
        toast({
          title: 'Success!',
          description: state.message,
        });
        form.reset(); // Reset form on successful submission
      }
    }
  }, [state, toast, form]);


  if (authLoading) {
    return (
      <Card className="max-w-2xl mx-auto my-8">
        <CardHeader>
          <CardTitle className="text-2xl">Submit Your Server</CardTitle>
          <CardDescription>Loading authentication status...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto my-8">
        <CardHeader>
          <CardTitle className="text-2xl">Submit Your Server</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium mb-2">Authentication Required</p>
          <p className="text-muted-foreground mb-4">
            You need to be logged in to submit a server.
          </p>
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/login?redirect=/servers/submit">Login to Continue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Submit Your Server</CardTitle>
        <CardDescription>Fill in the details below to list your server on ServerSpotlight.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Pass formAction to the native form's action prop */}
        <form action={formAction} className="space-y-6">
            {/* react-hook-form's FormProvider for managing form state with Controller */}
           <Form {...form}>
            {/* Hidden input for submittedBy if needed by action, or handle in action via auth state */}
            {/* <input type="hidden" name="submittedBy" value={user.uid} /> */}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Server" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="ipAddress"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>IP Address or Domain</FormLabel>
                    <FormControl>
                        <Input placeholder="play.example.com or 123.45.67.89" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="25565" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="game"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Game</FormLabel>
                  <Controller
                    name="game"
                    control={form.control}
                    render={({ field: controllerField }) => (
                        <Select onValueChange={controllerField.onChange} value={controllerField.value} name={controllerField.name}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a game" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {games.map((game) => (
                                <SelectItem key={game.id} value={game.name}>
                                {game.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    )}
                    />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A brief description of your server (max 1000 characters)." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bannerUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banner URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/banner.jpg" {...field} />
                  </FormControl>
                  <FormDescription>Recommended size: 800x200px. Must be a direct image link.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormDescription>Recommended size: 100x100px. Must be a direct image link.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="PvP, Survival, Minigames (comma-separated)" {...field} />
                  </FormControl>
                  <FormDescription>Comma-separated list of tags (e.g., RPG, PvP, Economy). Max 5 tags, 20 chars each.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
                <Button type="submit" className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" 
                        disabled={form.formState.isSubmitting || (typeof document !== 'undefined' && (document.activeElement as HTMLButtonElement)?.form?.dataset?.pending === 'true')}>
                   <SubmitButtonContent />
                </Button>
            </div>
            </Form>
        </form>
      </CardContent>
    </Card>
  );
}