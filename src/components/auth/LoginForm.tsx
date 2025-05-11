
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation'; 

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    if (!auth) {
        toast({
            title: 'Login Failed',
            description: "Authentication service is not available. Please try again later.",
            variant: 'destructive',
        });
        setIsLoading(false);
        return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      
      if (!userCredential.user.emailVerified) {
        toast({
          title: 'Email Verification Required',
          description: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          variant: 'default', // Using default variant, could be 'destructive' if preferred to block login
          duration: 7000,
        });
        // Optionally, sign the user out if you want to strictly enforce verification before any access
        // await signOut(auth); 
        // setIsLoading(false);
        // return; // Prevent redirect if email is not verified
      } else {
        toast({
            title: 'Login Successful!',
            description: 'Welcome back! You are now signed in.',
            variant: 'default', // explicit default variant
        });
      }

      const redirectUrl = searchParams.get('redirect') || '/dashboard'; 
      router.push(redirectUrl);
      router.refresh(); // Force refresh to update auth state across components

    } catch (error: any) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': // General invalid credential error for email/password
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled by an administrator.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = `Login failed: ${error.message || 'Unknown error'}`;
            break;
        }
      }
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error("Login error: ", error.code, error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
    </Form>
  );
}
