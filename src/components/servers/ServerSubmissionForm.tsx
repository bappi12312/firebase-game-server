'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { submitServerAction, SubmitServerFormState } from '@/lib/actions';
import type { Game } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const serverFormSchema = z.object({
  name: z.string().min(3, 'Server name must be at least 3 characters long.'),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/, 'Invalid IP address or domain name.'),
  port: z.coerce.number().min(1, 'Port must be a positive number.').max(65535, 'Port number cannot exceed 65535.'),
  game: z.string().min(1, 'Please select a game.'),
  description: z.string().min(10, 'Description must be at least 10 characters.').max(500, 'Description cannot exceed 500 characters.'),
  bannerUrl: z.string().url('Invalid banner URL (e.g., https://example.com/banner.jpg).').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid logo URL (e.g., https://example.com/logo.png).').optional().or(z.literal('')),
});

type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerSubmissionFormProps {
  games: Game[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Submitting...' : 'Submit Server'}
    </Button>
  );
}

export function ServerSubmissionForm({ games }: ServerSubmissionFormProps) {
  const { toast } = useToast();
  
  const initialState: SubmitServerFormState = { message: '', error: false };
  const [state, formAction] = useFormState(submitServerAction, initialState);

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: '',
      ipAddress: '',
      port: 25565,
      game: '',
      description: '',
      bannerUrl: '',
      logoUrl: '',
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
        // Potentially populate form fields if server returns them
        if (state.fields) {
            for (const [key, value] of Object.entries(state.fields)) {
                form.setValue(key as keyof ServerFormValues, value);
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

  // Handle form submission through React Hook Form and then delegate to server action
  const onSubmit = (data: ServerFormValues) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formAction(formData);
  };


  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Submit Your Server</CardTitle>
        <CardDescription>Fill in the details below to list your server on ServerSpotlight.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Textarea placeholder="A brief description of your server (max 500 characters)." className="min-h-[100px]" {...field} />
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
                  <FormDescription>Recommended size: 800x200px.</FormDescription>
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
                  <FormDescription>Recommended size: 100x100px.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
                <SubmitButton />
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
