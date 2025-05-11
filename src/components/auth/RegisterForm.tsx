
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
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { createUserProfile } from '@/lib/firebase-data'; 
import { Separator } from '@/components/ui/separator';


const registrationSchema = z.object({
  displayName: z.string().min(3, 'Display name must be at least 3 characters.').max(30, 'Display name too long.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

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

export function RegistrationForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
  });

  const handleRegistrationSuccess = (method: 'email' | 'google') => {
    toast({
      title: 'Registration Successful!',
      description: method === 'email' ? 'Please check your email to verify your account. Redirecting to login...' : 'Account created with Google. Redirecting to login...',
      duration: 5000,
    });
    router.push('/login?registrationSuccess=true');
  };
  
  const handleRegistrationError = (error: any, method: 'email' | 'google') => {
     let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use. Please try a different email or login.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Contact support.';
            break;
          case 'auth/popup-closed-by-user':
            errorMessage = 'Google Sign-Up popup was closed before completion.';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.';
            break;
          default:
            errorMessage = `Registration failed (${method}): ${error.message || 'Unknown error'}`;
            break;
        }
      } else if (error.message && (error.message.includes("Could not save user profile") || error.message.toLowerCase().includes('permission denied'))) {
         errorMessage = `Registration failed: ${error.message}. Please ensure Firestore rules allow user profile creation.`;
      }
      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      console.error(`Registration error (${method}):`, error);
  };

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
      
      await createUserProfile(userCredential.user);

      try {
        await sendEmailVerification(userCredential.user);
      } catch (verificationError) {
        console.error("Email verification error:", verificationError);
        // Don't block registration flow, user can verify later or be prompted
      }
      
      handleRegistrationSuccess('email');
    } catch (error: any) {
      handleRegistrationError(error, 'email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    if (!auth || !googleProvider) {
      toast({
        title: 'Registration Failed',
        description: "Google Sign-Up is not available. Please try again later.",
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Ensure user profile is created/updated in Firestore
      await createUserProfile(result.user);
      
      handleRegistrationSuccess('google');

    } catch (error: any) {
      handleRegistrationError(error, 'google');
    } finally {
      setIsGoogleLoading(false);
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <Button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          {isLoading ? 'Creating Account...' : 'Create Account with Email'}
        </Button>
      </form>
      <Separator className="my-6" />
      <Button 
        variant="outline" 
        onClick={handleGoogleSignUp} 
        disabled={isLoading || isGoogleLoading} 
        className="w-full"
      >
        {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
        {isGoogleLoading ? 'Signing Up...' : 'Sign Up with Google'}
      </Button>
    </Form>
  );
}
