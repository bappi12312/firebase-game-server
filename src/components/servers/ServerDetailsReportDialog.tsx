
'use client';

import { useState, useActionState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, AlertTriangle, Send } from 'lucide-react';
import type { Server, ReportReason } from '@/lib/types';
import { REPORT_REASONS } from '@/lib/types';
import { reportFormSchema } from '@/lib/schemas';
import { reportServerAction, type ReportServerFormState } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useFormStatus } from 'react-dom';

interface ServerDetailsReportDialogProps {
  server: Server;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ReportFormValues = Zod.infer<typeof reportFormSchema>;

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {pending ? 'Submitting Report...' : 'Submit Report'}
        </Button>
    );
}


export function ServerDetailsReportDialog({ server, open, onOpenChange }: ServerDetailsReportDialogProps) {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const initialState: ReportServerFormState = { message: '' };
  const [state, formAction] = useActionState(reportServerAction, initialState);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      reason: undefined,
      description: '',
    },
  });

  useEffect(() => {
    if (state?.message) {
      if (state.error) {
        toast({
          title: 'Report Failed',
          description: state.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Report Submitted',
          description: state.message,
        });
        form.reset();
        onOpenChange(false);
      }
    }
  }, [state, toast, form, onOpenChange]);


  const onSubmit = (data: ReportFormValues) => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to report a server.', variant: 'destructive' });
      return;
    }
    const formData = new FormData();
    formData.append('serverId', server.id);
    formData.append('serverName', server.name);
    formData.append('reportingUserId', user.uid);
    formData.append('reportingUserDisplayName', userProfile?.displayName || user.email || 'Unknown User');
    formData.append('reason', data.reason);
    formData.append('description', data.description);
    
    formAction(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
            Report Server: {server.name}
          </DialogTitle>
          <DialogDescription>
            Please provide details about the issue you are reporting. Your report will be reviewed by an administrator.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Report</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REPORT_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
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
                    <Textarea
                      placeholder="Provide more details about the issue (e.g., specific rule broken, when it occurred)."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <SubmitButton />
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
