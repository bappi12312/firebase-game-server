
'use client';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// export const metadata = { // metadata needs to be in layout for client components
//     title: 'Login - ServerSpotlight',
//     description: 'Login to your ServerSpotlight account.',
// };

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Set document title for client components
    document.title = 'Login - ServerSpotlight';

    const registrationSuccess = searchParams.get('registrationSuccess');
    if (registrationSuccess === 'true') {
      toast({
        title: 'Registration Successful!',
        description: 'Please check your email to verify your account. You can now log in.',
        duration: 5000,
      });
      // Clean the URL parameter
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router, toast]);

  return (
    <div className="flex justify-center items-center w-full py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription>Sign in to access your account and vote for servers.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-accent hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
