
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { createUserProfile } from '@/lib/firebase-data'; 

const registrationSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(30, 'Display name too long.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export function RegistrationForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegistrationFormValues) => {
    setIsLoading(true);
    if (!auth) {
      toast({
        title: 'Registration Failed',
        description: "Authentication service is not available. Please try again later.",
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(userCredential.user, { displayName: data.displayName });
      
      await createUserProfile(userCredential.user); // This now returns a UserProfile

      try {
        await sendEmailVerification(userCredential.user);
        // Toast for registration success is handled on the login page via query param,
        // but we can show a local one too if preferred.
        toast({
          title: 'Registration Successful!',
          description: 'Please check your email to verify your account. Redirecting to login...',
          duration: 5000,
        });
      } catch (verificationError) {
        console.error("Email verification error:", verificationError);
        toast({ 
          title: 'Registration Almost Complete!',
          description: 'Account created, but failed to send verification email. You can try to verify later or contact support.',
          variant: "default",
          duration: 7000,
        });
      }
      
      router.push('/login?registrationSuccess=true'); 
    } catch (error: any) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use. Please try a different email or login.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled. Contact support.';
      } else if (error.message && (error.message.includes("Could not save user profile") || error.message.toLowerCase().includes('permission denied'))) {
        errorMessage = `Registration failed: ${error.message}. Please ensure Firestore rules allow user profile creation.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>
    </Form>
  );
}
