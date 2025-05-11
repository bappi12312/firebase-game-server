
'use client';

import { useEffect, useState, useTransition, useActionState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { submitServerAction, type SubmitServerFormState } from '@/lib/actions';
import { serverFormSchema } from '@/lib/schemas'; 
import type { Game } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerSubmissionFormProps {
  games: Game[];
}


export function ServerSubmissionForm({ games }: ServerSubmissionFormProps) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); 
  const [isSubmitting, startTransition] = useTransition();
  const router = useRouter();
  
  const initialState: SubmitServerFormState = { message: '', error: false, fields: {} };
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
        form.reset({ 
          name: '',
          ipAddress: '',
          port: 25565,
          game: '',
          description: '',
          bannerUrl: '',
          logoUrl: '',
          tags: '',
        }); 
        router.push('/dashboard'); // Redirect to dashboard on success
      }
    }
  }, [state, toast, form, router]);


  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (user?.uid) {
      formData.append('userId', user.uid);
    } else {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit a server.",
        variant: "destructive"
      });
      return;
    }
    startTransition(() => {
      formAction(formData);
    });
  };

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
        <form onSubmit={handleFormSubmit} className="space-y-6">
           <Form {...form}>
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
                        <Input type="number" placeholder="25565" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} />
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
                        disabled={isSubmitting || form.formState.isSubmitting}>
                   {isSubmitting || form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                   {isSubmitting || form.formState.isSubmitting ? 'Submitting...' : 'Submit Server'}
                </Button>
            </div>
            </Form>
        </form>
      </CardContent>
    </Card>
  );
}

