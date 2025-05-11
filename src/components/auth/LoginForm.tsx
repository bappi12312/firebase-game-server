
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
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation'; 
import { createUserProfile } from '@/lib/firebase-data';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Define a simple Google SVG icon component
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18px" height="18px" className="mr-2">
    <path fill="#EA4335" d="M24 9.5c3.46 0 6.47 1.19 8.88 3.42l6.47-6.47C35.48 2.76 30.11 0 24 0 14.59 0 6.64 5.73 3.03 13.96l7.03 5.46C11.49 13.09 17.27 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.14 24.45c0-1.72-.15-3.37-.43-4.95H24v9.42h12.47c-.54 3.07-2.1 5.67-4.48 7.42l7.01 5.45C42.38 38.63 46.14 32.14 46.14 24.45z"/>
    <path fill="#FBBC05" d="M10.06 19.42C9.32 17.27 8.91 14.99 8.91 12.64c0-2.35.41-4.63 1.15-6.78L3.03 0.4C1.1 3.95 0 8.14 0 12.64s1.1 8.69 3.03 12.24l7.03-5.46z"/>
    <path fill="#34A853" d="M24 48c6.42 0 11.82-2.13 15.75-5.79l-7.01-5.45c-2.14 1.45-4.88 2.31-7.74 2.31-6.73 0-12.51-3.59-14.94-8.64l-7.03 5.46C6.64 42.27 14.59 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);


export function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLoginSuccess = (redirectUrl: string) => {
    toast({
      title: 'Login Successful!',
      description: 'Welcome back! You are now signed in.',
    });
    router.push(redirectUrl);
    // No need to refresh explicitly, AuthProvider should handle state changes.
  };

  const handleLoginError = (error: any, method: 'email' | 'google') => {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': 
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
        case 'auth/popup-closed-by-user':
            errorMessage = 'Google Sign-In popup was closed before completion.';
            break;
        case 'auth/account-exists-with-different-credential':
            errorMessage = 'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.';
            break;
        default:
          errorMessage = `Login failed (${method}): ${error.message || 'Unknown error'}`;
          break;
      }
    }
    toast({
      title: 'Login Failed',
      description: errorMessage,
      variant: 'destructive',
    });
    console.error(`Login error (${method}): `, error.code, error.message);
  };


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
      
      // It's generally better to let users log in even if email is not verified,
      // and then prompt them within the app or restrict certain features.
      // Forcing logout here can be a poor UX.
      // if (!userCredential.user.emailVerified) {
      //   toast({
      //     title: 'Email Verification Required',
      //     description: 'Please verify your email address before logging in. Check your inbox for the verification link.',
      //     variant: 'default', 
      //     duration: 7000,
      //   });
      //   // await signOut(auth); 
      //   // setIsLoading(false);
      //   // return; 
      // }

      const redirectUrl = searchParams.get('redirect') || '/dashboard'; 
      handleLoginSuccess(redirectUrl);

    } catch (error: any) {
      handleLoginError(error, 'email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    if (!auth || !googleProvider) {
      toast({
        title: 'Login Failed',
        description: "Google Sign-In is not available. Please try again later.",
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserProfile(result.user); // Ensure profile exists or is created

      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      handleLoginSuccess(redirectUrl);

    } catch (error: any) {
      handleLoginError(error, 'google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <Button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          {isLoading ? 'Signing In...' : 'Sign In with Email'}
        </Button>
      </form>
      <Separator className="my-6" />
      <Button 
        variant="outline" 
        onClick={handleGoogleSignIn} 
        disabled={isLoading || isGoogleLoading} 
        className="w-full"
      >
        {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
        {isGoogleLoading ? 'Signing In...' : 'Sign In with Google'}
      </Button>
    </Form>
  );
}
